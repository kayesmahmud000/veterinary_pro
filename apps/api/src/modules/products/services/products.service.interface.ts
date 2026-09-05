import {
  CreateProductRequestDto,
  PaginationMeta,
  ProductListItemDto,
  ProductQueryFilterDto,
  ProductResponseDto,
  UpdateProductRequestDto,
} from "@vetralink/shared-types";

export interface IProductsService {
  createProduct(
    dto: CreateProductRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto>;

  updateProduct(
    id: string,
    dto: UpdateProductRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto>;

  getProductById(
    id: string,
    includeUnpublished?: boolean,
    includeAssetKey?: boolean
  ): Promise<ProductResponseDto>;

  getProductBySlug(
    slug: string,
    includeUnpublished?: boolean,
    includeAssetKey?: boolean
  ): Promise<ProductResponseDto>;

  listProducts(
    filter: ProductQueryFilterDto,
    includeUnpublished?: boolean
  ): Promise<{ items: ProductListItemDto[]; meta: PaginationMeta }>;

  deleteProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<void>;

  publishProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto>;

  unpublishProduct(
    id: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<ProductResponseDto>;
}

export const PRODUCTS_SERVICE = "PRODUCTS_SERVICE";
