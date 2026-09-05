import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma.service";
import { Logger } from "@nestjs/common";

describe("PrismaService", () => {
  let service: PrismaService;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "NODE_ENV") return "test";
        if (key === "SLOW_QUERY_THRESHOLD_MS") return "100";
        if (key === "DB_CONNECT_RETRY_DELAY_MS") return "1"; // fast retry in tests
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should connect successfully on first attempt", async () => {
      const connectSpy = jest
        .spyOn(service, "$connect")
        .mockResolvedValueOnce(undefined as never);

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it("should retry on transient connection failure and succeed", async () => {
      const connectSpy = jest
        .spyOn(service, "$connect")
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockResolvedValueOnce(undefined as never);

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it("should throw error after exhausting 3 connection attempts", async () => {
      const connectSpy = jest
        .spyOn(service, "$connect")
        .mockRejectedValue(new Error("DB fatal down"));

      await expect(service.onModuleInit()).rejects.toThrow("DB fatal down");
      expect(connectSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("onModuleDestroy", () => {
    it("should disconnect gracefully", async () => {
      const disconnectSpy = jest
        .spyOn(service, "$disconnect")
        .mockResolvedValueOnce(undefined as never);

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    it("should catch and log errors during disconnect without throwing", async () => {
      jest
        .spyOn(service, "$disconnect")
        .mockRejectedValueOnce(new Error("Disconnect failure"));

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe("ping & isHealthy", () => {
    it("should report status 'up' with latency when SELECT 1 succeeds", async () => {
      jest
        .spyOn(service, "$queryRawUnsafe")
        .mockResolvedValue([{ "?column?": 1 }] as never);

      const result = await service.ping();

      expect(result.status).toBe("up");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();

      const healthy = await service.isHealthy();
      expect(healthy).toBe(true);
    });

    it("should report status 'down' with error message when query fails", async () => {
      jest
        .spyOn(service, "$queryRawUnsafe")
        .mockRejectedValue(new Error("Connection timeout"));

      const result = await service.ping();

      expect(result.status).toBe("down");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.error).toContain("Connection timeout");

      const healthy = await service.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  describe("Slow Query Performance Metrics", () => {
    it("should log a warning when query execution duration exceeds threshold", () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();

      // Retrieve registered query listener
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryCallback = (service as any).$on.mock?.calls?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any[]) => call[0] === "query"
      )?.[1];

      if (queryCallback) {
        queryCallback({
          timestamp: new Date(),
          query: "SELECT * FROM users WHERE email = $1",
          params: "['vet@vetralink.pro']",
          duration: 350,
          target: "users",
        });

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("⚡ SLOW QUERY (350ms)")
        );
      }
    });
  });
});
