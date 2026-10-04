import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckError } from "@nestjs/terminus";
import { RedisHealthIndicator } from "./redis.health";
import { EnvService } from "../../../config/env.service";

const mockPing = jest.fn();
const mockConnect = jest.fn();
const mockQuit = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("ioredis", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      status: "ready",
      connect: mockConnect,
      ping: mockPing,
      quit: mockQuit,
      disconnect: mockDisconnect,
    })),
  };
});

describe("RedisHealthIndicator (redis.health.ts)", () => {
  let indicator: RedisHealthIndicator;
  let envService: jest.Mocked<Partial<EnvService>>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockPing.mockResolvedValue("PONG");
    mockQuit.mockResolvedValue("OK");

    envService = {
      redisUrl: "redis://localhost:6379",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: EnvService,
          useValue: envService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  afterEach(async () => {
    if (indicator) {
      await indicator.onModuleDestroy();
    }
  });

  it("should be defined", () => {
    expect(indicator).toBeDefined();
  });

  it("should report status 'up' with latency when Redis responds with PONG", async () => {
    const result = await indicator.isHealthy("redis");

    expect(result).toEqual({
      redis: {
        status: "up",
        latencyMs: expect.any(Number),
      },
    });
    expect(mockPing).toHaveBeenCalled();
  });

  it("should throw HealthCheckError when Redis ping fails or rejects", async () => {
    mockPing.mockRejectedValueOnce(
      new Error("ECONNREFUSED 127.0.0.1:6379")
    );

    await expect(indicator.isHealthy("redis")).rejects.toThrow(
      HealthCheckError
    );
  });

  it("should disconnect redis client onModuleDestroy", async () => {
    // initialize client
    await indicator.isHealthy("redis");
    await indicator.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalled();
  });
});
