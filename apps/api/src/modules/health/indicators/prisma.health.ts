import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key = "database"): Promise<HealthIndicatorResult> {
    const result = await this.prisma.ping();

    if (result.status === "up") {
      return this.getStatus(key, true, {
        latencyMs: result.latencyMs,
        timestamp: result.timestamp,
      });
    }

    throw new HealthCheckError(
      `Database health probe failed: ${result.error ?? "Unknown error"}`,
      this.getStatus(key, false, {
        error: result.error,
        latencyMs: result.latencyMs,
      })
    );
  }
}
