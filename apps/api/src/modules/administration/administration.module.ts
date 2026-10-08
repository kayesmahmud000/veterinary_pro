import { Module } from "@nestjs/common";
import { WorkflowRateLimitModule } from "../../common/security/workflow-rate-limiter";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { RoleRequestsModule } from "../role-requests/role-requests.module";
import { RoleEventsModule } from "../role-notifications/role-events.module";
import { PrivilegedRoleService } from "./privileged-role.service";
import { PrivilegedRolesController } from "./privileged-roles.controller";
@Module({
  imports: [
    AuthModule,
    UsersModule,
    AuditModule,
    RoleRequestsModule,
    RoleEventsModule,
    WorkflowRateLimitModule,
  ],
  providers: [PrivilegedRoleService],
  controllers: [PrivilegedRolesController],
})
export class AdministrationModule {}
