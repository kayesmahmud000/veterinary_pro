import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  AccountActionInput,
  accountActionSchema,
  DirectoryKind,
  DirectoryQuery,
  directoryQueries,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../users/repositories/user.repository.interface";
import { UserEntity } from "../users/entities/user.entity";
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
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { DirectoryRepository } from "./directory.repository";
@Injectable()
export class DirectoryService {
  constructor(
    private readonly directory: DirectoryRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refresh: IRefreshTokenRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  private assert(
    actor: UserEntity | null,
    claims: JwtPayload,
  ): asserts actor is UserEntity {
    if (
      !actor?.isActive() ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role) ||
      (claims.authorizationVersion !== undefined &&
        actor.authorizationVersion !== claims.authorizationVersion)
    )
      throw new ForbiddenOperationException(
        "Current active administrative identity required.",
      );
  }
  async list(claims: JwtPayload, kind: DirectoryKind, query: DirectoryQuery) {
    const actor = await this.users.findById(claims.sub);
    this.assert(actor, claims);
    return this.directory.list(
      kind,
      validateWorkflow(directoryQueries[kind], query) as DirectoryQuery,
      actor.role === UserRole.SUPER_ADMIN,
    );
  }
  async detail(claims: JwtPayload, kind: DirectoryKind, id: string) {
    const actor = await this.users.findById(claims.sub);
    this.assert(actor, claims);
    const result = await this.directory.detail(
      kind,
      id,
      actor.role === UserRole.SUPER_ADMIN,
    );
    if (!result) throw new EntityNotFoundException("Directory record");
    return result;
  }
  async act(claims: JwtPayload, targetId: string, raw: AccountActionInput) {
    const input = validateWorkflow(accountActionSchema, raw);
    const actor = await this.users.findById(claims.sub);
    this.assert(actor, claims);
    if (targetId === actor.id)
      throw new WorkflowException(
        "ACCOUNT_ACTION_FORBIDDEN",
        "Self account actions are prohibited.",
        403,
      );
    await this.limiter.hit("account-support", actor.id, 5, 900);
    if (
      !(await this.passwords.compare(input.actorPassword, actor.passwordHash))
    )
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return this.transactions.run(async (tx) => {
      await this.users.lockAdministrativePolicy(tx);
      const locked = new Map<string, UserEntity | null>();
      for (const id of [actor.id, targetId].sort())
        locked.set(id, await this.users.lockById(id, tx));
      const currentActor = locked.get(actor.id) ?? null;
      this.assert(currentActor, claims);
      if (
        currentActor.passwordHash !== actor.passwordHash ||
        currentActor.authorizationVersion !== actor.authorizationVersion
      )
        throw new ForbiddenOperationException(
          "Administrative session changed.",
        );
      const target = locked.get(targetId);
      if (!target || target.isDeleted())
        throw new EntityNotFoundException("User");
      if ([UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(target.role))
        throw new WorkflowException(
          "ACCOUNT_ACTION_FORBIDDEN",
          "Administrative accounts use the privileged access workflow.",
          403,
        );
      if (target.authorizationVersion !== input.expectedAuthorizationVersion)
        throw new WorkflowException(
          "ACCOUNT_VERSION_CONFLICT",
          "Account changed. Reload and retry.",
        );
      const status =
        input.action === "SUSPEND"
          ? UserStatus.SUSPENDED
          : input.action === "REACTIVATE"
            ? UserStatus.ACTIVE
            : target.status;
      if (
        input.action !== "REVOKE_SESSIONS" &&
        (target.status === status ||
          target.status === UserStatus.PENDING_VERIFICATION)
      )
        throw new WorkflowException(
          "INVALID_ACCOUNT_TRANSITION",
          "Account transition is invalid.",
        );
      const result = await this.directory.action(
        targetId,
        status,
        input.expectedAuthorizationVersion,
        tx,
      );
      await this.refresh.revokeAllForUser(targetId, new Date(), tx);
      await this.audit.record(
        {
          userId: actor.id,
          action:
            input.action === "SUSPEND"
              ? "USER_SUSPENDED"
              : input.action === "REACTIVATE"
                ? "USER_REACTIVATED"
                : "USER_SESSIONS_REVOKED",
          entityType: "User",
          entityId: targetId,
          oldValues: {
            status: target.status,
            authorizationVersion: target.authorizationVersion,
          },
          newValues: {
            status,
            authorizationVersion: target.authorizationVersion + 1,
            reason: input.reason,
          },
          traceId: randomUUID(),
        },
        tx,
      );
      return result;
    });
  }
}
