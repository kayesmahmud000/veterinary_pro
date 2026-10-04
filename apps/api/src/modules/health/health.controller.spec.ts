import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckService } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { EnvService } from "../../config/env.service";

describe("HealthController (health.controller.ts)", () => {
  let controller: HealthController;
  let healthService: jest.Mocked<Partial<HealthCheckService>>;
  let prismaHealth: jest.Mocked<Partial<PrismaHealthIndicator>>;
  let redisHealth: jest.Mocked<Partial<RedisHealthIndicator>>;
  let envService: jest.Mocked<Partial<EnvService>>;

  beforeEach(async () => {
    healthService = {
      check: jest.fn().mockImplementation(async (indicators) => {
        // Execute all passed indicator functions
        const results: Record<string, unknown> = {};
        for (const fn of indicators) {
          const res = await fn();
          Object.assign(results, res);
        }
        return {
          status: "ok",
          info: results,
          error: {},
          details: results,
        };
      }),
    };

    prismaHealth = {
      isHealthy: jest.fn().mockResolvedValue({
        database: { status: "up", latencyMs: 2 },
      }),
    };

    redisHealth = {
      isHealthy: jest.fn().mockResolvedValue({
        redis: { status: "up", latencyMs: 1 },
      }),
    };

    envService = {
      nodeEnv: "development",
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: healthService,
        },
        {
          provide: PrismaHealthIndicator,
          useValue: prismaHealth,
        },
        {
          provide: RedisHealthIndicator,
          useValue: redisHealth,
        },
        {
          provide: EnvService,
          useValue: envService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("GET /health", () => {
    it("should execute DB & Redis probes and return full status with system metadata", async () => {
      const response = await controller.check();

      expect(response.status).toBe("ok");
      expect(response.info).toEqual({
        database: { status: "up", latencyMs: 2 },
        redis: { status: "up", latencyMs: 1 },
      });
      expect(response.system).toBeDefined();
      expect(response.system["environment"]).toBe("development");
      expect(typeof response.system["uptimeSeconds"]).toBe("number");
      expect(typeof response.system["memoryUsageMb"]).toBe("number");
    });
  });

  describe("GET /health/liveness", () => {
    it("should return instant 200 liveness probe without executing DB/Redis checks", () => {
      const result = controller.checkLiveness();

      expect(result.status).toBe("up");
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
      expect(healthService.check).not.toHaveBeenCalled();
    });
  });

  describe("GET /health/readiness", () => {
    it("should execute DB & Redis probes for ingress readiness", async () => {
      const result = await controller.checkReadiness();

      expect(result.status).toBe("ok");
      expect(prismaHealth.isHealthy).toHaveBeenCalledWith("database");
      expect(redisHealth.isHealthy).toHaveBeenCalledWith("redis");
    });
  });
});
