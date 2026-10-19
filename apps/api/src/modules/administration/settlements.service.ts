import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  JwtPayload,
  UserRole,
  AdminSettlementQuery,
  AdminSettlementReconcile,
  AdminSettlementBulk,
  adminSettlementQuerySchema,
  adminSettlementSummaryQuerySchema,
  adminSettlementReconcileSchema,
  adminSettlementBulkSchema,
  adminSettlementPreviewSchema,
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
import { AdminSettlementsRepository } from "./settlements.repository";
@Injectable()
export class AdminSettlementsService {
  constructor(
    private readonly repo: AdminSettlementsRepository,
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
      claims.authorizationVersion !== user.authorizationVersion ||
      claims.role !== user.role ||
      claims.sub !== user.id
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
  async list(claims: JwtPayload, raw: AdminSettlementQuery) {
    await this.authorize(claims);
    const q = validateWorkflow(adminSettlementQuerySchema, raw);
    return this.transactions.run((tx) => this.repo.list(q, tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  async summary(claims: JwtPayload, raw: Partial<AdminSettlementQuery>) {
    await this.authorize(claims);
    return this.repo.summary(
      validateWorkflow(adminSettlementSummaryQuerySchema, raw),
    );
  }
  async detail(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const row = await this.repo.detail(id, tx);
        if (!row) throw new EntityNotFoundException("Settlement");
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async preview(claims: JwtPayload, id: string) {
    const row = await this.detail(claims, id);
    return adminSettlementPreviewSchema.parse({
      id: row.id,
      totalFeeCents: row.totalFeeCents,
      platformFeeRate: row.platformFeeRate,
      platformFeeCents: row.platformFeeCents,
      vetPayoutCents: row.vetPayoutCents,
      currency: row.currency,
      matchesStoredSplit:
        row.platformFeeCents + row.vetPayoutCents === row.totalFeeCents &&
        Math.round(row.totalFeeCents * row.platformFeeRate) ===
          row.platformFeeCents,
    });
  }
  private async confirm(claims: JwtPayload, password: string) {
    const actor = await this.authorize(claims);
    await this.limiter.hit(
      "admin-settlement-reconciliation",
      actor.id,
      10,
      900,
    );
    if (!(await this.passwords.compare(password, actor.passwordHash)))
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return actor;
  }
  private async mutate(
    claims: JwtPayload,
    input: AdminSettlementReconcile | AdminSettlementBulk,
    items: Array<{ id: string; expectedRevision: string }>,
    bulk: boolean,
  ) {
    const actor = await this.confirm(claims, input.actorPassword);
    try {
      return await this.transactions.run(async (tx) => {
        const currentActor = await this.users.lockById(claims.sub, tx);
        this.assert(currentActor, claims);
        if (
          currentActor.passwordHash !== actor.passwordHash ||
          currentActor.authorizationVersion !== actor.authorizationVersion
        )
          throw new ForbiddenOperationException(
            "Administrative session changed.",
          );
        const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
        await this.repo.lock(
          ordered.map((i) => i.id),
          tx,
        );
        const current = [];
        for (const item of ordered) {
          const row = await this.repo.detail(item.id, tx);
          if (!row) throw new EntityNotFoundException("Settlement");
          if (row.revision !== item.expectedRevision)
            throw new WorkflowException(
              "SETTLEMENT_VERSION_CONFLICT",
              "Settlement changed. Reload and review.",
            );
          if (
            !row.canReconcile ||
            ("vetId" in input &&
              (row.vet?.id !== input.vetId || row.currency !== input.currency))
          )
            throw new WorkflowException(
              "SETTLEMENT_ACTION_UNAVAILABLE",
              "Settlement is unavailable for local reconciliation.",
            );
          current.push(row);
        }
        const traceId = randomUUID();
        for (const row of current) {
          await this.repo.reconcile(row.id, input, tx);
          await this.audit.record(
            {
              userId: claims.sub,
              action: bulk
                ? "ADMIN_SETTLEMENT_BULK_RECONCILED"
                : "ADMIN_SETTLEMENT_RECONCILED",
              entityType: "ConsultationPayoutLedger",
              entityId: row.id,
              traceId,
              oldValues: { status: row.status },
              newValues: {
                status: "PAID",
                reason: input.reason,
                payoutReference: input.payoutReference,
                payoutBatchId: input.payoutBatchId ?? row.payoutBatchId,
              },
            },
            tx,
          );
        }
        const result = [];
        for (const item of items)
          result.push((await this.repo.detail(item.id, tx))!);
        return result;
      });
    } catch (error) {
      const conflict =
        error &&
        typeof error === "object" &&
        (("code" in error &&
          ["P2034", "40001", "40P01"].includes(String(error.code))) ||
          ("meta" in error &&
            error.meta &&
            typeof error.meta === "object" &&
            "code" in error.meta &&
            ["40001", "40P01"].includes(String(error.meta.code))));
      if (conflict)
        throw new WorkflowException(
          "SETTLEMENT_VERSION_CONFLICT",
          "Settlement changed. Reload and review.",
        );
      throw error;
    }
  }
  async reconcile(
    claims: JwtPayload,
    id: string,
    raw: AdminSettlementReconcile,
  ) {
    const input = validateWorkflow(adminSettlementReconcileSchema, raw);
    return (
      await this.mutate(
        claims,
        input,
        [{ id, expectedRevision: input.expectedRevision }],
        false,
      )
    )[0];
  }
  async bulk(claims: JwtPayload, raw: AdminSettlementBulk) {
    const input = validateWorkflow(adminSettlementBulkSchema, raw);
    return { items: await this.mutate(claims, input, input.items, true) };
  }
}
