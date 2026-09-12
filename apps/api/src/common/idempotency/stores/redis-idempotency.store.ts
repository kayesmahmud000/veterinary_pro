import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { EnvService } from "../../../config/env.service";
import {
  IdempotencyRecord,
  IdempotencyStatus,
  IIdempotencyStore,
} from "../idempotency.interface";

@Injectable()
export class RedisIdempotencyStore implements IIdempotencyStore {
  private readonly logger = new Logger(RedisIdempotencyStore.name);
  private readonly redisClient: Redis;
  private readonly prefix = "idempotency:";

  constructor(private readonly envService: EnvService) {
    this.redisClient = new Redis(this.envService.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  public async get<T>(key: string): Promise<IdempotencyRecord<T> | null> {
    try {
      const data = await this.redisClient.get(this.formatKey(key));
      if (!data) {
        return null;
      }
      return JSON.parse(data) as IdempotencyRecord<T>;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to retrieve idempotency key '${key}' from Redis: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  public async setPending(
    key: string,
    payloadHash: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const record: IdempotencyRecord = {
      key,
      status: IdempotencyStatus.PENDING,
      payloadHash,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await this.redisClient.set(
        this.formatKey(key),
        JSON.stringify(record),
        "EX",
        ttlSeconds,
        "NX"
      );
      return result === "OK";
    } catch (err: unknown) {
      this.logger.error(
        `Failed to set pending idempotency lock for key '${key}': ${err instanceof Error ? err.message : String(err)}`
      );
      // Fail closed or gracefully allow
      return false;
    }
  }

  public async setCompleted<T>(
    key: string,
    payloadHash: string,
    response: T,
    ttlSeconds: number
  ): Promise<void> {
    const record: IdempotencyRecord<T> = {
      key,
      status: IdempotencyStatus.COMPLETED,
      payloadHash,
      response,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.redisClient.set(
        this.formatKey(key),
        JSON.stringify(record),
        "EX",
        ttlSeconds
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to cache completed idempotency record for key '${key}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.formatKey(key));
    } catch (err: unknown) {
      this.logger.error(
        `Failed to delete idempotency key '${key}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private formatKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
