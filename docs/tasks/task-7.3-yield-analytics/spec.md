# SPEC-703: Daily, Weekly, and Monthly Milk Yield Analytics with 7-Day Moving Averages

## 1. Feature Overview & Objective

In modern precision dairy farming, monitoring daily milk output is the single most responsive operational and physiological telemetry stream available. Raw daily milk logs alone, however, exhibit significant high-frequency noise caused by weather swings, feed changes, milking session timing variances, or estrus cycles. 

To transform raw data into actionable decision-support telemetry, farm managers and veterinary practitioners require aggregated analytics across multiple time horizons:
1. **Daily Aggregation with 7-Day Simple Moving Average (7-SMA):** Smooths short-term fluctuations, highlighting genuine production trends and establishing the rolling baseline needed for anomaly detection.
2. **Weekly Aggregation:** Enables week-over-week operational comparisons, feeding regime evaluations, and parlour shift performance reviews.
3. **Monthly Aggregation:** Directly drives dairy farm financial forecasting, lactation curve analysis, and milk contract fulfillment tracking.
4. **Macro Production KPIs:** Identifies peak yield dates, low-yield troughs, active milking days, herd/animal daily averages, average fat/SNF milk quality metrics, and rolling trajectory direction (`INCREASING`, `DECREASING`, `STABLE`).

**Objective**:
Implement an enterprise-grade analytics engine in VETRALINK PRO that aggregates daily, weekly, and monthly milk production data, calculates a mathematical 7-day moving average (with a 6-day historical warm lookback window to prevent cold-start boundary distortion), supports scoped filtering by animal, entry type (`INDIVIDUAL`, `BULK`, `ALL`), and date intervals, and exposes a high-performance RESTful endpoint (`GET /api/v1/milk-logs/analytics`).

---

## 2. Current State vs. Proposed State

### Current State
- `MilkLog` table records individual milking sessions (`MORNING`, `AFTERNOON`, `EVENING`) for animals and bulk herd collections (`animal_id IS NULL`).
- `MilkLogsController` provides basic CRUD and paginated query endpoints (`GET /api/v1/milk-logs`), but returns flat lists of session records.
- No analytical aggregation, rolling moving averages, or weekly/monthly period groupings exist.
- Farm operators cannot visualize milk production trends, lactation trajectories, or quality metrics over time without manually computing them on raw exports.
- `MilkLogsModule` lacked `AuthModule` import, causing dependency injection failure for `JwtAuthGuard` in bootstrap tests.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - `MilkYieldAnalyticsQueryDto`: Query parameters supporting `animalId`, `startDate`, `endDate`, and `entryType`.
  - `DailyYieldPointDto`: Single date with session yield breakdown (`morning`, `afternoon`, `evening`), total daily yield, record count, average fat/SNF quality metrics, and calculated `movingAverage7Day`.
  - `WeeklyYieldPointDto`: ISO calendar week aggregation (`week`, `startDate`, `endDate`, `totalYieldLiters`, `dailyAverageYieldLiters`, `activeDaysCount`, `recordCount`, average quality).
  - `MonthlyYieldPointDto`: Year-month aggregation (`month`, `totalYieldLiters`, `dailyAverageYieldLiters`, `activeDaysCount`, `recordCount`, average quality).
  - `MilkYieldAnalyticsSummaryDto`: High-level KPIs (`totalYieldLiters`, `dailyAverageLiters`, `peakYieldDate`, `peakYieldLiters`, `lowestYieldDate`, `lowestYieldLiters`, `totalRecords`, `activeDays`, `averageFatPercent`, `averageSnfPercent`, `trendPercentage`, `trendDirection`).
  - `MilkYieldAnalyticsResponseDto`: Structured composite envelope returned to client.
- **Database & Repository Layer (`IMilkLogRepository`)**:
  - Add `findLogsForAnalytics(farmId, filter)`: Efficiently retrieves chronologically sorted records within `[startDate - 6 days, endDate]` with tenant scoping and index utilization.
