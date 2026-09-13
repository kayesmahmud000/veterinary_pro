# Task 9.3: Real-Time Farm Profit & Loss (P&L) Engine Specification

## 1. Feature Overview & Objective
The objective of this task is to deliver a real-time, multi-tenant Farm Profit & Loss (P&L) calculation engine for VetraLink Pro. Farm owners, managers, and accountants require an on-demand financial performance statement calculated across arbitrary date ranges (`startDate` to `endDate`), configurable time-series intervals (`DAY`, `WEEK`, `MONTH`, `YEAR`), optional animal/cohort attribution, and previous-period comparative growth analytics.

### Core Metrics Computed:
- **Gross Revenue**: Sum of all non-deleted `REVENUE` transactions (`MILK_SALES`, `LIVESTOCK_SALES`, `MANURE`, `BYPRODUCTS`, `OTHER`).
- **Operating Expenses (OPEX)**: Sum of all non-deleted `EXPENSE` transactions (`FEED`, `VETERINARY_DRUGS`, `LABOR`, `UTILITY`, `EQUIPMENT`, `OTHER`).
- **Net Profit / Loss**: `Total Revenue - Total Expenses`.
- **Net Profit Margin (%)**: `(Net Profit / Total Revenue) * 100` (safe division guard when revenue = 0).
- **Operating Expense Ratio (%)**: `(Total Expenses / Total Revenue) * 100`.
- **Category Breakdown**: Granular monetary sum, transaction count, and relative percentage for both Revenue categories and Expense categories.
- **Synchronized Timeline Series**: Aligned interval data points (`period`, `revenue`, `expense`, `netProfit`, `marginPercentage`) for front-end charts without holes.
- **Period-over-Period Comparison**: Automatic or optional calculation of the preceding equivalent window with growth rates (`revenueGrowthPercentage`, `expenseGrowthPercentage`, `netProfitGrowthPercentage`).

---

## 2. Current State vs. Proposed State

### Current State
- `FarmTransaction` entity and table exist in `apps/api/prisma/schema.prisma` with `type: EXPENSE | REVENUE` and indexed `[farmId, txDate]`, `[farmId, type, txDate]`, `[farmId, type, category, txDate]`.
- Task 9.1 introduced `FarmExpenseEntity`, `FarmExpenseRepository`, `FarmExpenseService`, and `FinancialExpenseController`.
- Task 9.2 introduced `FarmRevenueEntity`, `FarmRevenueRepository`, `FarmRevenueService`, and `FinancialRevenueController`.
- While isolated expense and revenue summaries exist, there is no unified domain engine that synthesizes both ledgers into an accounting-grade Profit & Loss statement, computes financial health ratios, aligns time-series intervals, or performs period-over-period comparative analysis.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `ProfitLossInterval` enum (`DAY`, `WEEK`, `MONTH`, `YEAR`).
  - `ProfitLossQueryDto`, `ProfitLossSummaryQueryDto`.
  - `ProfitLossCategoryBreakdownDto`, `ProfitLossTimelinePointDto`, `ProfitLossComparisonDto`.
  - `ProfitLossStatementResponseDto`, `ProfitLossSummaryKpiDto`.
- **Domain Layer (`apps/api/src/modules/financial/entities/`)**:
  - `FarmProfitLossEntity`: Pure business domain model encapsulating financial math, zero-division boundaries, timeline synchronization, margin calculations, and period comparison calculations.
- **Repository Layer (`apps/api/src/modules/financial/repositories/`)**:
  - `IFarmProfitLossRepository` & `FarmProfitLossRepository`: Leverages Prisma aggregations (`groupBy` and `_sum`) over `FarmTransaction` to compute real-time totals and category breakdowns in single round-trips without loading thousands of raw records into Node.js memory.
- **Service Layer (`apps/api/src/modules/financial/services/`)**:
  - `IFarmProfitLossService` & `FarmProfitLossService`: Validates date boundaries (defaulting to current calendar month or custom range), handles previous-period calculation, enforces tenant isolation, and orchestrates entity generation.
- **Controller Layer (`apps/api/src/modules/financial/`)**:
  - `FinancialProfitLossController`: Exposes `GET /api/v1/financial/profit-loss` and `GET /api/v1/financial/profit-loss/summary`, guarded by `JwtAuthGuard`, `TenantGuard`, and `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`.

---

## 3. Architectural & Design Trade-offs

