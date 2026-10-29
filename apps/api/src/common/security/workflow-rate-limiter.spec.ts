import Redis from "ioredis";
import { WorkflowRateLimiter } from "./workflow-rate-limiter";
import { EnvService } from "../../config";
jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn(() => { throw new Error("Redis construction forbidden"); }) }));
describe("workflow memory rate limits", () => {
  let limiter: WorkflowRateLimiter;
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); limiter = new WorkflowRateLimiter({ redisEnabled: false } as unknown as EnvService); });
  afterEach(() => { limiter.onModuleDestroy(); jest.useRealTimers(); });
  it("constructs no Redis client and preserves concurrent 429 limits", async () => {
    const results = await Promise.allSettled(Array.from({length: 20}, () => limiter.hit("upload", "user", 3, 60)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(3);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ errorCode: "RATE_LIMITED", statusCode: 429 });
    expect(Redis).not.toHaveBeenCalled();
  });
  it("isolates users/scopes and expires the fixed window", async () => {
    await limiter.hit("upload", "one", 1, 60);
    await expect(limiter.hit("upload", "one", 1, 60)).rejects.toMatchObject({statusCode:429});
    await limiter.hit("upload", "two", 1, 60);
    await limiter.hit("recovery", "one", 1, 60);
    jest.advanceTimersByTime(60000);
    await expect(limiter.hit("upload", "one", 1, 60)).resolves.toBeUndefined();
  });
});