- **Domain Service & Analytics Engine (`IMilkLogService`)**:
  - Implements `getYieldAnalytics(farmId, query)`:
    - Normalizes date ranges (defaults to trailing 30 days if omitted).
    - Fetches raw records with a 6-day lookback window.
    - Assembles continuous daily time series.
    - Computes 7-day Simple Moving Average (7-SMA) for every day in the requested range.
    - Groups records into ISO calendar weeks and calendar months.
    - Calculates summary statistics and trend slope.
- **REST API (`MilkLogsController`)**:
  - `GET /api/v1/milk-logs/analytics`: Scoped via `JwtAuthGuard`, `TenantGuard`, and `FarmRoles`.
- **Module Wiring (`MilkLogsModule`)**:
  - Import `AuthModule` to resolve `TOKEN_SERVICE` dependency injection.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: In-Memory Domain Aggregation vs. Complex PostgreSQL SQL Window Functions
- **Option A (SQL Window Functions & Aggregations via Raw Query)**:
  - Write complex SQL using `generate_series`, `SUM() OVER (ORDER BY logged_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`, and `DATE_TRUNC`.
  - *Cons*: Highly database-vendor specific, difficult to mock in unit tests, breaks Clean Architecture by embedding business rules in SQL, and handling weighted averages vs session breakdowns becomes fragile across nullable `animal_id` rows.
- **Option B (Domain Service Calculation over Filtered Dataset - SELECTED)**:
  - Query sorted, filtered records from the repository within the target window (`startDate - 6 days` to `endDate`), and perform the calendar aggregation and rolling moving average in a dedicated domain utility within Node.js.
  - *Pros*: Completely database-agnostic, easily unit-tested with deterministic fixtures, highly readable and maintainable, allows rich formatting (session breakdowns, trend slopes, quality metric rounding), and for a typical single-farm date range (30-365 days, <10,000 session rows), execution takes <2 milliseconds.
  - *Justification*: Aligns with Section 2.1 Clean Architecture rules: "Domain / Entity — Pure business rules. No framework deps. No DB deps."

### Trade-off 2: Handling Cold-Start on the 7-Day Moving Average
- **Option A (Strict Query Interval Only)**:
  - Only query records between `startDate` and `endDate`.
  - *Cons*: The first 6 days of the response would have partial moving averages (e.g. Day 1 is an average of 1 day, Day 2 of 2 days), producing misleading trend spikes at the beginning of graphs.
- **Option B (Historical Warm Lookback Window - SELECTED)**:
  - Automatically query records starting from `startDate - 6 days` (the warm-up window).
  - Use the warm-up window to seed the 7-SMA calculation, but only return daily data points starting from `startDate` in the final response.
  - *Pros*: Every single day in the client response possesses a complete, accurate 7-day rolling average.
  - *Justification*: Industry standard for financial and telemetry time series reporting.

---

## 4. Mathematical Models & Analytics Formulas

### 4.1 Daily Total Yield
For day $d \in [\text{startDate}, \text{endDate}]$:
$$Y(d) = \sum_{s \in \{\text{MORNING}, \text{AFTERNOON}, \text{EVENING}\}} y(d, s)$$

### 4.2 7-Day Simple Moving Average (7-SMA)
For day $d$:
$$\text{SMA}_7(d) = \frac{1}{7} \sum_{k=0}^{6} Y(d - k)$$
*(If the animal/farm was active on subset $D_{\text{active}} \subseteq [d-6, d]$, the average is calculated over the calendar window of 7 days, reflecting true daily farm throughput).*

### 4.3 Quality Metrics (Fat % and SNF %)
Arithmetic mean of non-null quality parameters:
$$\overline{\text{Fat}}(d) = \frac{\sum_{i=1}^{n} \text{fat}_i}{n} \quad (\text{where } \text{fat}_i \ne \text{null})$$

