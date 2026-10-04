import { Prisma } from "@prisma/client";
import {
  ProductSortBy,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { ProductEntity } from "../entities/product.entity";

export interface ProductRepositoryFilter {
  type?: ProductType;
  minSubscriptionTier?: SubscriptionTier;
  isPublished?: boolean;
  search?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortBy?: ProductSortBy;
  includeDeleted?: boolean;
  skip?: number;
  take?: number;
}

export interface IProductRepository {
  create(
    product: ProductEntity,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity>;

  findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity | null>;

  findBySlug(
    slug: string,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity | null>;

  findMany(
    filter: ProductRepositoryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ products: ProductEntity[]; total: number }>;

  update(
    product: ProductEntity,
    tx?: Prisma.TransactionClient
  ): Promise<ProductEntity>;

  softDelete(
    id: string,
    deletedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  existsBySlug(
    slug: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;
}

export const PRODUCT_REPOSITORY = "PRODUCT_REPOSITORY";
