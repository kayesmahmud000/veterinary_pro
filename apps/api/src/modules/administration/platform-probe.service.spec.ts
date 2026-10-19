import { PlatformProbe } from "./platform-probe.service";
import { EnvService } from "../../config";
import { PlatformRepository } from "./platform.repository";
import { platformQueues } from "@vetralink/shared-types";
const connect = jest.fn(),
  ping = jest.fn(),
  disconnect = jest.fn(),
  counts = jest.fn(),
  workers = jest.fn(),
  queueDisconnect = jest.fn();
jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({ connect, ping, disconnect, on: jest.fn() })),
}));
jest.mock("bullmq", () => ({
  Queue: jest
    .fn()
    .mockImplementation(() => ({
      getJobCounts: counts,
      getWorkersCount: workers,
      disconnect: queueDisconnect,
      on: jest.fn(),
    })),
}));
describe("ADM8 redacted read-only probes with controlled dependencies", () => {
  const env = {
    redisUrl: "redis://synthetic:private@localhost:6379",
    emailProvider: "mock",
    awsAccessKeyId: "synthetic-private-id",
    awsSecretAccessKey: "synthetic-private-key",
    s3BucketMedia: "synthetic-private-bucket",
    stripeSecretKey: "synthetic-private-stripe",
  } as EnvService;
  const repo = { databaseProbe: jest.fn() };
  let probe: PlatformProbe;
  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue(undefined);
    ping.mockResolvedValue("PONG");
    workers.mockResolvedValue(2);
    queueDisconnect.mockResolvedValue(undefined);
    counts.mockResolvedValue({
      waiting: 3,
      active: 1,
      delayed: 2,
      failed: 5,
      completed: 8,
    });
    repo.databaseProbe.mockResolvedValue({ pending: 1, failed: 2 });
    probe = new PlatformProbe(env, repo as unknown as PlatformRepository);
  });
  it("reads only fixed queue counters and worker registrations, then closes all clients", async () => {
    const result = await probe.system();
    expect(result.redis).toBe("UP");
    expect(result.queues).toHaveLength(platformQueues.length);
    expect(
      result.queues.every(
        (q) =>
          q.status === "OBSERVED" &&
          q.registeredWorkers === 2 &&
          q.counts?.failed === 5,
      ),
    ).toBe(true);
    expect(counts).toHaveBeenCalledWith(
      "waiting",
      "active",
      "delayed",
      "failed",
      "completed",
    );
    expect(queueDisconnect).toHaveBeenCalledTimes(platformQueues.length);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("synthetic-private");
  });
  it("turns raw Redis/database failures into fixed unavailable statuses", async () => {
    connect.mockRejectedValue(
      new Error("redis://synthetic:PRIVATE@localhost/secret"),
    );
    repo.databaseProbe.mockResolvedValue(null);
    const result = await probe.system();
    expect(result.database).toBe("UNAVAILABLE");
    expect(result.redis).toBe("UNAVAILABLE");
    expect(
      result.queues.every(
        (q) => q.counts === null && q.registeredWorkers === null,
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|localhost|secret/);
    expect(disconnect).toHaveBeenCalled();
  });
  it("does not turn provider configuration into connectivity or delivery claims", () => {
    const status = probe.integrations();
    expect(status.items.find((i) => i.name === "EMAIL")?.status).toBe("MOCK");
    expect(status.items.find((i) => i.name === "STRIPE")?.status).toBe(
      "NOT_CONFIGURED",
    );
    expect(status.items.find((i) => i.name === "STORAGE")?.status).toBe(
      "CONFIGURED_UNVERIFIED",
    );
    expect(status.items.find((i) => i.name === "VIDEO")).toMatchObject({
      status: "MOCK",
      fallbackPossible: true,
    });
    expect(status.items.every((i) => i.externalTestAvailable === false)).toBe(
      true,
    );
    expect(JSON.stringify(status)).not.toMatch(
      /synthetic-private|redis:|localhost/,
    );
  });
});
