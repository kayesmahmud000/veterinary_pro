import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  AdminCurriculumWrite,
  adminCurriculumSchema,
  adminCurriculumWriteSchema,
  JwtPayload,
  normalizeYouTubeVideoId,
} from "@vetralink/shared-types";
import { AdminProductsRepository } from "./admin-products.repository";
import { AdminProductsService } from "./admin-products.service";
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
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
@Injectable()
export class AdminCourseCurriculumService {
  constructor(
    private readonly repo: AdminProductsRepository,
    private readonly catalog: AdminProductsService,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  private check(product: { contentProvider: string }) {
    if (product.contentProvider !== "YOUTUBE")
      throw new WorkflowException(
        "CONTENT_PROVIDER_MISMATCH",
        "This product does not use a YouTube curriculum.",
      );
  }
  async detail(claims: JwtPayload, id: string) {
    await this.catalog.authorize(claims);
    // Share a product lock with writes so version and lesson set are one snapshot.
    return this.transactions.run(async (tx) => {
      const product = await this.repo.lock(id, tx);
      if (!product) throw new EntityNotFoundException("Product");
      this.check(product);
      return adminCurriculumSchema.parse({
        productId: id,
        version: product.version,
        isPublished: product.isPublished,
        lessons: await this.repo.lessons(id, tx),
      });
    });
  }
  async replace(claims: JwtPayload, id: string, raw: AdminCurriculumWrite) {
    const input = validateWorkflow(adminCurriculumWriteSchema, raw);
    return this.transactions.run(async (tx) => {
      await this.catalog.authorize(claims, tx);
      const product = await this.catalog.locked(id, input.expectedVersion, tx);
      this.check(product);
      if (product.isPublished)
        throw new WorkflowException(
          "COURSE_MUST_BE_UNPUBLISHED",
          "Unpublish before changing lessons.",
        );
      const existing = new Set(
        (await this.repo.lessons(id, tx)).map((lesson) => lesson.id),
      );
      if (input.lessons.some((lesson) => lesson.id && !existing.has(lesson.id)))
        throw new WorkflowException(
          "INVALID_CURRICULUM",
          "A lesson no longer belongs to this curriculum.",
          400,
        );
      const lessons = await this.repo.replaceLessons(
        id,
        input.lessons.map((lesson, index) => ({
          id: lesson.id ?? randomUUID(),
          title: lesson.title,
          summary: lesson.summary,
          access: lesson.access,
          youtubeVideoId: normalizeYouTubeVideoId(lesson.videoUrl),
          position: index + 1,
        })),
        tx,
      );
      const saved = await this.repo.save(id, {}, tx);
      await this.audit.record(
        {
          userId: claims.sub,
          entityType: "Product",
          entityId: id,
          action: "COURSE_CURRICULUM_UPDATED",
          traceId: randomUUID(),
          newValues: { version: saved.version, lessonCount: lessons.length },
        },
        tx,
      );
      return adminCurriculumSchema.parse({
        productId: id,
        version: saved.version,
        isPublished: saved.isPublished,
        lessons,
      });
    });
  }
}
