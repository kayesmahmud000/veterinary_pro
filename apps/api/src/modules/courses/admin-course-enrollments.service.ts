import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, CourseEnrollment } from "@prisma/client";
import {
  JwtPayload,
  UserRole,
  AdminCourseEnrollmentQuery,
  AdminCourseCandidateQuery,
  AdminEnrollmentAddInput,
  AdminEnrollmentActionInput,
  AdminCourseUserCreateInput,
  adminCourseEnrollmentQuerySchema,
  adminUserCourseQuerySchema,
  adminCourseCandidateQuerySchema,
  adminEnrollmentAddSchema,
  adminEnrollmentActionSchema,
  adminCourseUserCreateSchema,
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
import { EnvService } from "../../config";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import {
  EntityConflictException,
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { AdminCourseEnrollmentsRepository } from "./admin-course-enrollments.repository";
import { CourseEnrollmentWriter } from "./course-enrollment-writer.service";
@Injectable()
export class AdminCourseEnrollmentsService {
  constructor(
    private readonly repo: AdminCourseEnrollmentsRepository,
    private readonly writer: CourseEnrollmentWriter,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly limiter: WorkflowRateLimiter,
    private readonly env: EnvService,
  ) {}
  private assert(
    actor: UserEntity | null,
    claims: JwtPayload,
  ): asserts actor is UserEntity {
    if (!this.env.adminCourseEnrollmentsEnabled)
      throw new WorkflowException(
        "ENROLLMENTS_UNAVAILABLE",
        "Enrollment management is unavailable.",
        503,
      );
    if (
      !actor?.isActive() ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(actor.role) ||
      (claims.authorizationVersion !== undefined &&
        claims.authorizationVersion !== actor.authorizationVersion)
    )
      throw new ForbiddenOperationException(
        "Current administrative identity required.",
      );
  }
  private async current(claims: JwtPayload) {
    const actor = await this.users.findById(claims.sub);
    this.assert(actor, claims);
    return actor;
  }
  private target(
    user: UserEntity | null,
    active: boolean,
  ): asserts user is UserEntity {
    if (!user || user.isDeleted()) throw new EntityNotFoundException("User");
    if (
      [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) ||
      (active && !user.isActive())
    )
      throw new ForbiddenOperationException(
        "This account cannot receive this membership action.",
      );
  }
  private async limit(
    scope: string,
    id: string,
    count: number,
    seconds: number,
  ) {
    if (this.env.redisEnabled === false)
      throw new WorkflowException(
        "RATE_LIMIT_UNAVAILABLE",
        "Distributed limits are unavailable.",
        503,
      );
    try {
      await this.limiter.hit(scope, id, count, seconds);
    } catch (error) {
      if (
        error instanceof WorkflowException &&
        error.errorCode === "RATE_LIMITED"
      )
        throw new WorkflowException(
          "RATE_LIMITED",
          "Too many attempts. Please retry later.",
          429,
          { retryAfter: seconds },
        );
      throw error;
    }
  }
  async list(c: JwtPayload, id: string, q: AdminCourseEnrollmentQuery) {
    await this.current(c);
    return this.repo.list(
      id,
      validateWorkflow(adminCourseEnrollmentQuerySchema, q),
    );
  }
  async userCourses(
    c: JwtPayload,
    id: string,
    q: Pick<AdminCourseEnrollmentQuery, "limit" | "cursor" | "status">,
  ) {
    await this.current(c);
    return this.repo.userCourses(
      id,
      validateWorkflow(adminUserCourseQuerySchema, q),
    );
  }
  async candidates(c: JwtPayload, id: string, q: AdminCourseCandidateQuery) {
    const actor = await this.current(c);
    await this.limit("course-candidates", actor.id, 60, 60);
    return this.repo.candidates(
      id,
      validateWorkflow(adminCourseCandidateQuerySchema, q),
    );
  }
  private async prepare(
    c: JwtPayload,
    input: { actorPassword: string },
    create = false,
  ) {
    const actor = await this.current(c);
    await this.limit("course-enrollment-write", actor.id, 30, 900);
    if (create) await this.limit("course-user-create", actor.id, 5, 900);
    if (
      !(await this.passwords.compare(input.actorPassword, actor.passwordHash))
    )
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return actor;
  }
  private async locked(
    c: JwtPayload,
    before: UserEntity,
    targetId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const users = new Map<string, UserEntity | null>();
    for (const id of [
      ...new Set([before.id, ...(targetId ? [targetId] : [])]),
    ].sort())
      users.set(id, await this.users.lockById(id, tx));
    const actor = users.get(before.id) ?? null;
    this.assert(actor, c);
    if (
      actor.passwordHash !== before.passwordHash ||
      actor.authorizationVersion !== before.authorizationVersion
    )
      throw new ForbiddenOperationException(
        "Administrative authorization changed.",
      );
    return targetId ? (users.get(targetId) ?? null) : actor;
  }
  private async run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.transactions.run(fn);
      } catch (e) {
        if (
          attempt < 2 &&
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === "P2034" ||
            (e.code === "P2010" && e.meta?.code === "40P01"))
        )
          continue;
        throw e;
      }
    }
  }
  private record(
    c: JwtPayload,
    courseId: string,
    userId: string,
    action: string,
    reason: string,
    old: CourseEnrollment | null,
    row: CourseEnrollment,
    tx: Prisma.TransactionClient,
  ) {
    return this.audit.record(
      {
        userId: c.sub,
        entityType: "CourseEnrollment",
        entityId: row.id,
        action,
        traceId: randomUUID(),
        oldValues: old
          ? { enrollmentStatus: old.status, enrollmentVersion: old.version }
          : undefined,
        newValues: {
          productId: courseId,
          targetUserId: userId,
          enrollmentStatus: row.status,
          enrollmentVersion: row.version,
          reason,
        },
      },
      tx,
    );
  }
  async add(c: JwtPayload, id: string, raw: AdminEnrollmentAddInput) {
    const input = validateWorkflow(adminEnrollmentAddSchema, raw),
      actor = await this.prepare(c, input);
    return this.run(async (tx) => {
      const user = await this.locked(c, actor, input.userId, tx);
      this.target(user, true);
      const ctx = await this.writer.lock(id, user.id, tx),
        result = await this.writer.activateLocked(ctx, "ADD", null, tx);
      if (result.changed)
        await this.record(
          c,
          id,
          user.id,
          "COURSE_ENROLLMENT_ADDED",
          input.reason,
          ctx.membership,
          result.enrollment,
          tx,
        );
      return {
        enrollment: this.repo.project(result.enrollment, user),
        changed: result.changed,
      };
    });
  }
  async act(
    c: JwtPayload,
    id: string,
    userId: string,
    raw: AdminEnrollmentActionInput,
  ) {
    const input = validateWorkflow(adminEnrollmentActionSchema, raw),
      actor = await this.prepare(c, input);
    return this.run(async (tx) => {
      const user = await this.locked(c, actor, userId, tx);
      this.target(user, input.action === "RESTORE");
      const ctx = await this.writer.lock(id, userId, tx);
      const result =
        input.action === "REMOVE"
          ? await this.writer.revokeLocked(
              ctx,
              actor.id,
              input.expectedVersion,
              tx,
            )
          : await this.writer.activateLocked(
              ctx,
              "RESTORE",
              input.expectedVersion,
              tx,
            );
      if (result.changed)
        await this.record(
          c,
          id,
          userId,
          input.action === "REMOVE"
            ? "COURSE_ENROLLMENT_REVOKED"
            : "COURSE_ENROLLMENT_RESTORED",
          input.reason,
          ctx.membership,
          result.enrollment,
          tx,
        );
      return {
        enrollment: this.repo.project(result.enrollment, user),
        changed: result.changed,
      };
    });
  }
  async createUserAndEnroll(
    c: JwtPayload,
    id: string,
    raw: AdminCourseUserCreateInput,
  ) {
    const input = validateWorkflow(adminCourseUserCreateSchema, raw),
      actor = await this.prepare(c, input, true),
      passwordHash = await this.passwords.hash(input.newUserPassword);
    try {
      return await this.run(async (tx) => {
        await this.locked(c, actor, undefined, tx);
        if (
          await this.users.findByEmail(
            input.email,
            { includeDeleted: true },
            tx,
          )
        )
          throw new WorkflowException(
            "ACCOUNT_EXISTS",
            "This email is already registered.",
            409,
          );
        const user = await this.users.create(
          UserEntity.create({
            name: input.name,
            email: input.email,
            passwordHash,
            role: UserRole.LEARNER,
            isEmailVerified: false,
          }),
          tx,
        );
        const ctx = await this.writer.lock(id, user.id, tx),
          result = await this.writer.activateLocked(ctx, "ADD", null, tx);
        await this.audit.record(
          {
            userId: actor.id,
            entityType: "User",
            entityId: user.id,
            action: "USER_CREATED_BY_ADMIN",
            traceId: randomUUID(),
            newValues: {
              role: UserRole.LEARNER,
              productId: id,
              reason: input.reason,
            },
          },
          tx,
        );
        await this.record(
          c,
          id,
          user.id,
          "COURSE_ENROLLMENT_ADDED",
          input.reason,
          null,
          result.enrollment,
          tx,
        );
        return {
          accountCreated: true as const,
          enrollment: this.repo.project(result.enrollment, user),
        };
      });
    } catch (e) {
      if (e instanceof EntityConflictException)
        throw new WorkflowException(
          "ACCOUNT_EXISTS",
          "This email is already registered.",
          409,
        );
      throw e;
    }
  }
}
