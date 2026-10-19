import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  JwtPayload,
  UserRole,
  EditorialCreate,
  EditorialSave,
  EditorialAction,
  EditorialQuery,
  NotificationQuery,
  NotificationRetry,
  CommunicationsQuery,
  SupportQuery,
  SupportCreate,
  SupportReply,
  SupportAction,
  editorialCreateSchema,
  editorialSaveSchema,
  editorialActionSchema,
  editorialQuerySchema,
  notificationQuerySchema,
  notificationRetrySchema,
  supportQuerySchema,
  supportCreateSchema,
  supportReplySchema,
  supportActionSchema,
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
import { CommunicationsRepository } from "./communications.repository";

const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
const reservedSlugs = new Set([
  "one-place-for-farm-notes",
  "a-weekly-farm-review",
  "prepare-an-animal-record-summary",
  "demo-rafiq-hasan",
  "demo-nadia-rahman",
  "animal-records",
  "daily-milk-log",
  "farm-finances",
  "about",
  "help",
]);
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly repo: CommunicationsRepository,
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
    admin: boolean,
  ): asserts user is UserEntity {
    if (
      !user?.isActive() ||
      user.role !== claims.role ||
      user.authorizationVersion !== (claims.authorizationVersion ?? 0) ||
      (admin && !adminRoles.includes(user.role))
    )
      throw new ForbiddenOperationException(
        "Current authorized identity required.",
      );
  }
  private async authorize(claims: JwtPayload, admin = true) {
    if (!claims?.sub) throw new UnauthorizedDomainException();
    const user = await this.users.findById(claims.sub);
    this.assert(user, claims, admin);
    return user;
  }
  private conflict(): never {
    throw new WorkflowException(
      "COMMUNICATION_CONFLICT",
      "Changed or unavailable. Reload and review.",
    );
  }
  private async write<T>(
    claims: JwtPayload,
    admin: boolean,
    password: string | undefined,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    const actor = await this.authorize(claims, admin);
    await this.limiter.hit(
      admin ? "admin-communications" : "support-tickets",
      actor.id,
      admin ? 30 : 15,
      900,
    );
    if (
      password !== undefined &&
      !(await this.passwords.compare(password, actor.passwordHash))
    )
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    try {
      return await this.transactions.run(
        async (tx) => {
          const current = await this.users.lockById(actor.id, tx);
          this.assert(current, claims, admin);
          if (current.passwordHash !== actor.passwordHash)
            throw new ForbiddenOperationException("Session changed.");
          return fn(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const e = error as { code?: string; meta?: { code?: string } };
      if (
        ["P2002", "P2034"].includes(e?.code ?? "") ||
        ["40001", "40P01"].includes(e?.meta?.code ?? "")
      )
        this.conflict();
      throw error;
    }
  }
  private record(
    claims: JwtPayload,
    entityType: string,
    entityId: string,
    action: string,
    values: Record<string, string | number | boolean | null>,
    tx: Prisma.TransactionClient,
  ) {
    return this.audit.record(
      {
        userId: claims.sub,
        entityType,
        entityId,
        action,
        traceId: randomUUID(),
        newValues: values,
      },
      tx,
    );
  }
  async listContent(claims: JwtPayload, raw: EditorialQuery) {
    await this.authorize(claims);
    return this.repo.contentList(validateWorkflow(editorialQuerySchema, raw));
  }
  publicList(kind: string, query: CommunicationsQuery) {
    return this.repo.publicList(kind, query);
  }
  async publicContent(kind: string, slug: string) {
    const value = await this.repo.publicContent(kind, slug);
    if (!value) throw new EntityNotFoundException("PublishedContent");
    return value;
  }
  async content(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    return this.transactions.run(
      async (tx) => {
        const r = await this.repo.content(id, tx);
        if (!r) throw new EntityNotFoundException("EditorialDocument");
        return r;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private async eligibleVet(id: string, tx: Prisma.TransactionClient) {
    const subject = await this.repo.vetEligibility(id, tx);
    if (
      !subject ||
      subject.role !== "VET" ||
      subject.status !== "ACTIVE" ||
      subject.deletedAt ||
      !subject.vetProfile?.licenseNumber?.trim()
    )
      throw new WorkflowException(
        "VET_VERIFICATION_REQUIRED",
        "An active licensed veterinary account is required.",
        422,
      );
    return subject;
  }
  async createContent(claims: JwtPayload, raw: EditorialCreate) {
    const input = validateWorkflow(editorialCreateSchema, raw);
    if (reservedSlugs.has(input.slug))
      throw new WorkflowException(
        "CONTENT_RESERVED_SLUG",
        "This authored route is reserved.",
        422,
      );
    return this.write(claims, true, undefined, async (tx) => {
      if (input.subjectUserId) await this.eligibleVet(input.subjectUserId, tx);
      await this.repo.createContent(input, tx);
      await this.record(
        claims,
        "EditorialDocument",
        input.id,
        "CONTENT_DRAFT_CREATED",
        { kind: input.kind, version: 1 },
        tx,
      );
      return (await this.repo.content(input.id, tx))!;
    });
  }
  async saveContent(claims: JwtPayload, id: string, raw: EditorialSave) {
    const input = validateWorkflow(editorialSaveSchema, raw);
    return this.write(claims, true, undefined, async (tx) => {
      await this.repo.lockContent(id, tx);
      if (
        !(await this.repo.saveContent(
          id,
          input.expectedVersion,
          input.draft,
          tx,
        ))
      )
        this.conflict();
      await this.record(
        claims,
        "EditorialDocument",
        id,
        "CONTENT_DRAFT_SAVED",
        { version: input.expectedVersion + 1 },
        tx,
      );
      return (await this.repo.content(id, tx))!;
    });
  }
  async actionContent(claims: JwtPayload, id: string, raw: EditorialAction) {
    const input = validateWorkflow(editorialActionSchema, raw);
    return this.write(claims, true, input.actorPassword, async (tx) => {
      // Lock subject before document, matching identity changes; recheck under serializable isolation.
      const initial = await this.repo.content(id, tx);
      if (!initial) throw new EntityNotFoundException("EditorialDocument");
      const subject =
        initial.subjectUserId && input.action === "PUBLISH"
          ? await this.eligibleVet(initial.subjectUserId, tx)
          : null;
      await this.repo.lockContent(id, tx);
      const row = await this.repo.content(id, tx);
      if (!row || row.version !== input.expectedVersion) this.conflict();
      if (input.action === "PUBLISH") {
        if ([row.draft.bn, row.draft.en].some((v) => !v.summary || !v.body))
          throw new WorkflowException(
            "CONTENT_INCOMPLETE",
            "Both languages need summary and body before publication.",
            422,
          );
        if (row.kind === "VET" && (!input.verified || !input.verificationNote))
          throw new WorkflowException(
            "VET_VERIFICATION_REQUIRED",
            "Record qualification verification before publication.",
            422,
          );
        if (
          row.published &&
          JSON.stringify(row.published) === JSON.stringify(row.draft) &&
          row.kind !== "VET"
        )
          this.conflict();
      } else if (!row.published) this.conflict();
      if (
        !(await this.repo.publishContent(
          id,
          row.version,
          input.action === "PUBLISH" ? row.draft : null,
          subject?.authorizationVersion ?? null,
          tx,
        ))
      )
        this.conflict();
      await this.record(
        claims,
        "EditorialDocument",
        id,
        input.action === "PUBLISH"
          ? "CONTENT_PUBLISHED"
          : "CONTENT_UNPUBLISHED",
        {
          version: row.version + 1,
          reason: input.reason,
          ...(row.kind === "VET" && input.action === "PUBLISH"
            ? { verified: true, verificationNote: input.verificationNote! }
            : {}),
        },
        tx,
      );
      return (await this.repo.content(id, tx))!;
    });
  }
  async notifications(claims: JwtPayload, raw: NotificationQuery) {
    await this.authorize(claims);
    return this.repo.notificationList(
      validateWorkflow(notificationQuerySchema, raw),
    );
  }
  async retry(claims: JwtPayload, id: string, raw: NotificationRetry) {
    const input = validateWorkflow(notificationRetrySchema, raw);
    return this.write(claims, true, input.actorPassword, async (tx) => {
      const result = await this.repo.retryNotification(
        id,
        input.expectedGeneration,
        tx,
      );
      if (!result) this.conflict();
      await this.record(
        claims,
        "RoleNotificationDelivery",
        id,
        "ROLE_EMAIL_RETRY_REQUESTED",
        { reason: input.reason, generation: result.generation },
        tx,
      );
      return result;
    });
  }
  async listSupport(claims: JwtPayload, raw: SupportQuery, admin: boolean) {
    await this.authorize(claims, admin);
    return this.repo.supportList(
      validateWorkflow(supportQuerySchema, raw),
      admin ? undefined : claims.sub,
    );
  }
  async support(claims: JwtPayload, id: string, admin: boolean) {
    await this.authorize(claims, admin);
    return this.transactions.run(
      async (tx) => {
        const r = await this.repo.support(
          id,
          tx,
          admin ? undefined : claims.sub,
        );
        if (!r) throw new EntityNotFoundException("SupportTicket");
        return r;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async createSupport(claims: JwtPayload, raw: SupportCreate) {
    const input = validateWorkflow(supportCreateSchema, raw);
    return this.write(claims, false, undefined, async (tx) => {
      if (!(await this.repo.supportLinks(claims.sub, input, tx)))
        throw new WorkflowException(
          "SUPPORT_LINK_FORBIDDEN",
          "Related record is unavailable for this account.",
          403,
        );
      await this.repo.createSupport(claims.sub, input, tx);
      await this.record(
        claims,
        "SupportTicket",
        input.id,
        "SUPPORT_TICKET_CREATED",
        { version: 1, category: input.category },
        tx,
      );
      return (await this.repo.support(input.id, tx, claims.sub))!;
    });
  }
  async replySupport(claims: JwtPayload, id: string, raw: SupportReply) {
    const input = validateWorkflow(supportReplySchema, raw);
    return this.write(claims, false, undefined, async (tx) => {
      await this.repo.lockSupport(id, tx);
      const row = await this.repo.support(id, tx, claims.sub);
      if (!row) throw new EntityNotFoundException("SupportTicket");
      if (row.status === "CLOSED" || row.version !== input.expectedVersion)
        this.conflict();
      if (!(await this.repo.updateSupport(id, row.version, {}, tx)))
        this.conflict();
      await this.repo.supportMessage(
        input.messageId,
        id,
        claims.sub,
        input.body,
        false,
        tx,
      );
      await this.record(
        claims,
        "SupportTicket",
        id,
        "SUPPORT_MESSAGE_ADDED",
        { version: row.version + 1, internal: false },
        tx,
      );
      return (await this.repo.support(id, tx, claims.sub))!;
    });
  }
  async actionSupport(claims: JwtPayload, id: string, raw: SupportAction) {
    const input = validateWorkflow(supportActionSchema, raw);
    return this.write(claims, true, input.actorPassword, async (tx) => {
      if (input.action === "ASSIGN" && input.assigneeId) {
        const assignee = await this.users.lockById(input.assigneeId, tx);
        if (!assignee?.isActive() || !adminRoles.includes(assignee.role))
          throw new ForbiddenOperationException(
            "Active administrative assignee required.",
          );
      }
      await this.repo.lockSupport(id, tx);
      const row = await this.repo.support(id, tx);
      if (!row) throw new EntityNotFoundException("SupportTicket");
      if (
        row.version !== input.expectedVersion ||
        (input.action === "REPLY" && row.status === "CLOSED") ||
        (input.action === "STATUS" && row.status === input.status) ||
        (input.action === "ASSIGN" &&
          (await this.repo.supportAssignment(id, tx)) === input.assigneeId)
      )
        this.conflict();
      const change =
        input.action === "ASSIGN"
          ? { assigneeId: input.assigneeId }
          : input.action === "STATUS"
            ? { status: input.status }
            : {};
      if (!(await this.repo.updateSupport(id, row.version, change, tx)))
        this.conflict();
      if (input.action === "REPLY")
        await this.repo.supportMessage(
          input.messageId!,
          id,
          claims.sub,
          input.body!,
          input.internal!,
          tx,
        );
      await this.record(
        claims,
        "SupportTicket",
        id,
        "SUPPORT_ADMIN_UPDATED",
        {
          version: row.version + 1,
          action: input.action,
          reason: input.reason,
          ...(input.action === "REPLY"
            ? { internal: input.internal! }
            : input.action === "STATUS"
              ? { status: input.status! }
              : { assigneeId: input.assigneeId ?? null }),
        },
        tx,
      );
      return (await this.repo.support(id, tx))!;
    });
  }
}
