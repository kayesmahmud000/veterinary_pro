import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CreateProductRequestDto,
  PaginationMeta,
  ProductListItemDto,
  ProductQueryFilterDto,
  ProductResponseDto,
  UpdateProductRequestDto,
} from "@vetralink/shared-types";
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from "../repositories/product.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { ProductEntity } from "../entities/product.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";
import { IProductsService } from "./products.service.interface";

@Injectable()
export class ProductsService implements IProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager
  ) {}

  public async createProduct(
    dto: CreateProductRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto> {
    const rawSlug = dto.slug
      ? dto.slug.toLowerCase().trim()
      : ProductEntity.formatSlug(dto.title);

    const slugExists = await this.productRepository.existsBySlug(rawSlug);
    if (slugExists) {
      throw new EntityConflictException(
        `Product with slug '${rawSlug}' already exists.`,
        "slug"
      );
    }

    const product = ProductEntity.create({
      title: dto.title,
      slug: rawSlug,
      type: dto.type,
      description: dto.description,
      priceCents: dto.priceCents,
      discountPriceCents: dto.discountPriceCents,
      currency: dto.currency,
      contentS3Key: dto.contentS3Key,
      minSubscriptionTier: dto.minSubscriptionTier,
      isPublished: dto.isPublished,
      metadata: dto.metadata,
    });

    const activeTraceId = traceId ?? crypto.randomUUID();

    let savedProduct!: ProductEntity;
    await this.transactionManager.run(async (tx) => {
      savedProduct = await this.productRepository.create(product, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "CREATE",
          entityType: "Product",
          entityId: savedProduct.id,
          newValues: savedProduct.toResponse(true) as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(`Created product '${savedProduct.title}' [${savedProduct.id}]`);
    return savedProduct.toResponse(true);
  }

  public async updateProduct(
    id: string,
    dto: UpdateProductRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new EntityNotFoundException("Product", id);
    }

    if (dto.slug && dto.slug.toLowerCase().trim() !== product.slug) {
      const slugExists = await this.productRepository.existsBySlug(
        dto.slug.toLowerCase().trim(),
        id
      );
      if (slugExists) {
        throw new EntityConflictException(
          `Product with slug '${dto.slug}' already exists.`,
          "slug"
        );
      }
    }

    const oldSnapshot = product.toResponse(true);

    if (
      dto.priceCents !== undefined ||
      dto.discountPriceCents !== undefined ||
      dto.currency !== undefined
    ) {
      product.updatePricing(
        dto.priceCents,
        dto.discountPriceCents,
        dto.currency
      );
    }

    product.updateDetails({
      title: dto.title,
      slug: dto.slug,
      description: dto.description,
      type: dto.type,
      minSubscriptionTier: dto.minSubscriptionTier,
      contentS3Key: dto.contentS3Key,
      metadata: dto.metadata,
    });

    if (dto.isPublished !== undefined) {
      dto.isPublished ? product.publish() : product.unpublish();
    }

    const activeTraceId = traceId ?? crypto.randomUUID();
    let updatedProduct!: ProductEntity;

    await this.transactionManager.run(async (tx) => {
      updatedProduct = await this.productRepository.update(product, tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "UPDATE",
          entityType: "Product",
          entityId: updatedProduct.id,
          oldValues: oldSnapshot as unknown as Record<string, unknown>,
          newValues: updatedProduct.toResponse(true) as unknown as Record<
            string,
            unknown
          >,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(`Updated product '${updatedProduct.title}' [${updatedProduct.id}]`);
    return updatedProduct.toResponse(true);
  }

  public async getProductById(
    id: string,
    includeUnpublished = false,
    includeAssetKey = false
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new EntityNotFoundException("Product", id);
    }

    if (!includeUnpublished && !product.isPublished) {
      throw new EntityNotFoundException("Product", id);
    }

    return product.toResponse(includeAssetKey);
  }

  public async getProductBySlug(
    slug: string,
    includeUnpublished = false,
    includeAssetKey = false
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) {
      throw new EntityNotFoundException("Product", slug);
    }

    if (!includeUnpublished && !product.isPublished) {
      throw new EntityNotFoundException("Product", slug);
    }

    return product.toResponse(includeAssetKey);
  }

  public async listProducts(
    filter: ProductQueryFilterDto,
    includeUnpublished = false
  ): Promise<{ items: ProductListItemDto[]; meta: PaginationMeta }> {
    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const isPublished = includeUnpublished ? filter.isPublished : true;

    const { products, total } = await this.productRepository.findMany({
      type: filter.type,
      minSubscriptionTier: filter.minSubscriptionTier,
      isPublished,
      search: filter.search,
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: products.map((p) => p.toListItem()),
      meta: {
        page,
        pageSize: limit,
        total,
        totalPages,
      },
    };
  }

  public async deleteProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<void> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new EntityNotFoundException("Product", id);
    }

    const oldSnapshot = product.toResponse(true);
    const activeTraceId = traceId ?? crypto.randomUUID();

    await this.transactionManager.run(async (tx) => {
      await this.productRepository.softDelete(id, new Date(), tx);
      await this.auditLogRepository.record(
        {
          userId: actorUserId,
          action: "DELETE",
          entityType: "Product",
          entityId: id,
          oldValues: oldSnapshot as unknown as Record<string, unknown>,
          traceId: activeTraceId,
        },
        tx
      );
    });

    this.logger.log(`Soft-deleted product [${id}]`);
  }

  public async publishProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto> {
    return this.updateProduct(id, { isPublished: true }, actorUserId, traceId);
  }

  public async unpublishProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto> {
    return this.updateProduct(id, { isPublished: false }, actorUserId, traceId);
  }
}
