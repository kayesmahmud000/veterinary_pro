# Task 9.5: Comprehensive Monthly Farm Performance PDF Statement Generator Implementation Plan

## Prerequisites
- `FarmProfitLossService` (completed in Task 9.3).
- `FarmFeedAnalyticsService` (completed in Task 9.4).
- `pdf-lib` dependency installed in `apps/api`.
- All tests and builds green.

---

## Implementation Steps

### Step 1: Shared Types & Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/financial/monthly-statement.dto.ts`:
  - `MonthlyStatementQueryDto` (`year`, `month`, `currency`).
  - `MonthlyPerformanceStatementDto` (complete structured report payload).
- [x] Export in `packages/shared-types/src/dto/financial/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: NestJS Validation DTOs (`apps/api/src/modules/financial/dto/`)
- [x] Create `monthly-statement-query.dto.ts` with `class-validator` decorators (`@IsInt()`, `@Min(2000)`, `@Max(2100)`, `@Min(1)`, `@Max(12)`).
- [x] Export in `apps/api/src/modules/financial/dto/index.ts`.

### Step 3: PDF Document Generator Utility (`apps/api/src/modules/financial/pdf/`)
- [x] Implement `FarmPerformancePdfGenerator` in `apps/api/src/modules/financial/pdf/farm-performance-pdf.generator.ts`:
  - Builds A4 document via `pdf-lib`.
  - Renders Header, Executive Financial Summary, Revenue/Expense tables, Dairy Unit Economics, Feed Efficiency & FCR, and Verification Footer.
  - Returns `Promise<Buffer>`.
- [x] Create unit tests in `apps/api/src/modules/financial/pdf/farm-performance-pdf.generator.spec.ts`.

### Step 4: Domain Service Layer (`apps/api/src/modules/financial/services/`)
- [x] Create interface `IFarmPerformanceStatementService` in `apps/api/src/modules/financial/services/farm-performance-statement.service.interface.ts`.
- [x] Implement `FarmPerformanceStatementService` in `apps/api/src/modules/financial/services/farm-performance-statement.service.ts`:
  - Orchestrates Farm details query, `FarmProfitLossService`, and `FarmFeedAnalyticsService`.
  - Generates binary PDF document buffer and structured statement data.
- [x] Create unit tests in `apps/api/src/modules/financial/services/farm-performance-statement.service.spec.ts`.

### Step 5: Controller Layer (`apps/api/src/modules/financial/`)
- [x] Create `FinancialStatementController` in `apps/api/src/modules/financial/financial-statement.controller.ts`:
  - `GET /api/v1/financial/statements/monthly-pdf` (streams PDF buffer).
  - `GET /api/v1/financial/statements/monthly-summary` (returns JSON).
  - Protected with `JwtAuthGuard`, `TenantGuard`, and `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`.
- [x] Create unit tests in `apps/api/src/modules/financial/financial-statement.controller.spec.ts`.

### Step 6: Module Registration & Verification
- [x] Register `FarmPerformanceStatementService` and `FinancialStatementController` in `FinancialModule`.
- [x] Run bootstrap test (`src/app.bootstrap.spec.ts`).
- [x] Run financial test suites: `pnpm --filter @vetralink/api test -- src/modules/financial`.
- [x] Run full API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build check: `pnpm build`.
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`.
