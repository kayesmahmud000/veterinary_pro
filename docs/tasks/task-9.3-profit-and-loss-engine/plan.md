# Task 9.3: Real-Time Farm Profit & Loss (P&L) Engine Implementation Plan

## Prerequisites
- Working `FarmTransaction` schema with `TransactionType.EXPENSE` and `TransactionType.REVENUE` (completed in Tasks 9.1 & 9.2).
- Prisma client generated.
- Monorepo build passes.

---

## Implementation Steps

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Define `ProfitLossInterval` enum in `packages/shared-types/src/enums/index.ts`.
- [x] Create `packages/shared-types/src/dto/financial/profit-loss-query.dto.ts`.
- [x] Create `packages/shared-types/src/dto/financial/profit-loss-response.dto.ts`.
- [x] Export all new DTOs in `packages/shared-types/src/dto/financial/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: NestJS Validation DTOs (`apps/api/src/modules/financial/dto/`)
- [x] Create `apps/api/src/modules/financial/dto/profit-loss-query.dto.ts` with `class-validator` decorators and Swagger annotations.
- [x] Create `apps/api/src/modules/financial/dto/profit-loss-summary-query.dto.ts`.
- [x] Export in `apps/api/src/modules/financial/dto/index.ts`.

### Step 3: Domain Entity & Business Rules (`apps/api/src/modules/financial/entities/`)
- [x] Create `FarmProfitLossEntity` in `apps/api/src/modules/financial/entities/farm-profit-loss.entity.ts`:
  - Methods: `calculateNetProfit()`, `calculateMargin()`, `calculateOperatingRatio()`, `synchronizeTimelines()`, `calculateGrowth()`.
  - Invariants: Date range order validation, zero-division guards, precision rounding to 2 decimal places.
- [x] Create unit tests in `apps/api/src/modules/financial/entities/farm-profit-loss.entity.spec.ts`.

### Step 4: Repository Layer (`apps/api/src/modules/financial/repositories/`)
- [x] Create interface `IFarmProfitLossRepository` in `apps/api/src/modules/financial/repositories/farm-profit-loss.repository.interface.ts`.
- [x] Implement `FarmProfitLossRepository` in `apps/api/src/modules/financial/repositories/farm-profit-loss.repository.ts`:
  - Query aggregated revenue and expenses using Prisma `groupBy` / `_sum` by category and interval.
  - Compute previous period aggregates when requested.
- [x] Create unit tests in `apps/api/src/modules/financial/repositories/farm-profit-loss.repository.spec.ts`.

### Step 5: Domain Service & Business Logic (`apps/api/src/modules/financial/services/`)
- [x] Create interface `IFarmProfitLossService` in `apps/api/src/modules/financial/services/farm-profit-loss.service.interface.ts`.
- [x] Implement `FarmProfitLossService` in `apps/api/src/modules/financial/services/farm-profit-loss.service.ts`:
  - Default date ranges (current month) if parameters omitted.
  - Calculate preceding equivalent period for comparison.
  - Map repository aggregates into `FarmProfitLossEntity` and return typed response DTOs.
- [x] Create unit tests in `apps/api/src/modules/financial/services/farm-profit-loss.service.spec.ts`.

### Step 6: Controller & API Routing (`apps/api/src/modules/financial/`)
- [x] Create `FinancialProfitLossController` in `apps/api/src/modules/financial/financial-profit-loss.controller.ts`:
  - `GET /api/v1/financial/profit-loss`
  - `GET /api/v1/financial/profit-loss/summary`
  - Protected with `JwtAuthGuard`, `TenantGuard`, `RolesGuard` (`@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`).
- [x] Create unit tests in `apps/api/src/modules/financial/financial-profit-loss.controller.spec.ts`.

### Step 7: Module Registration & Integration
- [x] Register `FarmProfitLossRepository`, `FarmProfitLossService`, and `FinancialProfitLossController` in `apps/api/src/modules/financial/financial.module.ts`.
- [x] Verify `apps/api/src/app.bootstrap.spec.ts` passes.

### Step 8: Verification & Acceptance
- [x] Run full test suite for financial module: `pnpm --filter @vetralink/api test -- src/modules/financial`.
- [x] Run full API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build check: `pnpm build`.
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`.
