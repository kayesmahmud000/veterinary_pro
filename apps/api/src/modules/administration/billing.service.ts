import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  BillingKind,
  BillingQuery,
  BillingPlanEdit,
  BillingSubscriptionAction,
  billingQueries,
  billingPlanEditSchema,
  billingSubscriptionActionSchema,
  JwtPayload,
  UserRole,
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
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import { BillingRepository } from "./billing.repository";
@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  private assert(
    user: UserEntity | null,
    claims: JwtPayload,
  ): asserts user is UserEntity {
    if (
      !user?.isActive() ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) ||
      (claims.authorizationVersion !== undefined &&
        claims.authorizationVersion !== user.authorizationVersion)
    )
      throw new ForbiddenOperationException(
        "Current administrative identity required.",
      );
  }
  private async authorize(claims: JwtPayload) {
    const user = await this.users.findById(claims.sub);
    this.assert(user, claims);
    return user;
  }
  async list(claims: JwtPayload, kind: BillingKind, raw: BillingQuery) {
    await this.authorize(claims);
    return this.repo.list(
      kind,
      validateWorkflow<BillingQuery>(billingQueries[kind], raw),
    );
  }
  async detail(claims: JwtPayload, kind: BillingKind, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const row = await this.repo.detail(kind, id, tx);
        if (!row) throw new EntityNotFoundException("Billing record");
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async confirm(claims: JwtPayload, password: string) {
    const actor = await this.authorize(claims);
    await this.limiter.hit("billing-support", actor.id, 10, 900);
    if (!(await this.passwords.compare(password, actor.passwordHash)))
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return actor;
  }
  private async lockedActor(
    claims: JwtPayload,
    actor: UserEntity,
    tx: Prisma.TransactionClient,
  ) {
    const current = await this.users.lockById(claims.sub, tx);
    this.assert(current, claims);
    if (
      current.passwordHash !== actor.passwordHash ||
      current.authorizationVersion !== actor.authorizationVersion
    )
      throw new ForbiddenOperationException("Administrative session changed.");
  }
  async action(claims: JwtPayload, id: string, raw: BillingSubscriptionAction) {
    const input = validateWorkflow(billingSubscriptionActionSchema, raw),
      actor = await this.confirm(claims, input.actorPassword);
    return this.transactions.run(async (tx) => {
      await this.lockedActor(claims, actor, tx);
      await this.repo.lock("subscriptions", id, tx);
      const current = await this.repo.detail("subscriptions", id, tx);
      if (!current || current.kind !== "subscriptions")
        throw new EntityNotFoundException("Subscription");
      if (current.revision !== input.expectedRevision)
        throw new WorkflowException(
          "BILLING_VERSION_CONFLICT",
          "Record changed. Reload and review.",
        );
      if (!current.allowedActions.includes(input.action))
        throw new WorkflowException(
          "BILLING_ACTION_UNAVAILABLE",
          "This subscription cannot use the selected support action.",
        );
      const cancelAtPeriodEnd = input.action === "SCHEDULE_CANCELLATION";
      await this.repo.schedule(id, cancelAtPeriodEnd, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          entityType: "Subscription",
          entityId: id,
          action: cancelAtPeriodEnd
            ? "SUBSCRIPTION_CANCELLATION_SCHEDULED"
            : "SUBSCRIPTION_CANCELLATION_REVOKED",
          traceId: randomUUID(),
          oldValues: { cancelAtPeriodEnd: current.cancelAtPeriodEnd },
          newValues: { cancelAtPeriodEnd, reason: input.reason },
        },
        tx,
      );
      return this.repo.detail("subscriptions", id, tx);
    });
  }
  async editPlan(claims: JwtPayload, id: string, raw: BillingPlanEdit) {
    const input = validateWorkflow(billingPlanEditSchema, raw),
      actor = await this.confirm(claims, input.actorPassword);
    return this.transactions.run(async (tx) => {
      await this.lockedActor(claims, actor, tx);
      await this.repo.lock("plans", id, tx);
      const current = await this.repo.detail("plans", id, tx);
      if (!current || current.kind !== "plans")
        throw new EntityNotFoundException("Subscription plan");
      if (current.revision !== input.expectedRevision)
        throw new WorkflowException(
          "BILLING_VERSION_CONFLICT",
          "Record changed. Reload and review.",
        );
      const { expectedRevision, reason, actorPassword, ...data } = input;
      await this.repo.editPlan(id, data, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          entityType: "SubscriptionPlan",
          entityId: id,
          action: "SUBSCRIPTION_PLAN_UPDATED",
          traceId: randomUUID(),
          oldValues: {
            name: current.name,
            priceMonthlyCents: current.priceMonthlyCents,
            priceAnnualCents: current.priceAnnualCents,
            maxAnimals: current.maxAnimals,
            isActive: current.isActive,
          },
          newValues: { ...data, reason },
        },
        tx,
      );
      return this.repo.detail("plans", id, tx);
    });
  }
}
