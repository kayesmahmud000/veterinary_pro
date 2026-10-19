import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  AdminConsultationAction,
  AdminConsultationQuery,
  JwtPayload,
  UserRole,
  adminConsultationActionSchema,
  adminConsultationQuerySchema,
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
  UnauthorizedDomainException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import { AdminConsultationsRepository } from "./consultations.repository";

@Injectable()
export class AdminConsultationsService {
  constructor(
    private readonly repo: AdminConsultationsRepository,
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
      user.role !== claims.role ||
      user.authorizationVersion !== (claims.authorizationVersion ?? 0)
    )
      throw new ForbiddenOperationException(
        "Current administrative identity required.",
      );
  }
  private async authorize(claims: JwtPayload) {
    if (!claims?.sub) throw new UnauthorizedDomainException();
    const user = await this.users.findById(claims.sub);
    this.assert(user, claims);
    return user;
  }
  async list(claims: JwtPayload, raw: AdminConsultationQuery) {
    await this.authorize(claims);
    return this.repo.list(validateWorkflow(adminConsultationQuerySchema, raw));
  }
  async detail(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const result = await this.repo.detail(id, tx);
        if (!result) throw new EntityNotFoundException("Consultation");
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async candidates(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const result = await this.repo.candidates(id, tx);
        if (!result) throw new EntityNotFoundException("Consultation");
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private unavailable(): never {
    throw new WorkflowException(
      "CONSULTATION_ACTION_UNAVAILABLE",
      "Action unavailable. Review veterinarian availability or payment/clinical reconciliation requirements.",
    );
  }
  private conflict(): never {
    throw new WorkflowException(
      "CONSULTATION_VERSION_CONFLICT",
      "Consultation or assignment availability changed. Reload and review.",
    );
  }
  async action(claims: JwtPayload, id: string, raw: AdminConsultationAction) {
    const input = validateWorkflow(adminConsultationActionSchema, raw),
      actor = await this.authorize(claims);
    await this.limiter.hit("admin-consultations", actor.id, 10, 900);
    if (
      !(await this.passwords.compare(input.actorPassword, actor.passwordHash))
    )
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    try {
      return await this.transactions.run(
        async (tx) => {
          const currentActor = await this.users.lockById(claims.sub, tx);
          this.assert(currentActor, claims);
          if (
            currentActor.passwordHash !== actor.passwordHash ||
            currentActor.authorizationVersion !== actor.authorizationVersion
          )
            throw new ForbiddenOperationException(
              "Administrative session changed.",
            );
          const previousVetId = await this.repo.lock(id, tx);
          const current = await this.repo.detail(id, tx);
          if (!current) throw new EntityNotFoundException("Consultation");
          if (current.revision !== input.expectedRevision) this.conflict();
          if (!current.allowedActions.includes(input.action))
            this.unavailable();
          let vetId: string | null = previousVetId;
          if (input.action === "CANCEL") {
            // Redacted detail may hide a deleted identity; keep its durable notice tied
            // to the actual stored assignment without exposing it in the response.
            vetId = await this.repo.cancel(id, tx);
          } else {
            if (input.action === "ASSIGN") vetId = input.vetId;
            else {
              const candidates = await this.repo.candidates(id, tx);
              vetId =
                candidates?.items.find((c) => c.isEligible)?.vetId ?? null;
            }
            if (!vetId) this.unavailable();
            await this.repo.lockVet(vetId, tx);
            const candidate = await this.repo.candidate(id, vetId, tx);
            if (!candidate?.isEligible) this.unavailable();
            await this.repo.assign(id, vetId, tx);
          }
          if (vetId) await this.repo.notify(id, vetId, input.action, tx);
          await this.audit.record(
            {
              userId: claims.sub,
              entityType: "Consultation",
              entityId: id,
              action:
                input.action === "CANCEL"
                  ? "CONSULTATION_ADMIN_CANCELLED"
                  : input.action === "ASSIGN"
                    ? "CONSULTATION_ADMIN_ASSIGNED"
                    : "CONSULTATION_ADMIN_AUTO_ASSIGNED",
              traceId: randomUUID(),
              oldValues: {
                status: current.status,
                vetId: previousVetId,
              },
              newValues: {
                status: input.action === "CANCEL" ? "CANCELLED" : "ASSIGNED",
                vetId,
                reason: input.reason,
              },
            },
            tx,
          );
          return (await this.repo.detail(id, tx))!;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // Raw row locks surface PostgreSQL SQLSTATE via P2010; Prisma updates use P2034.
      const e = error as { code?: string; meta?: { code?: string } };
      if (
        e?.code === "P2034" ||
        ["40001", "40P01"].includes(e?.meta?.code ?? "")
      )
        this.conflict();
      throw error;
    }
  }
}
