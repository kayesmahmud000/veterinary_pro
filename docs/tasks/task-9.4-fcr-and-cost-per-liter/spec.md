# Task 9.4: Feed Conversion Ratio (FCR) & Cost-Per-Liter Milk Computation Specification

## 1. Feature Overview & Objective
In modern livestock and dairy operations, feeding represents 50%–70% of total farm operating expenditures (OPEX). Profitability hinges on two vital efficiency benchmarks:
1. **Cost-Per-Liter (CPL) Milk Computation**:
   Quantifies the unit cost of milk production across any user-defined date range (`startDate` to `endDate`), disaggregating feed cost per liter, overhead operating cost per liter, realized milk revenue per liter, and net dairy margin per liter.
2. **Feed Conversion Ratio (FCR) & Feed Efficiency**:
   - **Dairy Feed Efficiency**: Ratio of milk yield generated per kilogram of feed consumed ($\text{kg milk or liters} / \text{kg dry matter / feed}$ and $\text{kg feed} / \text{liter milk}$).
   - **Growth / Meat FCR**: For livestock cohorts and individual animals, computes the ratio of total feed intake (kg) to live weight gain ($\text{FCR} = \frac{\Delta \text{Feed (kg)}}{\Delta \text{Weight (kg)}}$) and feed cost per kilogram of gain.

This engine links the **Financial Ledger** (`farm_transactions` with `category: FEED`), **Production Engine** (`milk_logs`), and **Biometric Growth Logs** (`animal_weight_logs`) into unified, real-time analytical KPIs and trend series.

---

## 2. Current State vs. Proposed State

### Current State
- `FarmTransaction` stores financial income and expenses, categorized into `FEED`, `MEDICINE`, `LABOR`, `EQUIPMENT`, `UTILITY`, `MILK_SALES`, etc.
- `MilkLog` records daily morning, afternoon, and evening milking sessions per animal or bulk tank.
- `AnimalWeightLog` tracks periodic animal weight records with timestamps.
- Prior to this task, there is no cross-domain analytical service or domain model connecting feed costs to milk output volume or weight gain. Farm managers cannot determine their break-even milk price or detect sub-optimal feed conversion.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `CostPerLiterQueryDto`, `CostPerLiterResponseDto`, `CostPerLiterTimelinePointDto`.
  - `FeedConversionQueryDto`, `FeedConversionResponseDto`, `AnimalFcrItemDto`.
  - Enums and metrics for feed efficiency ratings.
- **Domain Entities (`apps/api/src/modules/financial/entities/`)**:
  - `CostPerLiterEntity`: Pure domain entity computing feed cost per liter, total operating cost per liter, realized revenue per liter, net margin per liter, and break-even price with zero-division safety and rounding.
  - `FeedConversionEntity`: Pure domain entity computing livestock growth FCR and dairy feed efficiency, evaluating against biological standard benchmarks.
- **Repository Layer (`apps/api/src/modules/financial/repositories/`)**:
  - `IFarmFeedAnalyticsRepository` & `FarmFeedAnalyticsRepository`: Cross-queries Prisma `farmTransaction` (feed & operating expenses, milk revenues), `milkLog` (yields in liters), and `animalWeightLog` (weight gains).
- **Domain Service Layer (`apps/api/src/modules/financial/services/`)**:
  - `IFarmFeedAnalyticsService` & `FarmFeedAnalyticsService`: Orchestrates queries, calculates KPIs, and handles date range resolution and optional feed intake overrides.
- **Controller Layer (`apps/api/src/modules/financial/`)**:
  - `FinancialFeedAnalyticsController`:
    - `GET /api/v1/financial/analytics/cost-per-liter`
    - `GET /api/v1/financial/analytics/feed-conversion`
  - Guarded with `JwtAuthGuard`, `TenantGuard`, and `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`.

---

## 3. Architectural & Design Trade-offs

| Decision Area | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Cross-Domain Data Sourcing** | Duplicate milk logs and weight logs inside the financial ledger | Cross-repository read aggregation via dedicated repository query | **Option B** preserves single source of truth in PostgreSQL schemas (`milk_logs`, `animal_weight_logs`, `farm_transactions`) while allowing the financial module to aggregate cross-functional data efficiently. |
| **Feed Intake Estimation** | Require every feed purchase transaction to have strict kg metadata | Dual-source: Extract `quantityKg` from feed transaction metadata or accept user override `assumedFeedKg` / `dailyFeedPerHeadKg` | **Option B** accommodates both sophisticated farms logging precise feed intake weights and smallholders tracking feed by lump-sum purchase receipts. |
| **Timeline Analytics** | Aggregate overall period as a single static metric | Return overall summary KPI plus synchronized timeline array (daily/weekly/monthly) | **Option B** empowers frontend charts to display cost-per-liter and feed efficiency trends over time, helping identify feed spikes or yield drops. |

---

## 4. Mathematical Models & Invariants

### 4.1 Cost-Per-Liter (CPL) Formulas
$$\text{Total Milk Yield (L)} = \sum \text{yieldLiters} \quad (\text{from non-deleted milk logs})$$
$$\text{Feed Cost per Liter} = \frac{\text{Total Feed Expense}}{\text{Total Milk Yield (L)}}$$
$$\text{Operating Cost per Liter} = \frac{\text{Total Operating Expenses}}{\text{Total Milk Yield (L)}}$$
$$\text{Revenue per Liter} = \frac{\text{Total Milk Revenue}}{\text{Total Milk Yield (L)}}$$
$$\text{Net Margin per Liter} = \text{Revenue per Liter} - \text{Operating Cost per Liter}$$
$$\text{Feed Cost Share (\%)} = \frac{\text{Total Feed Expense}}{\text{Total Operating Expenses}} \times 100$$
$$\text{Break-Even Milk Price} = \text{Operating Cost per Liter}$$

*Zero-Division Protection*: If $\text{Total Milk Yield} = 0$, unit costs, revenues, and margins default to $0.00$.

### 4.2 Feed Conversion Ratio (FCR) Formulas
$$\text{Live Weight Gain (kg)} = \text{Final Weight} - \text{Initial Weight}$$
$$\text{Livestock Growth FCR} = \frac{\text{Total Feed Consumed (kg)}}{\text{Live Weight Gain (kg)}}$$
$$\text{Feed Cost per kg Gain} = \frac{\text{Total Feed Expense}}{\text{Live Weight Gain (kg)}}$$
$$\text{Dairy Feed Efficiency (kg/L)} = \frac{\text{Total Feed Consumed (kg)}}{\text{Total Milk Yield (L)}}$$
$$\text{Milk Yield per kg Feed (L/kg)} = \frac{\text{Total Milk Yield (L)}}{\text{Total Feed Consumed (kg)}}$$

---

## 5. Security & Multi-Tenancy
- All SQL/Prisma queries scope strictly by `farmId` with `deletedAt: null`.
- Optional `animalId` filter isolates single-animal metrics.
- Access restricted to `FarmRole.OWNER` and `FarmRole.MANAGER`.
