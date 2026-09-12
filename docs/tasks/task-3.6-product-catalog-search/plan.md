# PLAN-306: Product Catalog Public Search with Full-Text Indexing & Filtering
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.6: Product catalog public search with full-text indexing and filtering
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational (`ProductRepository`, `ProductsService`, `ProductsController`).
- [x] Task 3.2: Presigned S3 direct multipart upload operational.
- [x] Task 3.3: BullMQ video processing worker with multi-bitrate HLS segmentation operational.
- [x] Task 3.4: AES-128 / DRM key server endpoint operational.
- [x] Task 3.5: CloudFront OAC signed URL & cookie delivery pipeline operational.

---

## 2. Granular Implementation Steps

### Step 1: Database Migration for PostgreSQL Full-Text Search GIN Index
- [x] Create a dedicated Prisma migration adding the GIN full-text search index on `products`:
  - Index: `CREATE INDEX idx_products_search_gin ON products USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));`
  - Additional composite indexes for fast catalog filtering: `CREATE INDEX idx_products_published_type_created ON products(is_published, type, created_at DESC) WHERE deleted_at IS NULL;`

### Step 2: Shared Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/products/product-search.dto.ts`:
  - `ProductSortBy` enum (`RELEVANCE = 'relevance'`, `NEWEST = 'newest'`, `PRICE_ASC = 'price_asc'`, `PRICE_DESC = 'price_desc'`, `TITLE_ASC = 'title_asc'`).
  - `ProductSearchQueryRequestDto`.
- [x] Export in `packages/shared-types/src/dto/products/index.ts` and root `src/index.ts`.
- [x] Compile `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: Product Repository Search & Filter Upgrades
- [x] Update `apps/api/src/modules/products/repositories/product.repository.interface.ts`:
  - Add `minPriceCents`, `maxPriceCents`, `sortBy` to `ProductRepositoryFilter`.
- [x] Update `apps/api/src/modules/products/repositories/product.repository.ts`:
  - Implement full-text search handling: convert user search terms into formatted prefix tsquery expressions or Prisma `search` filters with sanitized terms.
  - Implement price range filtering against `priceCents` / `discountPriceCents`.
  - Implement dynamic sorting: `relevance`, `newest`, `price_asc`, `price_desc`, `title_asc`.
- [x] Update / author repository unit tests in `product.repository.spec.ts`.

### Step 4: Products Service Search Implementation
- [x] Update `apps/api/src/modules/products/services/products.service.interface.ts`:
  - Add `searchProducts(query: ProductSearchQueryRequestDto): Promise<{ items: ProductListItemDto[]; meta: PaginationMeta }>`.
- [x] Update `apps/api/src/modules/products/services/products.service.ts`:
  - Implement `searchProducts`: sanitize query, validate price boundaries (reject if min > max), apply pagination defaults, and delegate to repository with `isPublished: true` and `deletedAt: null`.
- [x] Update unit tests in `products.service.spec.ts` testing search queries, multifaceted filters, and sorting.

### Step 5: Controller Endpoints & DTOs
- [x] Create `apps/api/src/modules/products/dto/product-search-query.dto.ts` with `class-validator`, `class-transformer`, and Swagger `@ApiPropertyOptional` decorators.
- [x] Export in `apps/api/src/modules/products/dto/index.ts`.
- [x] Update `apps/api/src/modules/products/products.controller.ts`:
  - Add `@Get("search")` endpoint marked `@Public()` returning search results.
  - Update `@Get()` endpoint to support the new filtering and sorting options.

### Step 6: Unit & Integration Tests
- [x] Author `products.controller.spec.ts` test cases for `GET /search`.
- [x] Author `products.controller.int.spec.ts` Supertest integration tests verifying:
  - Public unauthenticated access to `GET /products/search`.
  - Keyword matching in title and description.
  - Type, tier, and price range filters.
  - Sorting modes.
  - Exclusion of unpublished or soft-deleted products.

### Step 7: Verification & Roadmap Check-Off
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.6, completing Sprint 3!

---

## 3. Acceptance Criteria
1. **Full-Text Keyword Search**: Query string `q` matches terms against product `title` and `description` with prefix matching and case-insensitivity.
2. **Multifaceted Filtering**: Supports combined filtering by `type`, `minSubscriptionTier`, `minPriceCents`, and `maxPriceCents`.
3. **Sorting Support**: Result sets sortable by `relevance`, `newest`, `price_asc`, `price_desc`, and `title_asc`.
4. **Public Access Safety**: Guest/unauthenticated users can search; unpublished or deleted products are strictly excluded from public search results.
5. **Pagination Standards**: Standard unified response envelope with `items` and `PaginationMeta` (`page`, `pageSize`, `total`, `totalPages`).
6. **100% Test Pass Rate**: All unit and Supertest integration tests pass with zero regressions.
