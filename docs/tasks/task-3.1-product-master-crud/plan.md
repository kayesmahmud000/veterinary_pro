# PLAN-301: Product Master CRUD Implementation Plan
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.1: Product master CRUD (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Phase 1 completed: Database migrations, Auth engine, User entities, RBAC guards.
- [x] Prisma `model Product` defined in `prisma/schema.prisma`.
- [x] `AuditLogRepository` and `TransactionManager` available.

---

## 2. Granular Implementation Steps

### Step 1: DTOs & Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/products/product.dto.ts`:
  - `CreateProductRequestDto`, `UpdateProductRequestDto`.
  - `ProductResponseDto`, `ProductListItemDto`, `ProductQueryFilterDto`.
- [x] Export product DTOs from `packages/shared-types/src/dto/products/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Domain Entity `ProductEntity` & Tests
- [x] Create `apps/api/src/modules/products/entities/product.entity.ts`:
  - Properties: `id`, `title`, `slug`, `type`, `description`, `priceCents`, `discountPriceCents`, `currency`, `contentS3Key`, `minSubscriptionTier`, `isPublished`, `metadata`, `createdAt`, `updatedAt`, `deletedAt`.
  - Invariants: price bounds, discount constraints, slug formatting, slug generation helper.
  - Lifecycle methods: `publish()`, `unpublish()`, `updateDetails()`, `updatePricing()`, `softDelete()`.
  - Presentation methods: `toResponse(includeAssetKey?: boolean)`, `toListItem()`.
- [x] Create `apps/api/src/modules/products/entities/product.entity.spec.ts`:
  - Unit tests verifying domain invariants, price constraints, and state transitions.

### Step 3: Repository Contract & Prisma Repository Implementation
- [x] Create `apps/api/src/modules/products/repositories/product.repository.interface.ts`:
  - Define `IProductRepository` interface.
  - Injection token `PRODUCT_REPOSITORY = "PRODUCT_REPOSITORY"`.
- [x] Create `apps/api/src/modules/products/repositories/product.repository.ts`:
  - Implements `IProductRepository` using `PrismaService`.
  - Handles soft-delete scoping (`deletedAt: null`).
  - Supports filters by `type`, `isPublished`, `minSubscriptionTier`, and text search.
- [x] Create `apps/api/src/modules/products/repositories/product.repository.spec.ts`:
  - Unit tests mocking `PrismaService` verifying queries, transactions, and mappings.

### Step 4: Product Service & Audit Integration
- [x] Create `apps/api/src/modules/products/services/products.service.interface.ts`:
  - Define `IProductsService` interface.
  - Injection token `PRODUCTS_SERVICE = "PRODUCTS_SERVICE"`.
- [x] Create `apps/api/src/modules/products/services/products.service.ts`:
  - Implements `IProductsService`.
  - Handles slug auto-generation and uniqueness validation.
  - Enforces atomic mutations with `AuditLogRepository` emission.
  - Scopes visibility based on user roles (admin vs public).
- [x] Create `apps/api/src/modules/products/services/products.service.spec.ts`:
  - Unit tests for all business logic, duplicate slugs, discount validation, and audit recording.

### Step 5: Input DTOs, Controller & Swagger Documentation
- [x] Create `apps/api/src/modules/products/dto/`:
  - `create-product.dto.ts` (with `class-validator` & `@ApiProperty`).
  - `update-product.dto.ts`.
  - `product-query.dto.ts` (pagination, filters).
- [x] Create `apps/api/src/modules/products/products.controller.ts`:
  - Public: `GET /products`, `GET /products/:id`, `GET /products/slug/:slug`.
  - Admin: `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (`@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)`).
- [x] Create `apps/api/src/modules/products/products.controller.spec.ts` unit tests.
- [x] Create `apps/api/src/modules/products/products.controller.int.spec.ts` integration tests.

### Step 6: Module Wiring & Verification
- [x] Create `apps/api/src/modules/products/products.module.ts`:
  - Imports `PrismaModule`, `AuditModule`.
  - Registers providers, controllers, and exports.
- [x] Wire `ProductsModule` into `apps/api/src/app.module.ts`.
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.1.

---

## 3. Acceptance Criteria
1. **Full Product Lifecycle**: Products can be created, updated, published/unpublished, and soft-deleted with immutable audit logs.
2. **Catalog Security**: `contentS3Key` is never exposed in public responses.
3. **Public vs Admin Visibility**: Only published, non-deleted products appear in public search and retrieval endpoints.
4. **Data Integrity**: Slugs are unique among active products; discount prices are strictly validated against base prices.
5. **OpenAPI Documentation**: Complete Swagger schemas for all CRUD operations, DTOs, and error responses.
6. **100% Test Pass Rate**: Full unit and integration test coverage with zero regressions.
