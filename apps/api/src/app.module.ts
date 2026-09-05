import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config";
import { PrismaModule } from "./modules/prisma";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
