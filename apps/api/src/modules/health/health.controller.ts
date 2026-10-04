import { Controller, Get } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
} from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { EnvService } from "../../config/env.service";
import { ResponseMessage } from "../../common/decorators/response-message.decorator";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly envService: EnvService
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "System liveness and readiness probe with DB and Redis metrics",
  })
  @SwaggerResponse({ status: 200, description: "All dependencies healthy" })
  @SwaggerResponse({
    status: 503,
    description: "One or more dependencies unhealthy",
  })
  @ResponseMessage("System health check succeeded")
  async check(): Promise<
    HealthCheckResult & { system: Record<string, unknown> }
  > {
    const result = await this.health.check([
      () => this.prismaHealth.isHealthy("database"),
      () => this.redisHealth.isHealthy("redis"),
    ]);

    const memoryUsage = process.memoryUsage();
    return {
      ...result,
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb:
          Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        environment: this.envService.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get("liveness")
  @ApiOperation({ summary: "Container process vitality probe" })
  @SwaggerResponse({
    status: 200,
    description: "Process is alive and responsive",
  })
  @ResponseMessage("Service is live")
  checkLiveness() {
    return {
      status: "up",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get("readiness")
  @HealthCheck()
  @ApiOperation({ summary: "Ingress traffic readiness probe" })
  @SwaggerResponse({ status: 200, description: "Ready to accept traffic" })
  @SwaggerResponse({
    status: 503,
    description: "Not ready to accept traffic",
  })
  @ResponseMessage("Service is ready to accept traffic")
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.isHealthy("database"),
      () => this.redisHealth.isHealthy("redis"),
    ]);
  }
}
