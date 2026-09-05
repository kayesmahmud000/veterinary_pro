import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config";
import { PrismaModule } from "./modules/prisma";
import { AuditModule } from "./modules/audit";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users";
import { AuthModule } from "./modules/auth";
import { FarmsModule } from "./modules/farms";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    HealthModule,
    UsersModule,
    AuthModule,
    FarmsModule,
  ],
})
export class AppModule {}
