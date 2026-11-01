import { Injectable, Module, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { AppConfigModule, EnvService } from "../../config";
import { WorkflowException } from "../exceptions/domain.exception";

@Injectable()
export class WorkflowRateLimiter implements OnModuleDestroy {
  private readonly redis?: Redis;
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();
  private readonly maxMemoryCounters = 10_000;
  private connecting?: Promise<void>;
  constructor(env: EnvService) {
    if (env.redisEnabled === false) return;
    this.redis = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 2000,
    });
    this.redis.on("error", () => undefined);
  }
  async hit(
    scope: string,
    userId: string,
    limit: number,
    seconds: number,
  ): Promise<void> {
    if (!this.redis) {
      const now = Date.now();
      const key = JSON.stringify([scope, userId]);
      let entry = this.counters.get(key);
      if (!entry || entry.expiresAt <= now) {
        // Reclaim expired entries before admitting a new identity. Never evict a
        // live counter: that would let callers bypass limits under load.
        if (this.counters.size >= this.maxMemoryCounters) {
          for (const [existingKey, counter] of this.counters) {
            if (counter.expiresAt <= now) this.counters.delete(existingKey);
          }
        }
        if (!this.counters.has(key) && this.counters.size >= this.maxMemoryCounters)
          throw new WorkflowException("RATE_LIMIT_UNAVAILABLE", "Please retry shortly.", 503);
        entry = { count: 0, expiresAt: now + seconds * 1000 };
        this.counters.set(key, entry);
      }
      // No await between reading and updating: concurrent calls share one claim.
      entry.count += 1;
      if (entry.count > limit)
        throw new WorkflowException("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
      return;
    }
    let count: number;
    try {
      if (this.redis.status === "wait" && !this.connecting)
        this.connecting = this.redis.connect().finally(() => {
          this.connecting = undefined;
        });
      if (this.connecting) await this.connecting;
      count = Number(
        await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          `workflow-rate:${scope}:${userId}`,
          seconds,
        ),
      );
    } catch {
      throw new WorkflowException(
        "RATE_LIMIT_UNAVAILABLE",
        "Please retry shortly.",
        503,
      );
    }
    if (count > limit)
      throw new WorkflowException(
        "RATE_LIMITED",
        "Too many attempts. Please try again later.",
        429,
      );
  }
  onModuleDestroy() {
    this.redis?.disconnect();
    this.counters.clear();
  }
}
@Module({
  imports: [AppConfigModule],
  providers: [WorkflowRateLimiter],
  exports: [WorkflowRateLimiter],
})
export class WorkflowRateLimitModule {}
