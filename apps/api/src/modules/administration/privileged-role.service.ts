import { Inject, Injectable } from "@nestjs/common";
import {
  PrivilegedRoleInput,
  privilegedRoleSchema,
  UserRole,
} from "@vetralink/shared-types";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { randomUUID } from "crypto";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../users/repositories/user.repository.interface";
import {
  PASSWORD_HASHER,
  IPasswordHasher,
} from "../auth/services/password-hasher.interface";
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from "../auth/repositories/refresh-token.repository.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import { RoleRequestRepository } from "../role-requests/repositories/role-request.repository";
import { RoleNotificationRepository } from "../role-notifications/role-notification.repository";
import { UserEntity } from "../users/entities/user.entity";
import { toAuthUserSummary } from "../users/auth-user-summary";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";

@Injectable()
export class PrivilegedRoleService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refresh: IRefreshTokenRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly requests: RoleRequestRepository,
    private readonly events: RoleNotificationRepository,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  private assert(user: UserEntity | null | undefined) {
    if (!user?.isActive() || user.role !== UserRole.SUPER_ADMIN)
      throw new ForbiddenOperationException(
        "Only an active super admin can manage administrative access.",
      );
  }
  async list(actorId: string, filter: any) {
    this.assert(await this.users.findById(actorId));
    return this.users.listAdministrative(filter);
  }
  async target(actorId: string, targetId: string) {
    this.assert(await this.users.findById(actorId));
    const user = await this.users.findById(targetId);
    if (!user) throw new EntityNotFoundException("User");
    return {
      ...toAuthUserSummary(user),
      fallbackRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)
        ? (user.previousNonAdministrativeRole ?? UserRole.LEARNER)
        : user.role,
    };
  }
  async targetByEmail(actorId: string, email: string) {
    this.assert(await this.users.findById(actorId));
    const user = await this.users.findByEmail(email);
    if (!user) throw new EntityNotFoundException("User");
    return {
      ...toAuthUserSummary(user),
      fallbackRole: [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)
        ? (user.previousNonAdministrativeRole ?? UserRole.LEARNER)
        : user.role,
    };
  }
  async change(actorId: string, targetId: string, input: PrivilegedRoleInput) {
    input = validateWorkflow(privilegedRoleSchema, input);
    const actor = await this.users.findById(actorId);
    this.assert(actor);
    await this.limiter.hit("privileged-role", actorId, 5, 900);
    if (actorId === targetId)
      throw new WorkflowException(
        "SELF_ROLE_CHANGE",
        "You cannot change your own administrative access.",
      );
    if (
      !(await this.passwords.compare(input.actorPassword, actor!.passwordHash))
    )
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return this.transactions.run(async (tx) => {
      await this.users.lockAdministrativePolicy(tx);
      const locked = new Map<string, UserEntity | null>();
      for (const id of [actorId, targetId].sort())
        locked.set(id, await this.users.lockById(id, tx));
      const currentActor = locked.get(actorId);
      this.assert(currentActor);
      if (
        currentActor!.passwordHash !== actor!.passwordHash ||
        currentActor!.authorizationVersion !== actor!.authorizationVersion
      )
        throw new ForbiddenOperationException(
          "Administrative session changed. Sign in again.",
        );
      const target = locked.get(targetId);
      if (!target?.isActive())
        throw new WorkflowException(
          "TARGET_INELIGIBLE",
          "Target user is missing or inactive.",
        );
      if (target.roleVersion !== input.expectedRoleVersion)
        throw new WorkflowException(
          "ROLE_VERSION_CONFLICT",
          "Target role changed. Reload and retry.",
        );
      const oldRole = target.role;
      const administrative = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
      if (
        input.action === "REMOVE_PRIVILEGE" &&
        !administrative.includes(oldRole)
      )
        throw new WorkflowException(
          "INVALID_ROLE_TRANSITION",
          "This account has no administrative privilege.",
        );
      const role =
        input.action === "GRANT_ADMIN"
          ? UserRole.ADMIN
          : input.action === "GRANT_SUPER_ADMIN"
            ? UserRole.SUPER_ADMIN
            : (target.previousNonAdministrativeRole ?? UserRole.LEARNER);
      if (
        role === oldRole ||
        (input.action === "REMOVE_PRIVILEGE" && administrative.includes(role))
      )
        throw new WorkflowException(
          "INVALID_ROLE_TRANSITION",
          "Requested role transition is invalid.",
        );
      if (
        oldRole === UserRole.SUPER_ADMIN &&
        role !== UserRole.SUPER_ADMIN &&
        (await this.users.countActiveSuperAdmins(tx)) <= 1
      )
        throw new WorkflowException(
          "LAST_SUPER_ADMIN",
          "At least one active super admin must remain.",
        );
      const pending = await this.requests.pending(targetId, tx);
      if (pending) {
        await this.requests.lock(pending.id, tx);
        await this.requests.decide(
          pending.id,
          actorId,
          {
            decision: "REJECTED",
            expectedRequestVersion: pending.requestVersion,
            expectedApplicantRoleVersion: target.roleVersion,
            publicReason: "ROLE_CHANGED",
          },
          tx,
        );
        await this.audit.record(
          {
            userId: actorId,
            action: "ROLE_REQUEST_REJECTED",
            entityType: "RoleUpgradeRequest",
            entityId: pending.id,
            newValues: { reason: "ROLE_CHANGED" },
            traceId: randomUUID(),
          },
          tx,
        );
        await this.events.add(
          {
            eventKey: `request-${pending.id}-role-changed`,
            eventType: "ROLE_REQUEST_REJECTED",
            requestId: pending.id,
            targetUserId: targetId,
            locale: pending.locale,
          },
          tx,
        );
      }
      target.changeRole(role);
      await this.users.saveRole(target, input.expectedRoleVersion, tx);
      await this.refresh.revokeAllForUser(targetId, new Date(), tx);
      await this.audit.record(
        {
          userId: actorId,
          action: "PRIVILEGED_ROLE_CHANGED",
          entityType: "User",
          entityId: targetId,
          oldValues: { role: oldRole },
          newValues: {
            role,
            roleVersion: target.roleVersion,
            reason: input.reason,
          },
          traceId: randomUUID(),
        },
        tx,
      );
      await this.events.add(
        {
          eventKey: `privilege-${targetId}-${target.roleVersion}`,
          eventType: "PRIVILEGED_ROLE_CHANGED",
          targetUserId: targetId,
          authorizationVersion: target.authorizationVersion,
        },
        tx,
      );
      return toAuthUserSummary(target);
    });
  }
}
