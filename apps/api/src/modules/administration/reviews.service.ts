import {VET_PROFILE_REPOSITORY, IVetProfileRepository} from "../consultations/repositories/vet-profile.repository.interface";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  AdminReviewModerate,
  AdminReviewQuery,
  JwtPayload,
  UserRole,
  adminReviewModerateSchema,
  adminReviewQuerySchema,
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
import { AdminReviewsRepository } from "./reviews.repository";

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly repo: AdminReviewsRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly limiter: WorkflowRateLimiter,
    @Inject(VET_PROFILE_REPOSITORY) private readonly profiles: IVetProfileRepository,
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
  async list(claims: JwtPayload, raw: AdminReviewQuery) {
    await this.authorize(claims);
    return this.repo.list(validateWorkflow(adminReviewQuerySchema, raw));
  }
  async detail(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const result = await this.repo.detail(id, tx);
        if (!result) throw new EntityNotFoundException("ConsultationReview");
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private unavailable(): never {
    throw new WorkflowException(
      "REVIEW_ACTION_UNAVAILABLE",
      "Review status is already selected. Reload and review.",
    );
  }
  private conflict(): never {
    throw new WorkflowException(
      "REVIEW_VERSION_CONFLICT",
      "Review changed. Reload and review.",
    );
  }
  async moderate(claims: JwtPayload, id: string, raw: AdminReviewModerate) {
    const input = validateWorkflow(adminReviewModerateSchema, raw),
      actor = await this.authorize(claims);
    await this.limiter.hit("admin-reviews", actor.id, 10, 900);
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
          const vetId = await this.repo.vetId(id, tx);
          if (!vetId) throw new EntityNotFoundException("ConsultationReview");
          await this.profiles.lockReviewFence(vetId, tx);
          await this.repo.lock(id, tx);
          const current = await this.repo.detail(id, tx);
          if (!current) throw new EntityNotFoundException("ConsultationReview");
          if (current.revision !== input.expectedRevision) this.conflict();
          if (!current.allowedStatuses.includes(input.status)) this.unavailable();
          await this.repo.moderate(id, input.status, claims.sub, input.reason, tx);
          await this.profiles.recomputeRatingAggregates(vetId, tx);
          await this.audit.record({userId:claims.sub,entityType:"ConsultationReview",entityId:id,action:"ADMIN_REVIEW_MODERATED",traceId:randomUUID(),oldValues:{moderationStatus:current.moderationStatus},newValues:{moderationStatus:input.status,reason:input.reason}},tx);
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
