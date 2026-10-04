import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import Redis from "ioredis";
import { EnvService } from "../../../config/env.service";

@Injectable()
export class RedisHealthIndicator
  extends HealthIndicator
  implements OnModuleDestroy
{
  private redisClient: Redis | null = null;

  constructor(private readonly envService: EnvService) {
    super();
  }

  private getClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(this.envService.redisUrl, {
        lazyConnect: true,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
    return this.redisClient;
  }

  async isHealthy(key = "redis"): Promise<HealthIndicatorResult> {
    const client = this.getClient();
    const start = Date.now();

    try {
      if (client.status !== "ready" && client.status !== "connecting") {
        await client.connect();
      }

      const pong = await client.ping();
      const latencyMs = Date.now() - start;

      if (pong === "PONG") {
        return this.getStatus(key, true, { latencyMs });
      }

      throw new Error(`Unexpected Redis response: ${pong}`);
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errMessage =
        error instanceof Error ? error.message : String(error);

      throw new HealthCheckError(
        `Redis health probe failed: ${errMessage}`,
        this.getStatus(key, false, { error: errMessage, latencyMs })
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      } finally {
        this.redisClient = null;
      }
    }
  }
}
