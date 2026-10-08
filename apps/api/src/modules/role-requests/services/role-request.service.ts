import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  applicationSchemas,
  ProfessionalRole,
  RoleDecisionInput,
  roleDecisionSchema,
  SubmitRoleRequestInput,
  submitRoleRequestSchema,
  UserRole,
} from "@vetralink/shared-types";
import { validateWorkflow } from "../../../common/utils/validate-workflow";
import { randomUUID } from "crypto";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../../users/repositories/user.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../../prisma/interfaces/transaction.interface";
import { RoleRequestRepository } from "../repositories/role-request.repository";
import { RoleNotificationRepository } from "../../role-notifications/role-notification.repository";
import { canonicalHash } from "../../../common/utils/workflow";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../../common/exceptions/domain.exception";
import { UserEntity } from "../../users/entities/user.entity";
import { toAuthUserSummary } from "../../users/auth-user-summary";
import { WorkflowRateLimiter } from "../../../common/security/workflow-rate-limiter";

export function ownRoleRequest(row: any) {
  return {
    id: row.id,
    applicantUserId: row.applicantUserId,
    targetRole: row.targetRole,
    status: row.status,
    questionnaireVersion: row.questionnaireVersion,
    answers: row.answers,
    locale: row.locale,
    requestVersion: row.requestVersion,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    publicDecisionReason: row.publicDecisionReason,
  };
}
@Injectable()
export class RoleRequestService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    private readonly requests: RoleRequestRepository,
    private readonly events: RoleNotificationRepository,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  private reviewer(user: UserEntity | null) {
    if (
      !user?.isActive() ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)
    )
      throw new ForbiddenOperationException();
  }
  async submit(userId: string, input: SubmitRoleRequestInput) {
    input = validateWorkflow(submitRoleRequestSchema, input);
    const answers = validateWorkflow(
      applicationSchemas[input.targetRole] as any,
      input.answers,
    ) as Record<string, unknown>;
    const hash = canonicalHash({ ...input, answers });
    return this.transactions.run(async (tx) => {
      const user = await this.users.lockById(userId, tx);
      if (!user?.isActive()) throw new ForbiddenOperationException();
      const existing = await this.requests.findKey(
        userId,
        input.submissionKey,
        tx,
      );
      if (existing) {
        if (existing.payloadHash !== hash)
          throw new WorkflowException(
            "SUBMISSION_KEY_CONFLICT",
            "Submission key was used with different answers.",
          );
        return ownRoleRequest(existing);
      }
      if (user.role !== UserRole.LEARNER)
        throw new ForbiddenOperationException(
          "Only a Learner may request a professional role.",
        );
      if (await this.requests.pending(userId, tx))
        throw new WorkflowException(
          "ROLE_REQUEST_PENDING",
          "You already have a pending application.",
        );
      await this.limiter.hit("role-application", userId, 3, 86400);
      const request = await this.requests.create(
        userId,
        input,
        hash,
        answers as Prisma.InputJsonObject,
        tx,
      );
      await this.audit.record(
        {
          userId,
          action: "ROLE_REQUEST_SUBMITTED",
          entityType: "RoleUpgradeRequest",
          entityId: request.id,
          newValues: {
            targetRole: input.targetRole,
            questionnaireVersion: input.questionnaireVersion,
          },
          traceId: randomUUID(),
        },
        tx,
      );
      await this.events.add(
        {
          eventKey: `request-${request.id}-submitted`,
          eventType: "ROLE_REQUEST_SUBMITTED",
          requestId: request.id,
          targetUserId: userId,
          locale: input.locale,
        },
        tx,
      );
      return ownRoleRequest(request);
    });
  }
  async mine(userId: string, filter: any) {
    const { rows, nextCursor } = await this.requests.list({
      ...filter,
      userId,
    });
    return { requests: rows.map(ownRoleRequest), nextCursor };
  }
  async own(userId: string, id: string) {
    const row = await this.requests.find(id);
    if (!row || row.applicantUserId !== userId)
      throw new EntityNotFoundException("Role request");
    return ownRoleRequest(row);
  }
  async queue(actorId: string, filter: any) {
    this.reviewer(await this.users.findById(actorId));
    const { rows, nextCursor } = await this.requests.list(filter);
    return {
      requests: rows.map((r) => ({
        id: r.id,
        targetRole: r.targetRole,
        status: r.status,
        submittedAt: r.submittedAt.toISOString(),
        applicant: {
          id: r.applicant.id,
          name: r.applicant.name,
          email: r.applicant.email,
        },
      })),
      nextCursor,
    };
  }
  async detail(actorId: string, id: string) {
    this.reviewer(await this.users.findById(actorId));
    const row = await this.requests.find(id);
    if (!row) throw new EntityNotFoundException("Role request");
    const user = await this.users.findById(row.applicantUserId, {
      includeDeleted: true,
    });
    if (!user) throw new EntityNotFoundException("Applicant");
    return {
      request: {
        ...ownRoleRequest(row),
        privateReviewNote: row.privateReviewNote,
        qualificationVerificationNote: row.qualificationVerificationNote,
      },
      applicant: { ...toAuthUserSummary(user), isDeleted: user.isDeleted() },
      history: (await this.mine(user.id, { limit: 20 })).requests,
    };
  }
  async decide(actorId: string, id: string, input: RoleDecisionInput) {
    input = validateWorkflow(roleDecisionSchema, input);
    const found = await this.requests.find(id);
    if (!found) throw new EntityNotFoundException("Role request");
    if (found.applicantUserId === actorId)
      throw new ForbiddenOperationException("Self-review is prohibited.");
    return this.transactions.run(async (tx) => {
      const locked = new Map<string, UserEntity | null>();
      for (const uid of [actorId, found.applicantUserId].sort())
        locked.set(uid, await this.users.lockById(uid, tx));
      this.reviewer(locked.get(actorId)!);
      const applicant = locked.get(found.applicantUserId);
      const request = await this.requests.lock(id, tx);
      if (
        !request ||
        request.status !== "PENDING" ||
        request.requestVersion !== input.expectedRequestVersion
      )
        throw new WorkflowException(
          "ROLE_REQUEST_ALREADY_DECIDED",
          "Request changed. Reload before deciding.",
        );
      if (
        !applicant?.isActive() ||
        applicant.role !== UserRole.LEARNER ||
        applicant.roleVersion !== input.expectedApplicantRoleVersion
      )
        throw new WorkflowException(
          "APPLICANT_INELIGIBLE",
          "Applicant permissions or account state changed.",
        );
      if (input.decision === "APPROVED") {
        if (
          request.targetRole === ProfessionalRole.VET &&
          !input.qualificationVerificationNote
        )
          throw new WorkflowException(
            "VET_VERIFICATION_REQUIRED",
            "Record qualification verification before approval.",
            422,
          );
        applicant.changeRole(request.targetRole as unknown as UserRole);
        await this.users.saveRole(
          applicant,
          input.expectedApplicantRoleVersion,
          tx,
        );
        if (request.targetRole === ProfessionalRole.VET)
          await this.requests.initializeVet(applicant.id, request.answers, tx);
      }
      const decided = await this.requests.decide(id, actorId, input, tx);
      await this.audit.record(
        {
          userId: actorId,
          action: `ROLE_REQUEST_${input.decision}`,
          entityType: "RoleUpgradeRequest",
          entityId: id,
          oldValues: { status: "PENDING", role: UserRole.LEARNER },
          newValues: {
            status: decided.status,
            role: applicant.role,
            roleVersion: applicant.roleVersion,
          },
          traceId: randomUUID(),
        },
        tx,
      );
      await this.events.add(
        {
          eventKey: `request-${id}-${decided.requestVersion}`,
          eventType: `ROLE_REQUEST_${input.decision}`,
          requestId: id,
          targetUserId: applicant.id,
          locale: request.locale,
          authorizationVersion: applicant.authorizationVersion,
        },
        tx,
      );
      return {
        request: ownRoleRequest(decided),
        applicant: toAuthUserSummary(applicant),
      };
    });
  }
}
