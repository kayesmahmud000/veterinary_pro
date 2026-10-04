# PLAN-902: Revenue Tracking Step-by-Step Execution Plan

## Prerequisites
- PostgreSQL 16 & Redis 7 active in Docker Compose environment.
- All existing 121 test suites (1116 tests) passing.
- Task 9.1 complete.

---

## Granular Implementation Checklist

### Step 1: Enums & Type Contracts in `@vetralink/shared-types`
- [x] Add `MANURE` and `BYPRODUCTS` to `TransactionCategory` in `packages/shared-types/src/enums/index.ts`
- [x] Create `packages/shared-types/src/dto/financial/record-revenue.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/update-revenue.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/revenue-query.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/revenue-summary-query.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/revenue-response.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/revenue-summary-response.dto.ts`
- [x] Export all revenue DTOs from `packages/shared-types/src/dto/financial/index.ts`
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`)

### Step 2: Database Schema & Migration
- [x] Update `TransactionCategory` in `apps/api/prisma/schema.prisma` with `MANURE` and `BYPRODUCTS`
- [x] Create SQL migration script in `apps/api/prisma/migrations/20260913130000_add_revenue_categories/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Implement `FarmRevenueEntity` in `apps/api/src/modules/financial/entities/farm-revenue.entity.ts` with business invariants
- [x] Write unit tests for `FarmRevenueEntity` in `apps/api/src/modules/financial/entities/farm-revenue.entity.spec.ts`
- [x] Define `IFarmRevenueRepository` in `apps/api/src/modules/financial/repositories/farm-revenue.repository.interface.ts`
- [x] Implement `FarmRevenueRepository` in `apps/api/src/modules/financial/repositories/farm-revenue.repository.ts`
- [x] Write unit tests for `FarmRevenueRepository` in `apps/api/src/modules/financial/repositories/farm-revenue.repository.spec.ts`

### Step 4: API DTOs (class-validator & Swagger)
- [x] Create `apps/api/src/modules/financial/dto/record-revenue.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/update-revenue.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/revenue-query.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/revenue-summary-query.dto.ts`
- [x] Export revenue DTOs from `apps/api/src/modules/financial/dto/index.ts`

### Step 5: Domain Service & Business Logic
- [x] Define `IFarmRevenueService` in `apps/api/src/modules/financial/services/farm-revenue.service.interface.ts`
- [x] Implement `FarmRevenueService` in `apps/api/src/modules/financial/services/farm-revenue.service.ts`:
  - Multi-tenant boundary checks
  - Revenue category domain validation
  - Animal existence and ownership verification
  - Automatic transition to `AnimalStatus.SOLD` when selling livestock (`markAnimalAsSold: true`)
  - Optimistic concurrency control via `syncVersion`
  - Soft-delete semantics
  - Category breakdown and analytics computation
  - Atomic database transactions with `AuditLog` records for `CREATE_REVENUE`, `UPDATE_REVENUE`, `DELETE_REVENUE`
- [x] Write comprehensive unit tests for `FarmRevenueService` in `apps/api/src/modules/financial/services/farm-revenue.service.spec.ts`

### Step 6: Controller & API Routing
- [x] Implement `FinancialRevenueController` in `apps/api/src/modules/financial/financial-revenue.controller.ts`:
  - `POST /api/v1/financial/revenues`
  - `GET /api/v1/financial/revenues`
  - `GET /api/v1/financial/revenues/summary`
  - `GET /api/v1/financial/revenues/:id`
  - `PATCH /api/v1/financial/revenues/:id`
  - `DELETE /api/v1/financial/revenues/:id`
  - Route guards: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`
- [x] Write unit tests for `FinancialRevenueController` in `apps/api/src/modules/financial/financial-revenue.controller.spec.ts`
- [x] Wire `FinancialRevenueController`, `FarmRevenueRepository`, and `FarmRevenueService` in `FinancialModule`

### Step 7: Verification & Acceptance Criteria
- [x] Run unit tests for revenue components (34/34 tests passed)
- [x] Run full test suite (`pnpm --filter @vetralink/api test` - 125/125 test suites passed, 1150 tests passed)
- [x] Run build checks (`pnpm build` - all 3 packages built successfully)
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`