| Decision Area | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **P&L Generation Strategy** | Pre-calculated batch rollup table updated via cron/triggers | On-demand dynamic aggregation via indexed database queries | **Option B** guarantees immediate, real-time accuracy whenever expenses or revenues are recorded, modified, or soft-deleted. PostgreSQL indexes on `[farm_id, type, transaction_date]` make `groupBy` and `_sum` sub-millisecond for multi-tenant farm scales. |
| **Aggregation Location** | Fetch all raw transactions into memory and aggregate in Node.js | Database-level aggregation via Prisma `groupBy` / SQL aggregation | **Option B** minimizes network payload and V8 heap consumption, preventing memory spikes when generating annual statements over tens of thousands of transactions. |
| **Timeline Synchronization** | Unsynchronized disjoint arrays of revenue and expense | Synchronized time-series bucket array aligning intervals | **Option B** provides frontend charting libraries (Recharts, Chart.js) with clean pairs `{ period, revenue, expense, netProfit }` without client-side alignment bugs. |
| **Date Range Handling** | Mandatory strict date range input | Flexible date ranges with smart defaults (current calendar month) | **Option B** improves UX; when parameters are omitted, it returns the current month's statement out-of-the-box. |

---

## 4. Data Models & Contracts

### 4.1 Shared Contracts (`@vetralink/shared-types`)
```typescript
export enum ProfitLossInterval {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
  YEAR = "YEAR",
}

export interface ProfitLossCategoryBreakdownDto {
  category: TransactionCategory;
  amount: number;
  transactionCount: number;
  percentage: number;
}

export interface ProfitLossTimelinePointDto {
  period: string; // ISO Date or Year-Month (e.g. "2026-09-01" or "2026-09")
  revenue: number;
  expense: number;
  netProfit: number;
  marginPercentage: number;
}

export interface ProfitLossComparisonDto {
  previousStartDate: string;
  previousEndDate: string;
  previousRevenue: number;
  previousExpense: number;
  previousNetProfit: number;
  revenueGrowthPercentage: number | null;
  expenseGrowthPercentage: number | null;
  netProfitGrowthPercentage: number | null;
}

export interface ProfitLossStatementResponseDto {
  farmId: string;
  startDate: string;
  endDate: string;
  currency: string;
  interval: ProfitLossInterval;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  isProfitable: boolean;
  profitMarginPercentage: number;
  operatingExpenseRatio: number;
  revenueTransactionsCount: number;
  expenseTransactionsCount: number;
  revenueBreakdown: ProfitLossCategoryBreakdownDto[];
  expenseBreakdown: ProfitLossCategoryBreakdownDto[];
  timeline: ProfitLossTimelinePointDto[];
  comparison?: ProfitLossComparisonDto;
}

export interface ProfitLossSummaryKpiDto {
  farmId: string;
  period: string;
  currency: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPercentage: number;
  isProfitable: boolean;
}
```

### 4.2 API Endpoints
- `GET /api/v1/financial/profit-loss`
  - Query Params: `startDate`, `endDate`, `interval`, `animalId`, `currency`, `includePreviousPeriod`.
  - Roles: `FarmRole.OWNER`, `FarmRole.MANAGER`.
  - Response: Unified envelope with `ProfitLossStatementResponseDto`.
- `GET /api/v1/financial/profit-loss/summary`
  - Query Params: `startDate`, `endDate`, `currency`.
  - Roles: `FarmRole.OWNER`, `FarmRole.MANAGER`, `FarmRole.HERDSMAN`.
  - Response: Unified envelope with `ProfitLossSummaryKpiDto`.

---

## 5. Security & Edge Cases
1. **Multi-Tenancy**: Scoped strictly by `farmId` validated by `TenantGuard`.
2. **Date Range Validation**:
   - `startDate <= endDate`.
   - Max date span restricted to 5 years (1826 days) to prevent DoS via unbounded queries.
3. **Safe Division**:
   - If `totalRevenue === 0`, `profitMarginPercentage` is set to `0.00` (or `-100.00` if expenses > 0) to avoid `NaN` or `Infinity`.
   - If `totalRevenue === 0`, `operatingExpenseRatio` is set to `0.00` (or `100.00` if expenses > 0).
4. **Soft-Deleted Transactions**:
   - All queries filter `deletedAt: null`.
5. **Optimistic & Offline Readiness**:
   - Respects standard `txDate` recorded timestamps.
