import { Module, Global } from "@nestjs/common";
import { AppConfigModule, EnvService } from "../../config";
import {
  IDEMPOTENCY_SERVICE,
  IDEMPOTENCY_STORE,
} from "./idempotency.interface";
import { MemoryIdempotencyStore } from "./stores/memory-idempotency.store";
import { RedisIdempotencyStore } from "./stores/redis-idempotency.store";
import { IdempotencyService } from "./idempotency.service";
import { IdempotencyInterceptor } from "./interceptors/idempotency.interceptor";

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    MemoryIdempotencyStore,
    RedisIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (envService: EnvService) => {
        if (envService.nodeEnv === "test") {
          return new MemoryIdempotencyStore();
        }
        return new RedisIdempotencyStore(envService);
      },
      inject: [EnvService],
    },
    IdempotencyService,
    {
      provide: IDEMPOTENCY_SERVICE,
      useClass: IdempotencyService,
    },
    IdempotencyInterceptor,
  ],
  exports: [
    IDEMPOTENCY_SERVICE,
    IdempotencyService,
    IDEMPOTENCY_STORE,
    IdempotencyInterceptor,
  ],
})
export class IdempotencyModule {}
