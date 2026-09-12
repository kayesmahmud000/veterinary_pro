import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigModule, EnvService } from "./config";
import { PrismaModule } from "./modules/prisma";
import { AuditModule } from "./modules/audit";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users";
import { AuthModule } from "./modules/auth";
import { FarmsModule } from "./modules/farms";
import { ProductsModule } from "./modules/products";
import { MediaModule } from "./modules/media";
import { OrdersModule } from "./modules/orders";
import { IdempotencyModule } from "./common/idempotency";

@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvService],
      useFactory: (envService: EnvService) => {
        const url = new URL(envService.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || "6379", 10),
            password: url.password ? decodeURIComponent(url.password) : undefined,
            username: url.username ? decodeURIComponent(url.username) : undefined,
          },
        };
      },
    }),
    PrismaModule,
    AuditModule,
    HealthModule,
    UsersModule,
    AuthModule,
    FarmsModule,
    ProductsModule,
    MediaModule,
    IdempotencyModule,
    OrdersModule,
  ],
})
export class AppModule {}
