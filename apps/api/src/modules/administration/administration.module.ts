import { Module } from "@nestjs/common";
import { WorkflowRateLimitModule } from "../../common/security/workflow-rate-limiter";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { AuditModule } from "../audit/audit.module";
import { RoleRequestsModule } from "../role-requests/role-requests.module";
import { RoleEventsModule } from "../role-notifications/role-events.module";
import { PrivilegedRoleService } from "./privileged-role.service";
import { PrivilegedRolesController } from "./privileged-roles.controller";
import { DirectoryRepository } from "./directory.repository";
import { DirectoryService } from "./directory.service";
import { DirectoryController } from "./directory.controller";
@Module({
  imports: [
    AuthModule,
    UsersModule,
    AuditModule,
    RoleRequestsModule,
    RoleEventsModule,
    WorkflowRateLimitModule,
  ],
  providers: [PrivilegedRoleService, DirectoryRepository, DirectoryService],
  controllers: [PrivilegedRolesController, DirectoryController],
})
export class AdministrationModule {}
