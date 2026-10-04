import { ProductType, SubscriptionTier } from "../../enums/index.js";
import { ProductSortBy } from "./product-search.dto.js";

export interface CreateProductRequestDto {
  readonly title: string;
  readonly slug?: string;
  readonly type: ProductType;
  readonly description: string;
  readonly priceCents: number;
  readonly discountPriceCents?: number | null;
  readonly currency?: string;
  readonly contentS3Key: string;
  readonly minSubscriptionTier?: SubscriptionTier;
  readonly isPublished?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateProductRequestDto {
  readonly title?: string;
  readonly slug?: string;
  readonly type?: ProductType;
  readonly description?: string;
  readonly priceCents?: number;
  readonly discountPriceCents?: number | null;
  readonly currency?: string;
  readonly contentS3Key?: string;
  readonly minSubscriptionTier?: SubscriptionTier;
  readonly isPublished?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface ProductResponseDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly type: ProductType;
  readonly description: string;
  readonly priceCents: number;
  readonly discountPriceCents: number | null;
  readonly effectivePriceCents: number;
  readonly currency: string;
  readonly minSubscriptionTier: SubscriptionTier;
  readonly isPublished: boolean;
  readonly metadata: Record<string, unknown>;
  readonly contentS3Key?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductListItemDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly type: ProductType;
  readonly priceCents: number;
  readonly discountPriceCents: number | null;
  readonly effectivePriceCents: number;
  readonly currency: string;
  readonly minSubscriptionTier: SubscriptionTier;
  readonly isPublished: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ProductQueryFilterDto {
  readonly type?: ProductType;
  readonly minSubscriptionTier?: SubscriptionTier;
  readonly isPublished?: boolean;
  readonly search?: string;
  readonly minPriceCents?: number;
  readonly maxPriceCents?: number;
  readonly sortBy?: ProductSortBy;
  readonly page?: number;
  readonly limit?: number;
}
