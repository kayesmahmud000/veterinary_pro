import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { RoleNotificationRepository } from "./role-notification.repository";
@Module({
  imports: [PrismaModule, AuditModule],
  providers: [RoleNotificationRepository],
  exports: [RoleNotificationRepository],
})
export class RoleEventsModule {}
