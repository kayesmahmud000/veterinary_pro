import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config";
import { PrismaModule } from "./modules/prisma";
import { AuditModule } from "./modules/audit";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
