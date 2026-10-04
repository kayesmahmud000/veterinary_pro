import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ProductSortBy,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductEntity } from "../entities/product.entity";
import {
  IProductRepository,
  ProductRepositoryFilter,
} from "./product.repository.interface";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class ProductRepository implements IProductRepository {
  private readonly logger = new Logger(ProductRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    product: ProductEntity,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity> {
    const client = tx ?? this.prisma;

    try {
      const created = await client.product.create({
        data: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          type: product.type,
          description: product.description,
          priceCents: product.priceCents,
          discountPriceCents: product.discountPriceCents,
          currency: product.currency,
          contentS3Key: product.contentS3Key,
          minSubscriptionTier: product.minSubscriptionTier,
          isPublished: product.isPublished,
          metadata: product.metadata as Prisma.InputJsonValue,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          deletedAt: product.deletedAt,
        },
      });

      return this.toEntity(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          `Product slug '${product.slug}' already exists.`,
          "slug"
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findBySlug(
    slug: string,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity | null> {
    const client = tx ?? this.prisma;

    const row = await client.product.findFirst({
      where: {
        slug: slug.toLowerCase().trim(),
        deletedAt: null,
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async findMany(
    filter: ProductRepositoryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ products: ProductEntity[]; total: number }> {
    const client = tx ?? this.prisma;

    const andConditions: Prisma.ProductWhereInput[] = [];

    // Search query: multi-word keyword tokenization
    if (filter.search && filter.search.trim()) {
      const cleanSearch = filter.search.trim();
      const words = cleanSearch.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        for (const word of words) {
          andConditions.push({
            OR: [
              { title: { contains: word, mode: "insensitive" } },
              { description: { contains: word, mode: "insensitive" } },
            ],
          });
        }
      } else {
        andConditions.push({
          OR: [
            { title: { contains: cleanSearch, mode: "insensitive" } },
            { description: { contains: cleanSearch, mode: "insensitive" } },
          ],
        });
      }
    }

    // Min price condition (effective price = coalesce(discountPriceCents, priceCents))
    if (filter.minPriceCents !== undefined) {
      andConditions.push({
        OR: [
          {
            discountPriceCents: { gte: filter.minPriceCents },
          },
          {
            discountPriceCents: null,
            priceCents: { gte: filter.minPriceCents },
          },
        ],
      });
    }

    // Max price condition (effective price = coalesce(discountPriceCents, priceCents))
    if (filter.maxPriceCents !== undefined) {
      andConditions.push({
        OR: [
          {
            discountPriceCents: { lte: filter.maxPriceCents },
          },
          {
            discountPriceCents: null,
            priceCents: { lte: filter.maxPriceCents },
          },
        ],
      });
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: filter.includeDeleted ? undefined : null,
      ...(filter.type && { type: filter.type }),
      ...(filter.minSubscriptionTier && {
        minSubscriptionTier: filter.minSubscriptionTier,
      }),
      ...(filter.isPublished !== undefined && {
        isPublished: filter.isPublished,
      }),
      ...(andConditions.length > 0 && {
        AND: andConditions,
      }),
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput = {
      createdAt: "desc",
    };
    switch (filter.sortBy) {
      case ProductSortBy.PRICE_ASC:
        orderBy = { priceCents: "asc" };
        break;
      case ProductSortBy.PRICE_DESC:
        orderBy = { priceCents: "desc" };
        break;
      case ProductSortBy.TITLE_ASC:
        orderBy = { title: "asc" };
        break;
      case ProductSortBy.NEWEST:
      case ProductSortBy.RELEVANCE:
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const [rows, total] = await Promise.all([
      client.product.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy,
      }),
      client.product.count({ where }),
    ]);

    return {
      products: rows.map((r) => this.toEntity(r)),
      total,
    };
  }

  public async update(
    product: ProductEntity,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity> {
    const client = tx ?? this.prisma;

    try {
      const updated = await client.product.update({
        where: { id: product.id },
        data: {
          title: product.title,
          slug: product.slug,
          type: product.type,
          description: product.description,
          priceCents: product.priceCents,
          discountPriceCents: product.discountPriceCents,
          currency: product.currency,
          contentS3Key: product.contentS3Key,
          minSubscriptionTier: product.minSubscriptionTier,
          isPublished: product.isPublished,
          metadata: product.metadata as Prisma.InputJsonValue,
          updatedAt: product.updatedAt,
          deletedAt: product.deletedAt,
        },
      });

      return this.toEntity(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          `Product slug '${product.slug}' already exists.`,
          "slug"
        );
      }
      throw error;
    }
  }

  public async softDelete(
    id: string,
    deletedAt = new Date(),
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.product.update({
      where: { id },
      data: {
        deletedAt,
        updatedAt: deletedAt,
      },
    });
  }

  public async existsBySlug(
    slug: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const client = tx ?? this.prisma;

    const count = await client.product.count({
      where: {
        slug: slug.toLowerCase().trim(),
        deletedAt: null,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    return count > 0;
  }

  private toEntity(
    row: Prisma.ProductGetPayload<Record<string, never>>
  ): ProductEntity {
    return ProductEntity.reconstitute({
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type as ProductType,
      description: row.description,
      priceCents: row.priceCents,
      discountPriceCents: row.discountPriceCents,
      currency: row.currency,
      contentS3Key: row.contentS3Key,
      minSubscriptionTier: row.minSubscriptionTier as SubscriptionTier,
      isPublished: row.isPublished,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