### 4.4 Trend Trajectory & Direction
Comparing the rolling average at the end of the period ($\text{SMA}_{\text{end}}$) with the initial baseline ($\text{SMA}_{\text{start}}$):
$$\Delta\% = \frac{\text{SMA}_{\text{end}} - \text{SMA}_{\text{start}}}{\text{SMA}_{\text{start}}} \times 100$$
- If $\Delta\% \ge +3\%$: `INCREASING`
- If $\Delta\% \le -3\%$: `DECREASING`
- Otherwise: `STABLE`

---

## 5. Data Models & API Contracts

### 5.1 Query Parameters (`MilkYieldAnalyticsQueryDto`)
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `animalId` | UUID | No | `undefined` | Scopes analytics to an individual animal |
| `startDate` | String (YYYY-MM-DD) | No | 30 days prior to today | Start date of the analytical window |
| `endDate` | String (YYYY-MM-DD) | No | Today | End date of the analytical window |
| `entryType` | Enum (`INDIVIDUAL`, `BULK`, `ALL`) | No | `ALL` | Filters record source |

### 5.2 API Response Schema
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Milk yield analytics retrieved successfully",
  "data": {
    "farmId": "11111111-1111-1111-1111-111111111111",
    "animalId": null,
    "startDate": "2026-08-14",
    "endDate": "2026-09-13",
    "summary": {
      "totalYieldLiters": 12450.5,
      "dailyAverageLiters": 415.02,
      "peakYieldDate": "2026-09-02",
      "peakYieldLiters": 485.2,
      "lowestYieldDate": "2026-08-15",
      "lowestYieldLiters": 340.0,
      "totalRecords": 90,
      "activeDays": 30,
      "averageFatPercent": 3.82,
      "averageSnfPercent": 8.54,
      "trendPercentage": 4.12,
      "trendDirection": "INCREASING"
    },
    "daily": [
      {
        "date": "2026-08-14",
        "totalYieldLiters": 395.5,
        "morningYieldLiters": 210.0,
        "afternoonYieldLiters": 185.5,
        "eveningYieldLiters": 0,
        "recordCount": 2,
        "averageFatPercent": 3.8,
        "averageSnfPercent": 8.5,
        "movingAverage7Day": 391.2
      }
    ],
    "weekly": [
      {
        "week": "2026-W33",
        "startDate": "2026-08-10",
        "endDate": "2026-08-16",
        "totalYieldLiters": 2750.0,
        "dailyAverageYieldLiters": 392.86,
        "activeDaysCount": 7,
        "recordCount": 14,
        "averageFatPercent": 3.81,
        "averageSnfPercent": 8.52
      }
    ],
    "monthly": [
      {
        "month": "2026-08",
        "totalYieldLiters": 7250.0,
        "dailyAverageYieldLiters": 402.78,
        "activeDaysCount": 18,
        "recordCount": 36,
        "averageFatPercent": 3.83,
        "averageSnfPercent": 8.53
      }
    ]
  },
  "traceId": "c4b12a88-251f-4bb2-a5d5-9473bbf80b80",
  "timestamp": "2026-09-13T11:55:00.000Z"
}
```

---

## 6. Security & Edge Cases
1. **Tenant Scoping**: All queries strictly enforce `farmId` validated by `TenantGuard`.
2. **Date Invariants**: `startDate` must be $\le$ `endDate`. `endDate` cannot be in the future. Maximum query range capped at 730 days (2 years) to prevent memory exhaustion.
3. **Empty Data Handling**: When zero logs exist in the queried range, the endpoint returns an empty dataset with zeroed summary statistics and `trendDirection: "STABLE"`, rather than throwing an error.
4. **Days with Zero Yield**: When charting daily yields, missing dates within the interval are populated with zero yield and the continuous rolling moving average, preventing charting visual anomalies.
5. **Precision & Rounding**: All volumes and averages rounded to 2 decimal places to eliminate floating point precision artifacts (e.g. `0.1 + 0.2 = 0.30000000000000004`).
