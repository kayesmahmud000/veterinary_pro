import { Inject, Injectable } from "@nestjs/common";
import { Prisma, Product } from "@prisma/client";
import { randomUUID } from "crypto";
import {
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
export const projectAdminProduct = (row: Product) =>
  adminProductSchema.parse(JSON.parse(JSON.stringify(row)));
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
    const { expectedVersion, ...input } = validateWorkflow(
      adminProductEditSchema,
      raw,
    );
    return this.transactions.run(async (tx) => {
      await this.authorize(claims, tx);
      const current = await this.locked(id, expectedVersion, tx);
      const meta =
        current?.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const row = await this.repo.save(
        id,
        { ...input, metadata: { ...meta, adminManaged: true } },
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
      if (
        input.action === "PUBLISH" &&
        (!current.contentS3Key ||
          (current.type === "VIDEO_COURSE" &&
            !current.contentS3Key.endsWith(".m3u8")))
      )
        throw new WorkflowException(
          "ASSET_NOT_READY",
          "Attach a ready asset before publication.",
        );
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
