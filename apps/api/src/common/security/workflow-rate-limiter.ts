import { Injectable, Module, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { AppConfigModule, EnvService } from "../../config";
import { WorkflowException } from "../exceptions/domain.exception";

@Injectable()
export class WorkflowRateLimiter implements OnModuleDestroy {
  private readonly redis: Redis;
  private connecting?: Promise<void>;
  constructor(env: EnvService) {
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
    this.redis.disconnect();
  }
}
@Module({
  imports: [AppConfigModule],
  providers: [WorkflowRateLimiter],
  exports: [WorkflowRateLimiter],
})
export class WorkflowRateLimitModule {}
