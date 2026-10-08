import { Module } from "@nestjs/common";
import { WorkflowRateLimitModule } from "../../common/security/workflow-rate-limiter";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { RoleEventsModule } from "../role-notifications/role-events.module";
import { RoleRequestRepository } from "./repositories/role-request.repository";
import { RoleRequestService } from "./services/role-request.service";
import { RoleRequestsController } from "./role-requests.controller";
@Module({
  imports: [
    AuthModule,
    UsersModule,
    AuditModule,
    RoleEventsModule,
    WorkflowRateLimitModule,
  ],
  providers: [RoleRequestRepository, RoleRequestService],
  controllers: [RoleRequestsController],
  exports: [RoleRequestRepository],
})
export class RoleRequestsModule {}
