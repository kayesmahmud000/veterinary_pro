# Task 11.4: SaaS Metrics Aggregator Execution Plan

## Prerequisites
- `@vetralink/shared-types` builds cleanly.
- `SubscriptionsModule`, `PrismaService`, `JwtAuthGuard`, and `RolesGuard` functional.
- Tasks 11.1, 11.2, and 11.3 completed and tested.

---

## Implementation Steps

- [x] **Step 1: DTOs & Contracts in `@vetralink/shared-types`**
  - Define `SubscriptionTierBreakdownDto`, `SubscriptionStatusBreakdownDto`, `DunningExposureDto`, `SaasMetricsSummaryDto`, `MonthlyTrendPointDto`, `SaasMetricsTrendDto`, `QuerySaasMetricsDto`.
  - Export from `packages/shared-types/src/index.ts`.
  - Rebuild `@vetralink/shared-types`.

- [x] **Step 2: Repository Extensions (`apps/api/src/modules/subscriptions/repositories`)**
  - Update `ISubscriptionRepository`:
    - `findAllWithPlan(asOfDate?: Date): Promise<SubscriptionEntity[]>`.
    - `findHistoricalSubscriptions(startDate: Date, endDate: Date): Promise<SubscriptionEntity[]>`.
  - Implement methods in `SubscriptionRepository`.
  - Unit tests for repository methods in `subscription.repository.spec.ts`.

- [x] **Step 3: Domain Service Layer (`apps/api/src/modules/subscriptions/services`)**
  - Create `ISubscriptionMetricsService` (`subscription-metrics.service.interface.ts`):
    - `getSummary(asOfDate?: Date): Promise<SaasMetricsSummaryDto>`.
    - `getTrends(query?: QuerySaasMetricsDto): Promise<SaasMetricsTrendDto>`.
  - Implement `SubscriptionMetricsService` (`subscription-metrics.service.ts`):
    - Compute MRR per subscription using `inferBillingInterval`.
    - Compute ARR, ARPU, LTV, churn rates, tier breakdown, and dunning exposure.
    - Generate monthly cohort trends.
  - Unit tests in `subscription-metrics.service.spec.ts`.

- [x] **Step 4: Controller & Module Wiring (`apps/api/src/modules/subscriptions`)**
  - Create `SubscriptionMetricsController` (`controllers/subscription-metrics.controller.ts`):
    - `GET /api/v1/subscriptions/metrics/summary`: Admin-only summary.
    - `GET /api/v1/subscriptions/metrics/trends`: Admin-only monthly trends.
  - Wire in `SubscriptionsModule` (providers, exports, controllers).
  - Export in `apps/api/src/modules/subscriptions/index.ts`.
  - Unit tests in `controllers/subscription-metrics.controller.spec.ts`.

- [x] **Step 5: Unit & Integration Test Verification**
  - Run full test suite for subscriptions module (`pnpm test -- src/modules/subscriptions`).
  - Verify build integrity (`pnpm --filter api build`).
  - Mark checklist items complete in `plan.md` and update `ROADMAP.md`.

---

## Verification & Acceptance Criteria
1. **MRR Calculation**:
   - Monthly plan: `MRR = priceMonthlyCents`.
   - Annual plan: `MRR = Math.round(priceAnnualCents / 12)`.
   - Trial plan: `MRR = 0`.
   - Past-due plan: included in `atRiskMrrCents`.
2. **ARR & ARPU**:
   - `ARR = MRR * 12`.
   - `ARPU = Math.round(totalMrrCents / activePayingCount)`.
3. **Churn & LTV**:
   - Churn rate calculation handles zero active subscriptions without division-by-zero.
   - LTV computation correctly reflects `ARPU / ChurnRate` or fallback horizon.
4. **Access Control**:
   - Endpoints require `JwtAuthGuard` and `RolesGuard` with `SUPER_ADMIN` or `ADMIN` role.
