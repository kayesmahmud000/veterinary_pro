import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckError } from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./prisma.health";
import { PrismaService } from "../../prisma/prisma.service";

describe("PrismaHealthIndicator (prisma.health.ts)", () => {
  let indicator: PrismaHealthIndicator;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    prismaService = {
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
  });

  it("should be defined", () => {
    expect(indicator).toBeDefined();
  });

  it("should report database status 'up' with latency when ping succeeds", async () => {
    (prismaService.ping as jest.Mock).mockResolvedValue({
      status: "up",
      latencyMs: 3,
      timestamp: new Date().toISOString(),
    });

    const result = await indicator.isHealthy("database");

    expect(result).toEqual({
      database: {
        status: "up",
        latencyMs: 3,
        timestamp: expect.any(String),
      },
    });
  });

  it("should throw HealthCheckError when database ping reports 'down'", async () => {
    (prismaService.ping as jest.Mock).mockResolvedValue({
      status: "down",
      latencyMs: 50,
      timestamp: new Date().toISOString(),
      error: "Connection refused on port 5432",
    });

    await expect(indicator.isHealthy("database")).rejects.toThrow(
      HealthCheckError
    );
  });
});
