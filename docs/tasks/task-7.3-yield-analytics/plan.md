# PLAN-703: Execution Plan for Daily, Weekly, and Monthly Milk Yield Analytics with 7-Day Moving Averages

## Prerequisites
- Working NestJS monorepo (`@vetralink/api` and `@vetralink/shared-types`).
- `MilkLog` database table and repository from Tasks 7.1 and 7.2.
- PostgreSQL composite indexes on `milk_logs(farm_id, logged_date, session)`.

---

## Implementation Steps

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/milk-logs/milk-yield-analytics.dto.ts`:
  - Define `MilkYieldAnalyticsQueryDto`.
  - Define `DailyYieldPointDto`.
  - Define `WeeklyYieldPointDto`.
  - Define `MonthlyYieldPointDto`.
  - Define `MilkYieldAnalyticsSummaryDto`.
  - Define `MilkYieldAnalyticsResponseDto`.
- [x] Export all new types in `packages/shared-types/src/index.ts` and `packages/shared-types/src/dto/milk-logs/index.ts`.
- [x] Build shared types package (`pnpm --filter @vetralink/shared-types build`).

### Step 2: API Input Validation DTOs (`apps/api/src/modules/milk-logs/dto`)
- [x] Create `apps/api/src/modules/milk-logs/dto/milk-yield-analytics-query.dto.ts` with `class-validator`, `class-transformer`, and `@ApiProperty` decorators:
  - `@IsOptional() @IsUUID()` `animalId`
  - `@IsOptional() @IsDateString()` `startDate`
  - `@IsOptional() @IsDateString()` `endDate`
  - `@IsOptional() @IsEnum(["INDIVIDUAL", "BULK", "ALL"])` `entryType`
- [x] Export from `apps/api/src/modules/milk-logs/dto/index.ts`.

### Step 3: Repository Layer Enhancements (`apps/api/src/modules/milk-logs/repositories`)
- [x] In `IMilkLogRepository`:
  - Define `findLogsForAnalytics(farmId: string, filter: MilkLogAnalyticsFilter, tx?: Prisma.TransactionClient): Promise<MilkLogEntity[]>`.
- [x] In `MilkLogRepository`:
  - Implement `findLogsForAnalytics` to query records ordered by `loggedDate ASC, session ASC` with date filtering `[startDate, endDate]`, optional `animalId`, and `entryType`.

### Step 4: Domain Analytics Engine & Business Logic (`apps/api/src/modules/milk-logs/services`)
- [x] Create pure analytical calculation utility `apps/api/src/modules/milk-logs/utils/milk-yield-analytics.util.ts`:
  - `computeDailyYieldPoints(logs: MilkLogEntity[], startDate: Date, endDate: Date): DailyYieldPointDto[]`
  - 7-Day Simple Moving Average (7-SMA) with 6-day lookback window
  - `computeWeeklyYieldPoints(dailyPoints: DailyYieldPointDto[]): WeeklyYieldPointDto[]`
  - `computeMonthlyYieldPoints(dailyPoints: DailyYieldPointDto[]): MonthlyYieldPointDto[]`
  - `computeSummaryStatistics(dailyPoints: DailyYieldPointDto[], totalRecords: number): MilkYieldAnalyticsSummaryDto`
- [x] In `IMilkLogService`:
  - Add `getYieldAnalytics(farmId: string, query: MilkYieldAnalyticsQueryDto): Promise<MilkYieldAnalyticsResponseDto>`.
- [x] In `MilkLogService`:
  - Implement `getYieldAnalytics` with:
    - Date range validation (`startDate <= endDate`, neither in future, max range 730 days).
    - 6-day warm lookback fetch (`startDate - 6 days`).
    - Delegation to pure analytics utility.
    - Summary calculation and trend detection (`INCREASING`, `DECREASING`, `STABLE`).

### Step 5: Controller & Module Wiring (`apps/api/src/modules/milk-logs`)
- [x] In `MilkLogsController`:
  - Add `GET /api/v1/milk-logs/analytics` endpoint decorated with `@UseGuards(JwtAuthGuard, TenantGuard)`, `@FarmRoles(...)`, `@Query() query: MilkYieldAnalyticsQueryInputDto`, and OpenAPI Swagger metadata.
- [x] In `MilkLogsModule` and `AnimalsModule`:
  - Import `AuthModule` to fix missing `TOKEN_SERVICE` dependency injection for `JwtAuthGuard`.

### Step 6: Unit & Integration Testing
- [x] Author unit tests in `apps/api/src/modules/milk-logs/utils/milk-yield-analytics.util.spec.ts`:
  - Test daily yield summation and session breakdown.
  - Test 7-day moving average calculation across multi-day datasets.
  - Test warm lookback seeding (no initial ramp-up distortion).
  - Test ISO weekly aggregation (Monday through Sunday grouping).
  - Test monthly aggregation.
  - Test trend calculations (`INCREASING`, `DECREASING`, `STABLE`).
  - Test empty dataset handling (zero divisions guarded).
- [x] Update `apps/api/src/modules/milk-logs/services/milk-log.service.spec.ts`:
  - Test `getYieldAnalytics` validation rules, repository calls, and response structure.
- [x] Update `apps/api/src/modules/milk-logs/milk-logs.controller.spec.ts`:
  - Test `GET /analytics` endpoint handler.
- [x] Verify fix for `app.bootstrap.spec.ts` (AppModule DI resolution).
- [x] Adjust timeout in `animal-tag.service.spec.ts` if needed.

### Step 7: Verification & Acceptance
- [x] Run full test suite: `pnpm --filter @vetralink/api test` (91 passed, 851 tests passed).
- [x] Run TypeScript compilation: `pnpm --filter @vetralink/api build` (0 errors).
- [x] Check off items in `plan.md` and mark Task 7.3 as complete in `ROADMAP.md`.
