# Task 9.4: Feed Conversion Ratio (FCR) & Cost-Per-Liter Milk Computation Implementation Plan

## Prerequisites
- `FarmTransaction` ledger with `FEED` expenses and `MILK_SALES` revenues.
- `MilkLog` with yields in liters.
- `AnimalWeightLog` with historical weight measurements.
- Existing tests and build green.

---

## Implementation Steps

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Define `FeedEfficiencyRating` enum in `packages/shared-types/src/enums/index.ts`.
- [x] Create `cost-per-liter.dto.ts` in `packages/shared-types/src/dto/financial/`:
  - `CostPerLiterQueryDto`, `CostPerLiterTimelinePointDto`, `CostPerLiterResponseDto`.
- [x] Create `feed-conversion.dto.ts` in `packages/shared-types/src/dto/financial/`:
  - `FeedConversionQueryDto`, `AnimalFcrItemDto`, `FeedConversionResponseDto`.
- [x] Export in `packages/shared-types/src/dto/financial/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: NestJS Validation DTOs (`apps/api/src/modules/financial/dto/`)
- [x] Create `cost-per-liter-query.dto.ts` with class-validator and Swagger annotations.
- [x] Create `feed-conversion-query.dto.ts` with class-validator and Swagger annotations.
- [x] Export in `apps/api/src/modules/financial/dto/index.ts`.

### Step 3: Domain Entities (`apps/api/src/modules/financial/entities/`)
- [x] Create `CostPerLiterEntity` in `apps/api/src/modules/financial/entities/cost-per-liter.entity.ts`:
  - Invariants: Zero-division handling, precision rounding (2 decimal places for currency, 3 for yield).
  - Formulas: `feedCostPerLiter`, `operatingCostPerLiter`, `revenuePerLiter`, `netMarginPerLiter`, `breakEvenMilkPrice`.
- [x] Create `FeedConversionEntity` in `apps/api/src/modules/financial/entities/feed-conversion.entity.ts`:
  - Growth FCR calculation, feed cost per kg gain, dairy feed efficiency (kg feed / L milk & L milk / kg feed), efficiency ratings.
- [x] Create unit tests:
  - `cost-per-liter.entity.spec.ts`
  - `feed-conversion.entity.spec.ts`

### Step 4: Repository Layer (`apps/api/src/modules/financial/repositories/`)
- [x] Create interface `IFarmFeedAnalyticsRepository` in `apps/api/src/modules/financial/repositories/farm-feed-analytics.repository.interface.ts`.
- [x] Implement `FarmFeedAnalyticsRepository` in `apps/api/src/modules/financial/repositories/farm-feed-analytics.repository.ts`:
  - Cross-queries `FarmTransaction`, `MilkLog`, and `AnimalWeightLog`.
  - Aggregates feed expenses, total operating expenses, milk sales revenues, milk yield in liters, feed quantity in kg from transaction metadata, and animal weight gain deltas.
- [x] Create unit tests in `apps/api/src/modules/financial/repositories/farm-feed-analytics.repository.spec.ts`.

### Step 5: Domain Service Layer (`apps/api/src/modules/financial/services/`)
- [x] Create interface `IFarmFeedAnalyticsService` in `apps/api/src/modules/financial/services/farm-feed-analytics.service.interface.ts`.
- [x] Implement `FarmFeedAnalyticsService` in `apps/api/src/modules/financial/services/farm-feed-analytics.service.ts`:
  - Computes Cost-Per-Liter and Feed Conversion KPIs.
  - Supports user overrides (`assumedFeedKg`, `assumedFeedCostPerKg`).
- [x] Create unit tests in `apps/api/src/modules/financial/services/farm-feed-analytics.service.spec.ts`.

### Step 6: Controller Layer (`apps/api/src/modules/financial/`)
- [x] Create `FinancialFeedAnalyticsController` in `apps/api/src/modules/financial/financial-feed-analytics.controller.ts`:
  - `GET /api/v1/financial/analytics/cost-per-liter`
  - `GET /api/v1/financial/analytics/feed-conversion`
  - Secured with `JwtAuthGuard`, `TenantGuard`, and `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`.
- [x] Create unit tests in `apps/api/src/modules/financial/financial-feed-analytics.controller.spec.ts`.

### Step 7: Module Registration & Verification
- [x] Register repository, service, and controller in `FinancialModule`.
- [x] Run bootstrap test (`src/app.bootstrap.spec.ts`).
- [x] Run financial test suites: `pnpm --filter @vetralink/api test -- src/modules/financial`.
- [x] Run full API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build check: `pnpm build`.
- [x] Check off items in `plan.md` and update `ROADMAP.md`.
