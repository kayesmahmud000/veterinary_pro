import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  JwtPayload,
  CourseQuery,
  courseQuerySchema,
  courseLibraryQuerySchema,
  courseCardSchema,
  courseSchema,
  courseEnrollmentSchema,
  myCourseSchema,
  courseLibrarySchema,
  coursePlaybackSchema,
} from "@vetralink/shared-types";
import { CoursesRepository } from "./courses.repository";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../users/repositories/user.repository.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import {
  EntityNotFoundException,
  UnauthorizedDomainException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
type Outline = NonNullable<Awaited<ReturnType<CoursesRepository["published"]>>>;
@Injectable()
export class CoursesService {
  constructor(
    private readonly repo: CoursesRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  private async authorize(claims: JwtPayload, tx?: Prisma.TransactionClient) {
    const user = tx
      ? await this.users.lockById(claims.sub, tx)
      : await this.users.findById(claims.sub);
    if (
      !user?.isActive() ||
      (claims.authorizationVersion !== undefined &&
        claims.authorizationVersion !== user.authorizationVersion)
    )
      throw new UnauthorizedDomainException(
        "Current active identity required.",
      );
  }
  private card(row: Outline) {
    return courseCardSchema.parse({
      ...row,
      provider: "YOUTUBE",
      access: "FREE_ENROLLMENT",
      lessonCount: row.courseLessons.length,
      demoCount: row.courseLessons.filter((l) => l.access === "PUBLIC_DEMO")
        .length,
      firstLessonId:
        row.courseLessons.find((l) => l.access === "ENROLLED")?.id ?? null,
    });
  }
  private detail(row: Outline) {
    return courseSchema.parse({
      ...this.card(row),
      lessons: row.courseLessons,
    });
  }
  private async visible(key: { id?: string; slug?: string }) {
    const row = await this.repo.published(key);
    if (!row) throw new EntityNotFoundException("Course");
    return row;
  }
  async list(raw: CourseQuery) {
    const query = validateWorkflow(courseQuerySchema, raw),
      page = await this.repo.list(query);
    return { ...page, items: page.items.map((row) => this.card(row)) };
  }
  async bySlug(slug: string) {
    return this.detail(await this.visible({ slug }));
  }
  private enrollment(
    row: NonNullable<Awaited<ReturnType<CoursesRepository["membership"]>>>,
  ) {
    return courseEnrollmentSchema.parse({
      ...row,
      createdAt: row.createdAt.toISOString(),
    });
  }
  async myDetail(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    const row = await this.visible({ id }),
      membership = await this.repo.membership(claims.sub, id);
    return myCourseSchema.parse({
      ...this.detail(row),
      enrollment: membership ? this.enrollment(membership) : null,
    });
  }
  async enroll(claims: JwtPayload, id: string) {
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      if (!(await this.repo.lockPublished(id, tx)))
        throw new EntityNotFoundException("Course");
      const existing = await this.repo.membership(claims.sub, id, tx);
      if (existing) return this.enrollment(existing);
      const row = await this.repo.enroll(claims.sub, id, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          entityType: "CourseEnrollment",
          entityId: row.id,
          action: "COURSE_ENROLLED",
          traceId: randomUUID(),
          newValues: { productId: id },
        },
        tx,
      );
      return this.enrollment(row);
    });
  }
  async myCourses(claims: JwtPayload, raw: Omit<CourseQuery, "search">) {
    await this.authorize(claims);
    const page = await this.repo.library(
      claims.sub,
      validateWorkflow(courseLibraryQuerySchema, raw),
    );
    return courseLibrarySchema.parse({
      ...page,
      items: page.items.map((row) => ({
        ...this.card(row.product),
        enrollment: this.enrollment(row),
      })),
    });
  }
  private async playback(productId: string, lessonId: string, demo = false) {
    const row = await this.repo.lesson(productId, lessonId);
    if (!row || (demo && row.access !== "PUBLIC_DEMO"))
      throw new EntityNotFoundException("Lesson");
    return coursePlaybackSchema.parse({
      productId,
      lessonId,
      title: row.title,
      provider: "YOUTUBE",
      videoId: row.youtubeVideoId,
    });
  }
  async demoPlayback(productId: string, lessonId: string) {
    return this.playback(productId, lessonId, true);
  }
  async lessonPlayback(
    claims: JwtPayload,
    productId: string,
    lessonId: string,
  ) {
    await this.authorize(claims);
    await this.visible({ id: productId });
    if (!(await this.repo.membership(claims.sub, productId)))
      throw new WorkflowException(
        "COURSE_ENROLLMENT_REQUIRED",
        "Enroll in this course to continue.",
        403,
      );
    return this.playback(productId, lessonId);
  }
}
