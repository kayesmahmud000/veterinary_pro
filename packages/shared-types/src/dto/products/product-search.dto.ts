import { ProductType, SubscriptionTier } from "../../enums/index.js";

export enum ProductSortBy {
  RELEVANCE = "relevance",
  NEWEST = "newest",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
  TITLE_ASC = "title_asc",
}

export interface ProductSearchQueryRequestDto {
  readonly q?: string;
  readonly type?: ProductType;
  readonly minSubscriptionTier?: SubscriptionTier;
  readonly minPriceCents?: number;
  readonly maxPriceCents?: number;
  readonly sortBy?: ProductSortBy;
  readonly page?: number;
  readonly limit?: number;
}
