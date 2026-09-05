# SPEC-301: Product Master CRUD (VIDEO_COURSE, EBOOK, EXCEL_TOOL)

## 1. Feature Overview & Objective
Sprint 3 initiates **Phase 2: LMS & Digital Store with Payment Webhooks**.
The LMS and Digital Marketplace enables verified veterinarians and platform admins to publish digital educational assets:
- `VIDEO_COURSE`: Doctor-curated video training courses.
- `EBOOK`: Clinical manuals, husbandry guides, and veterinary texts.
- `EXCEL_TOOL`: Farm ROI calculators, feed formulation spreadsheets, and lactation curve planners.

**Task 3.1** establishes the foundational Product Master CRUD API following Clean Architecture:
- Core Domain Entity: `ProductEntity` implementing invariants (slug generation, price bounds, discount constraints, publication lifecycle).
- Repository Layer: `IProductRepository` and `ProductRepository` wrapping Prisma with soft-delete filtering and composite indexing.
- Service Layer: `ProductsService` enforcing slug uniqueness, audit logging on mutations (`AuditLogRepository`), and authorization scoping.
- Controller Layer: `ProductsController` with public catalog queries and role-guarded management routes (`SUPER_ADMIN`, `ADMIN`).
- Canonical DTOs: Type contracts in `@vetralink/shared-types` paired with NestJS `class-validator` and `@nestjs/swagger` implementations.

---

## 2. Current State vs. Proposed State

### Current State
- Prisma schema defines `model Product` in `apps/api/prisma/schema.prisma` with fields: `id`, `title`, `slug`, `type` (`ProductType`), `description`, `priceCents`, `discountPriceCents`, `currency`, `contentS3Key`, `minSubscriptionTier`, `isPublished`, `metadata`, `createdAt`, `updatedAt`, `deletedAt`.
- Index exists on `[type, isPublished]`.
- No domain entities, repository contracts, services, or controllers exist in `apps/api/src/modules/products/`.
- No product DTOs or response contracts exist in `@vetralink/shared-types`.

### Proposed State
- Shared contracts in `@vetralink/shared-types`:
  - `CreateProductRequestDto`, `UpdateProductRequestDto`, `ProductResponseDto`, `ProductListItemDto`, `ProductQueryFilterDto`.
- Domain Layer: `apps/api/src/modules/products/entities/product.entity.ts`:
  - Invariant rules (e.g., `discountPriceCents < priceCents`, `priceCents >= 0`, slug validation).
  - State methods (`publish()`, `unpublish()`, `softDelete()`, `updatePrice()`, `updateMetadata()`).
- Repository Layer: `apps/api/src/modules/products/repositories/`:
  - `product.repository.interface.ts` (`IProductRepository`, `PRODUCT_REPOSITORY`).
  - `product.repository.ts` implementing `IProductRepository` with soft-delete safety.
- Domain Service: `apps/api/src/modules/products/services/`:
  - `products.service.interface.ts` (`IProductsService`, `PRODUCTS_SERVICE`).
  - `products.service.ts` managing transactions, slug uniqueness, and audit logs.
- Controller Layer: `apps/api/src/modules/products/`:
  - `products.controller.ts` with `@ApiTags("Products")`, `@Controller("products")`.
  - Public endpoints: `GET /products`, `GET /products/:id`, `GET /products/slug/:slug`.
  - Admin endpoints: `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` guarded with `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)`.
- Module Wiring: `ProductsModule` wired into `AppModule`.

---

## 3. Architectural & Design Trade-offs

| Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Catalog Scope** | Scoped per farm tenant (`farmId`) | Global Marketplace Master (`farmId: null`) | Digital products (e.g. veterinary HLS courses, feed calculators) are global intellectual property delivered by the platform/vets across all farm tenants and buyers, not private farm assets. Tenant isolation is not applicable to the global product catalog. |
| **Slug Generation** | Client must provide pre-computed slug | Auto-generate kebab-case slug from title if omitted, with deduplication fallback | Provides seamless UX for editors while maintaining human-readable, SEO-friendly clean URLs for marketplace search indexing. |
| **Asset Key Security (`contentS3Key`)** | Expose `contentS3Key` in public API response | Sanitize `contentS3Key` out of public catalog responses; expose only to admins | Prevents unauthorized scraping or direct un-watermarked access to master video chunks, ebooks, or spreadsheets in S3. Secure asset retrieval is handled in Sprint 4 & 5 via time-limited signed tokens. |
| **Audit Logging** | Async event without transaction | Atomic audit record created via `AuditLogRepository` in same transaction | In line with `.antigravityrules` Guardrail-07: mutations to products, catalog items, and pricing must be immutably recorded for administrative traceability. |

---

## 4. Data Models & API Contracts

### Endpoints
```http
POST /api/v1/products
Headers: Authorization: Bearer <AdminToken>
Body:
{
  "title": "Comprehensive Bovine Mastitis Protocol",
  "slug": "comprehensive-bovine-mastitis-protocol",
  "type": "VIDEO_COURSE",
  "description": "Complete diagnostic and antibiotic stewardship training course for dairy operations.",
  "priceCents": 4999,
  "discountPriceCents": 3999,
  "currency": "USD",
  "contentS3Key": "courses/mastitis-v1/master.mp4",
  "minSubscriptionTier": "STARTER",
  "isPublished": true,
  "metadata": {
    "durationMinutes": 180,
    "moduleCount": 8,
    "instructor": "Dr. Sarah Jenkins, DVM"
  }
}
Response (201 Created):
{
  "success": true,
  "statusCode": 201,
  "message": "Product created successfully",
  "data": { ... ProductResponseDto ... },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
GET /api/v1/products?type=VIDEO_COURSE&isPublished=true&page=1&limit=20
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Products retrieved successfully",
  "data": [ ... ProductListItemDto ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
GET /api/v1/products/:id
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Product retrieved successfully",
  "data": { ... ProductResponseDto ... }
}
```

```http
PATCH /api/v1/products/:id
Headers: Authorization: Bearer <AdminToken>
Body:
{
  "priceCents": 5499,
  "isPublished": false
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Product updated successfully",
  "data": { ... ProductResponseDto ... }
}
```

```http
DELETE /api/v1/products/:id
Headers: Authorization: Bearer <AdminToken>
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Product deleted successfully",
  "data": null
}
```

---

## 5. Security & Edge Cases
1. **Price Invariance**:
   - `priceCents` must be an integer >= 0.
   - `discountPriceCents` must be strictly less than `priceCents`. If negative or >= priceCents, throw `ValidationDomainException`.
2. **Slug Collision**:
   - Slugs must be unique among active products (`deletedAt IS NULL`). If slug conflicts, append unique suffix or throw `EntityConflictException`.
3. **Draft / Unpublish Protection**:
   - Non-admin users cannot query or inspect `isPublished: false` products. Requests return `EntityNotFoundException` (404) to avoid leaking existence of unreleased material.
4. **Soft-Delete Integrity**:
   - Products soft-deleted retain foreign key integrity with historical `OrderItem` snapshots. Queries filter `deletedAt IS NULL` by default.
5. **Asset Key Redaction**:
   - `contentS3Key` is strictly excluded from public responses to prevent direct S3 scraping.
