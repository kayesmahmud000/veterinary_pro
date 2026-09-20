# Task 11.4: SaaS Metrics Aggregator for Platform Admins (MRR, ARR, Churn Rate, LTV)

## 1. Feature Overview & Objective
Platform administrators (`SUPER_ADMIN` and `ADMIN`) require visibility into real-time and historical SaaS business metrics across all farm tenants. This enables data-driven decision-making regarding subscription health, revenue expansion, churn mitigation, and tier pricing.

The objective of Task 11.4 is to build a high-performance, domain-driven SaaS metrics aggregator that computes:
- **MRR (Monthly Recurring Revenue)**: Total normalized recurring revenue per month across all active paying subscriptions.
- **ARR (Annual Recurring Revenue)**: Annual run-rate (`MRR * 12`).
- **ARPU (Average Revenue Per User / Farm Tenant)**: Average normalized revenue per active paying tenant.
- **Customer & Revenue Churn Rate**: Percentage of customers and revenue lost over a defined measurement period.
- **LTV (Customer Lifetime Value)**: Expected lifetime revenue per customer based on ARPU and churn velocity.
- **Tier & Status Breakdowns**: Granular breakdown by subscription tier (`STARTER`, `PRO`, `ENTERPRISE`), billing interval (`MONTHLY`, `ANNUAL`), and lifecycle status (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`, `EXPIRED`).
- **Dunning Risk Exposure**: Total past-due subscriptions and at-risk MRR categorized by grace period tiers (Days 1–3 Grace, Days 4–7 Read-Only, Day 8+ Suspended).
- **Historical Revenue Trends**: Time-series aggregation (monthly cohorts) tracking MRR trajectory, net new subscriptions, and churned accounts.

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionEntity` and `SubscriptionPlanEntity` track plans, pricing (`priceMonthlyCents`, `priceAnnualCents`), status, and billing cycle dates (`currentPeriodStart`, `currentPeriodEnd`).
- `SubscriptionRepository` supports querying individual subscriptions, farm subscriptions, expired subscriptions, and past-due subscriptions.
- There is no centralized aggregation engine or repository methods to compute holistic SaaS metrics, MRR, churn rates, or LTV.
- Platform admins lack an API endpoint to visualize SaaS performance indicators on an executive dashboard.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - `SaasMetricsSummaryDto`: Comprehensive real-time KPI overview (MRR, ARR, ARPU, LTV, churn rate, active counts).
  - `SubscriptionTierBreakdownDto`: Metrics per tier (count, MRR, percent share).
  - `SubscriptionStatusBreakdownDto`: Counts and percentages across all statuses.
  - `DunningExposureDto`: Past-due accounts and at-risk MRR grouped by grace period stage.
  - `SaasMetricsTrendDto`: Monthly historical timeline containing MRR, new subs, churned subs, and net growth.
  - `QuerySaasMetricsDto`: Query parameters supporting custom date windows (`startDate`, `endDate`, `interval`).
- **Repository Layer (`ISubscriptionRepository` / `SubscriptionRepository`)**:
  - `getMetricsSnapshotData(asOfDate?: Date)`: Queries all subscriptions with plans to compute aggregate KPIs.
  - `getHistoricalSubscriptionRecords(startDate: Date, endDate: Date)`: Retrieves subscription lifecycle events and historical records for trend and cohort churn calculations.
- **Domain Service Layer (`SubscriptionMetricsService`)**:
  - Encapsulates exact financial formulas:
    - **MRR Calculation**:
      - For `MONTHLY`: `plan.priceMonthlyCents`
      - For `ANNUAL`: `Math.round(plan.priceAnnualCents / 12)`
      - `TRIALING`: 0 MRR
    - **ARR**: `MRR * 12`
    - **ARPU**: `activePayingCount > 0 ? Math.round(totalMrrCents / activePayingCount) : 0`
    - **Customer Churn Rate**: `(churnedCount / (activeAtStart + newCount)) * 100` (capped at 100%, 0% if no churn)
    - **Revenue Churn Rate**: `(churnedMrrCents / startingMrrCents) * 100`
    - **LTV**: `churnRate > 0 ? Math.round(arpuCents / (churnRate / 100)) : Math.round(arpuCents * 24)` (defaulting to 24-month horizon when churn is zero)
    - **Dunning At-Risk MRR**: Sum of MRR for subscriptions with status `PAST_DUE`.
- **Controller & Security (`SubscriptionMetricsController`)**:
  - `GET /api/v1/subscriptions/metrics/summary`: Returns `SaasMetricsSummaryDto`.
  - `GET /api/v1/subscriptions/metrics/trends`: Returns `SaasMetricsTrendDto[]`.
  - Guarded strictly by `JwtAuthGuard`, `RolesGuard`, `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)`.

---

## 3. Architectural & Design Trade-offs

### Option A: Direct SQL View or Prisma Raw SQL Aggregation
- *Pros*: Executes all aggregations directly inside PostgreSQL.
- *Cons*: Raw SQL bypasses Prisma type safety, makes unit testing difficult with in-memory mocks, and duplicates business logic (e.g., `inferBillingInterval`, grace period stage thresholds) inside database functions.

### Option B: Domain-Driven Aggregation via Repository & Service (Selected Approach)
- *Pros*:
  - Leverages existing domain models (`SubscriptionEntity`, `SubscriptionPlanEntity`, `inferBillingInterval`).
  - Completely testable in isolation via mocked repository contracts without requiring a live Postgres instance.
  - Consistent with the rest of the codebase (`FarmProfitLossService`, `SubscriptionGracePeriodService`).
  - Maintains strict Clean Architecture layer separation.
- *Technical Justification*: Option B provides superior maintainability, strict typing, and testability. Because subscription counts for a veterinary B2B SaaS platform scale to thousands of farm tenants (not millions of sub-second events), in-memory aggregation of active/historical records is sub-millisecond fast and guarantees domain consistency.

---

## 4. Data Models & API Contracts

### Data Contracts (`@vetralink/shared-types`)

```typescript
export interface SubscriptionTierBreakdownDto {
  tier: SubscriptionTier;
  tierName: string;
  count: number;
  activePayingCount: number;
  mrrCents: number;
  percentageOfMrr: number;
}

export interface SubscriptionStatusBreakdownDto {
  status: SubscriptionStatus;
  count: number;
  percentageOfTotal: number;
}

export interface DunningExposureDto {
  totalPastDueCount: number;
  atRiskMrrCents: number;
  gracePeriodCount: number;  // Days 1-3
  readOnlyCount: number;     // Days 4-7
  suspendedCount: number;    // Day 8+
}

export interface SaasMetricsSummaryDto {
  asOfDate: string;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  ltvCents: number;
  activeSubscriptionsCount: number;
  activePayingSubscriptionsCount: number;
  trialingSubscriptionsCount: number;
  pastDueSubscriptionsCount: number;
  canceledSubscriptionsCount: number;
  expiredSubscriptionsCount: number;
  totalSubscriptionsCount: number;
  customerChurnRatePercent: number;
  revenueChurnRatePercent: number;
  tierBreakdown: SubscriptionTierBreakdownDto[];
  statusBreakdown: SubscriptionStatusBreakdownDto[];
  dunningExposure: DunningExposureDto;
}

export interface MonthlyTrendPointDto {
  period: string; // "YYYY-MM"
  mrrCents: number;
  arrCents: number;
  activeCount: number;
  newSubscriptionsCount: number;
  churnedSubscriptionsCount: number;
  netGrowthCount: number;
}

export interface SaasMetricsTrendDto {
  startDate: string;
  endDate: string;
  timeline: MonthlyTrendPointDto[];
}
```

---

## 5. Security & Edge Cases
- **RBAC**: Endpoints restricted strictly to `SUPER_ADMIN` and `ADMIN`. Unauthorized or non-admin requests receive HTTP 401 / 403.
- **Zero Division Protection**:
  - `activePayingCount === 0`: ARPU is 0.
  - `churnRate === 0`: LTV uses a safe default horizon (e.g., 24 months of ARPU).
  - `startingMrr === 0`: Revenue churn rate is 0%.
- **Interval Inference**: Correctly handles annual plans (`priceAnnualCents / 12`) versus monthly plans (`priceMonthlyCents`).
- **Grace Period Alignment**: Dunning exposure stages precisely match Task 11.3 definitions (Days 1–3 Grace, Days 4–7 Read-Only, Day 8+ Suspended).
