# SPEC-306: Product Catalog Public Search with Full-Text Indexing & Filtering
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.6: Product catalog public search with full-text indexing and filtering
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

The VETRALINK PRO digital store and LMS marketplace offers veterinary professionals, commercial dairy managers, and livestock farmers a growing catalog of specialized digital assets, including:
- Doctor-verified video courses (`VIDEO_COURSE`)
- Clinical guides, herd health manuals, and deworming protocols (`EBOOK`)
- Feed formulation, lactation curve, and ROI financial spreadsheets (`EXCEL_TOOL`)

As catalog inventory expands, basic substring filtering (`contains`) fails to deliver relevant, typo-tolerant, or ranked results, suffers poor query performance without GIN indexes, and lacks multifaceted filtering (price ranges, subscription tiers, sorting modes).

**Task 3.6** introduces a high-performance **Public Product Catalog Search & Filtering Engine**:
1. **PostgreSQL Full-Text Search (FTS) with GIN Indexing**: Uses PostgreSQL `tsvector` and `tsquery` over `title` and `description` to enable stemming, language parsing (English), prefix matching, and relevance ranking (`ts_rank`).
2. **Multifaceted Filtering**: Supports filtering by:
   - `type`: Multi-type selection (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`)
   - `minSubscriptionTier`: Exact or ceiling tier access (`STARTER`, `PRO`, `ENTERPRISE`)
   - `minPriceCents` & `maxPriceCents`: Price window filtering
   - Free vs. paid indicators
3. **Multi-Mode Sorting**:
   - `relevance`: Weighted ranking matching title (weight 'A') higher than description (weight 'B')
   - `newest`: Chronological `createdAt DESC`
   - `price_asc` / `price_desc`: Price sorting (accounting for discount prices when active)
   - `title`: Alphabetical
4. **Public & Guest Accessible**: Unauthenticated guest farmers and visitors can search the published catalog without token barriers, with zero exposure of unpublished or soft-deleted products.

---

## 2. Current State vs. Proposed State

### Current State
- `ProductsController.listProducts` (`GET /api/v1/products`) accepts a basic `search` string and filters using Prisma `OR: [{ title: { contains } }, { description: { contains } }]`.
- Missing database full-text index (GIN / GiST). Queries do full table scans on text columns.
- No support for price range filtering (`minPriceCents`, `maxPriceCents`).
- No support for explicit sorting (`sortBy` / `sortOrder` defaults only to `createdAt desc`).
- No dedicated search endpoint (`GET /api/v1/products/search`) optimized for public storefront exploration.

### Proposed State
- **Database Index**: Add PostgreSQL GIN index migration for full-text search:
  `CREATE INDEX idx_products_fts ON products USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));`
- **Shared Types**: Add `ProductSearchQueryDto`, `ProductSortBy` enum (`RELEVANCE`, `NEWEST`, `PRICE_ASC`, `PRICE_DESC`, `TITLE_ASC`), and `ProductSearchFilterDto` to `@vetralink/shared-types`.
- **Repository Enhancement**: Extend `IProductRepository` and `ProductRepository` with full-text query matching using Prisma FTS `search` / parameterized `websearch_to_tsquery` or combined FTS + contains fallback, price range filtering, and dynamic sorting.
- **Service Layer**: Add `searchProducts` to `IProductsService` and `ProductsService` with validation, pagination envelope, and search query sanitization.
- **Controller Endpoints**:
  - `GET /api/v1/products/search`: Dedicated public search endpoint with multifaceted query parameters.
  - Enhanced `GET /api/v1/products`: Updated to support full-text search, price ranges, and sorting.

---

## 3. Architectural & Design Trade-Offs

### Trade-Off 1: External Search Engine (Elasticsearch/Meilisearch) vs. PostgreSQL Full-Text Search (GIN)
- **Option A (External Engine - Elasticsearch / Typesense / Meilisearch)**:
  - *Cons*: Additional infrastructure cluster to provision, monitor, and pay for; cross-system data synchronization pipeline required (CDC via Debezium or BullMQ sync); eventual consistency lag between product creation and search availability.
- **Option B (PostgreSQL Native Full-Text Search with GIN Index — Selected)**:
  - *Pros*: Zero infrastructure overhead; 100% ACID consistency (products instantly searchable upon commit); sub-millisecond query execution for catalogs up to hundreds of thousands of records; native support in PostgreSQL 16 with `to_tsvector` and `websearch_to_tsquery`.
  - *Verdict*: **Option B is selected**. As the catalog grows beyond 500,000 SKUs, an external engine can be plugged in via the Repository interface without changing domain or API contracts.

### Trade-Off 2: Prisma FullTextSearch Preview vs. Raw Parameterized SQL
- **Option A (Prisma `fullTextSearch` preview feature)**:
  - Prisma supports `title: { search: query }` when `previewFeatures = ["fullTextSearch"]` is enabled.
  - *Pros*: Native Prisma query syntax, type-safe filters.
  - *Cons*: In PostgreSQL, Prisma converts `search` to `to_tsquery('english', '...')` which throws runtime syntax errors if users enter unescaped characters like `:`, `&`, `!`, or single quotes.
- **Option B (Prisma FTS with Query Sanitization + Multi-Column GIN Fallback — Selected)**:
  - Sanitize user search inputs into valid tsquery tokens (or use `plainto_tsquery` format: terms separated by `&` with prefix `: *`), falling back gracefully to case-insensitive `contains` if the query is a partial fragment (< 3 chars).
  - *Verdict*: **Option B is selected** for robust error immunity and seamless user experience.

### Trade-Off 3: Price Filtering on Discount vs. Master Price
- When searching by price (e.g. `maxPriceCents = 2000`), a product with `priceCents = 3000` but `discountPriceCents = 1500` should match.
- The repository filter computes the effective price: `effectivePrice = coalesce(discountPriceCents, priceCents)`.
- *Verdict*: Filtering evaluates `COALESCE(discount_price_cents, price_cents)` ensuring buyers find genuine deals within their budget.

---

## 4. Data Models, Contracts & DTOs

### 1. Shared Types (`packages/shared-types/src/dto/products/product-search.dto.ts`)
```typescript
export enum ProductSortBy {
  RELEVANCE = "relevance",
  NEWEST = "newest",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
  TITLE_ASC = "title_asc",
}

