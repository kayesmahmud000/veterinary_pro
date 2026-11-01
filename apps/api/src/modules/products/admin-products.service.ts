import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Product } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  isProductAssetReady,
  AdminProductAction,
  AdminProductCreate,
  AdminProductEdit,
  AdminProductQuery,
  adminProductSchema,
  adminProductActionSchema,
  adminProductCreateSchema,
  adminProductEditSchema,
  adminProductQuerySchema,
  JwtPayload,
  UserRole,
  readCourseThumbnail,
} from "@vetralink/shared-types";
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
import { validateWorkflow } from "../../common/utils/validate-workflow";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { AdminProductsRepository } from "./admin-products.repository";
export const projectAdminProduct = (
  row: Product & {
    _count?: { courseLessons: number; courseEnrollments: number };
    courseLessons?: Array<{ youtubeVideoId: string }>;
  },
) =>
  adminProductSchema.parse(
    JSON.parse(
      JSON.stringify({
        ...row,
        thumbnailUrl: readCourseThumbnail(row.metadata),
        previewImageUrl: row.courseLessons?.[0]
          ? `https://i.ytimg.com/vi/${row.courseLessons[0].youtubeVideoId}/hqdefault.jpg`
          : null,
        lessonCount: row._count?.courseLessons,
        enrollmentCount: row._count?.courseEnrollments,
      }),
    ),
  );
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly repo: AdminProductsRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  async authorize(claims: JwtPayload, tx?: Prisma.TransactionClient) {
    const user = tx
      ? await this.users.lockById(claims.sub, tx)
      : await this.users.findById(claims.sub);
    if (
      !user?.isActive() ||
      ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role) ||
      (claims.authorizationVersion !== undefined &&
        user.authorizationVersion !== claims.authorizationVersion)
    )
      throw new ForbiddenOperationException(
        "Current administrative identity required.",
      );
    return user;
  }
  async list(claims: JwtPayload, input: AdminProductQuery) {
    await this.authorize(claims);
    const q = validateWorkflow(adminProductQuerySchema, input),
      page = await this.repo.list(q);
    return { ...page, items: page.items.map(projectAdminProduct) };
  }
  async detail(claims: JwtPayload, id: string) {
    await this.authorize(claims);
    const row = await this.repo.detail(id);
    if (!row) throw new EntityNotFoundException("Product");
    return projectAdminProduct(row);
  }
  async locked(id: string, version: number, tx: Prisma.TransactionClient) {
    const row = await this.repo.lock(id, tx);
    if (!row) throw new EntityNotFoundException("Product");
    if (row.version !== version)
      throw new WorkflowException(
        "PRODUCT_VERSION_CONFLICT",
        "Product changed. Reload and review.",
      );
    return row;
  }
  private async record(
    claims: JwtPayload,
    row: Product,
    action: string,
    tx: Prisma.TransactionClient,
    reason?: string,
  ) {
    await this.audit.record(
      {
        userId: claims.sub,
        entityType: "Product",
        entityId: row.id,
        action,
        traceId: randomUUID(),
        newValues: {
          version: row.version,
          isPublished: row.isPublished,
          ...(reason ? { reason } : {}),
        },
      },
      tx,
    );
    return projectAdminProduct(row);
  }
  async create(claims: JwtPayload, raw: AdminProductCreate) {
    const input = validateWorkflow(adminProductCreateSchema, raw);
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      const row = await this.repo.create(input, tx);
      return this.record(claims, row, "PRODUCT_CREATED", tx);
    });
  }
  async edit(claims: JwtPayload, id: string, raw: AdminProductEdit) {
    const { expectedVersion, thumbnailUrl, ...input } = validateWorkflow(
      adminProductEditSchema,
      raw,
    );
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      const current = await this.locked(id, expectedVersion, tx);
      // The edit transport has no type; enforce unchanged non-course rules after lookup.
      if (current.type !== "VIDEO_COURSE" || current.contentProvider !== "YOUTUBE")
        validateWorkflow(adminProductCreateSchema, { ...input, type: current.type, contentProvider: current.contentProvider });
      if (
        current.isPublished &&
        current.contentProvider === "YOUTUBE" &&
        (input.priceCents !== 0 || input.discountPriceCents !== null)
      )
        throw new WorkflowException(
          "INVALID_YOUTUBE_PRICING",
          "YouTube courses require free enrollment.",
          400,
        );
      const meta =
        current?.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const row = await this.repo.save(
        id,
        {
          ...input,
          metadata: {
            ...meta,
            adminManaged: true,
            ...(thumbnailUrl !== undefined
              ? { courseThumbnailUrl: thumbnailUrl }
              : {}),
          },
        },
        tx,
      );
      return this.record(claims, row, "PRODUCT_UPDATED", tx);
    });
  }
  async action(claims: JwtPayload, id: string, raw: AdminProductAction) {
    const input = validateWorkflow(adminProductActionSchema, raw);
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      const current = await this.locked(id, input.expectedVersion, tx);
      if (input.action === "PUBLISH") {
        if (
          current.contentProvider === "YOUTUBE" &&
          (current.priceCents !== 0 || current.discountPriceCents !== null)
        )
          throw new WorkflowException(
            "PAID_COURSE_NOT_ENABLED",
            "Paid courses can be prepared as drafts. Publication and enrollment are not enabled.",
          );
        const lessons =
          current.contentProvider === "YOUTUBE"
            ? await this.repo.lessons(id, tx)
            : [];
        if (
          !isProductAssetReady(
            current,
            lessons.filter((lesson) => lesson.access === "ENROLLED").length,
          )
        )
          throw new WorkflowException(
            "ASSET_NOT_READY",
            "Save a ready asset or a free course curriculum with an enrolled lesson before publication.",
          );
      }
      const data =
        input.action === "DELETE"
          ? { deletedAt: new Date(), isPublished: false }
          : { isPublished: input.action === "PUBLISH" };
      const meta =
        current.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const row = await this.repo.save(
        id,
        { ...data, metadata: { ...meta, adminManaged: true } },
        tx,
      );
      return this.record(
        claims,
        row,
        input.action === "DELETE"
          ? "PRODUCT_DELETED"
          : input.action === "PUBLISH"
            ? "PRODUCT_PUBLISHED"
            : "PRODUCT_UNPUBLISHED",
        tx,
        input.reason,
      );
    });
  }
  async manage(
    claims: JwtPayload,
    current: Product,
    tx: Prisma.TransactionClient,
  ) {
    const meta =
      current.metadata &&
      typeof current.metadata === "object" &&
      !Array.isArray(current.metadata)
        ? current.metadata
        : {};
    if (meta.adminManaged === true) return current;
    const row = await this.repo.save(
      current.id,
      { metadata: { ...meta, adminManaged: true } },
      tx,
    );
    await this.record(claims, row, "PRODUCT_MANAGEMENT_STARTED", tx);
    return row;
  }
  async attach(
    claims: JwtPayload,
    id: string,
    expectedVersion: number,
    asset: { id: string; key: string; productId: string; type: string },
  ) {
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      const current = await this.locked(id, expectedVersion, tx);
      if (
        current.contentProvider === "YOUTUBE" ||
        current.isPublished ||
        asset.productId !== id ||
        asset.type !== current.type
      )
        throw new WorkflowException(
          "ASSET_NOT_READY",
          "Unpublish the matching product before replacing its asset.",
        );
      const metadata =
        current.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const row = await this.repo.save(
        id,
        {
          contentS3Key: asset.key,
          metadata: {
            ...metadata,
            adminManaged: true,
            adminUploadId: asset.id,
          },
        },
        tx,
      );
      return this.record(claims, row, "PRODUCT_ASSET_ATTACHED", tx);
    });
  }
}