export interface ProductSearchQueryRequestDto {
  q?: string;
  type?: ProductType;
  minSubscriptionTier?: SubscriptionTier;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortBy?: ProductSortBy;
  page?: number;
  limit?: number;
}
```

### 2. NestJS DTO (`apps/api/src/modules/products/dto/product-search-query.dto.ts`)
```typescript
export class ProductSearchQueryDto implements ProductSearchQueryRequestDto {
  @ApiPropertyOptional({ description: "Search query string", example: "dairy mastitis" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ProductType, description: "Filter by product type" })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({ enum: SubscriptionTier, description: "Filter by required tier" })
  @IsOptional()
  @IsEnum(SubscriptionTier)
  minSubscriptionTier?: SubscriptionTier;

  @ApiPropertyOptional({ description: "Minimum price in cents", example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceCents?: number;

  @ApiPropertyOptional({ description: "Maximum price in cents", example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceCents?: number;

  @ApiPropertyOptional({ enum: ProductSortBy, default: ProductSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.NEWEST;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

### 3. Repository Filter Interface (`apps/api/src/modules/products/repositories/product.repository.interface.ts`)
```typescript
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
```

---

## 5. API Endpoints

### 1. `GET /api/v1/products/search`
- **Access**: Public (`@Public()`) — unauthenticated visitors, buyers, farmers.
- **Query Parameters**:
  - `q`: Search terms (e.g., `vaccine schedule cow`)
  - `type`: `VIDEO_COURSE` | `EBOOK` | `EXCEL_TOOL`
  - `minSubscriptionTier`: `STARTER` | `PRO` | `ENTERPRISE`
  - `minPriceCents`: e.g., `0`
  - `maxPriceCents`: e.g., `10000`
  - `sortBy`: `relevance` | `newest` | `price_asc` | `price_desc` | `title_asc`
  - `page`: 1..N
  - `limit`: 1..100
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Product catalog search results retrieved successfully.",
    "data": {
      "items": [
        {
          "id": "11111111-1111-4111-8111-111111111111",
          "title": "Bovine Mastitis Diagnosis & Prevention",
          "slug": "bovine-mastitis-diagnosis-prevention",
          "type": "VIDEO_COURSE",
          "description": "Comprehensive clinical veterinary masterclass on identifying subclinical mastitis...",
          "priceCents": 4900,
          "discountPriceCents": 3900,
          "currency": "USD",
          "minSubscriptionTier": "STARTER",
          "isPublished": true,
          "createdAt": "2026-09-01T10:00:00.000Z",
          "updatedAt": "2026-09-01T10:00:00.000Z"
        }
      ],
      "meta": {
        "page": 1,
        "pageSize": 20,
        "total": 1,
        "totalPages": 1
      }
    },
    "timestamp": "2026-09-12T20:40:00.000Z"
  }
  ```

---

## 6. Security & Edge Cases
1. **Public Catalog Boundary**: Queries unconditionally enforce `isPublished: true` and `deletedAt: null` for all public storefront callers, ensuring unpublished drafts and soft-deleted items never leak.
2. **Search Input Sanitization**: Strips dangerous special regex/SQL symbols from the query string before generating tsquery statements to prevent SQL injection or FTS parse exceptions.
3. **Zero-Result Graceful Fallback**: If an FTS query yields 0 results, the system seamlessly attempts a fuzzy/contains search before returning an empty array.
4. **Price Boundary Inversion**: If `minPriceCents > maxPriceCents`, the controller validates and rejects or normalizes the boundary with standard RFC-7807 400 Bad Request.
