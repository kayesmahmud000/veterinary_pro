# Task 9.5: Comprehensive Monthly Farm Performance PDF Statement Generator Specification

## 1. Feature Overview & Objective
Agricultural enterprises, farm lenders, dairy cooperatives, and tax authorities require an official, comprehensive, and tamper-evident monthly statement summarizing a farm's operational and financial health. 

This task introduces the **Monthly Farm Performance PDF Statement Generator**. The engine aggregates:
1. **Executive Financial Ledger (P&L)**: Gross Revenue, Operating Expenses, Net Profit/Loss, and Profit Margins.
2. **Detailed Category Breakdown**: Granular revenue and expense category allocations with percentage shares.
3. **Dairy Production & Unit Economics**: Total Milk Yield (L), Daily Average Yield (L/day), Feed Cost per Liter, Operating Cost per Liter, Revenue per Liter, Net Margin per Liter, and Break-Even Milk Price.
4. **Feed Efficiency & Biological Benchmarks**: Total Feed Intake (kg), Feed Cost ($/kg), Dairy Feed-to-Milk Ratio (kg/L), and Growth FCR with standard efficiency ratings.
5. **PDF Document Generation**: High-fidelity vector PDF document rendered programmatically via `pdf-lib` with cryptographic verification hash, executive header, structured tables, and page footers.

---

## 2. Current State vs. Proposed State

### Current State
- Tasks 9.1 through 9.4 delivered:
  - Expense tracking categorizer (`FarmExpenseEntity`, `FarmExpenseRepository`, `FarmExpenseService`)
  - Revenue tracking (`FarmRevenueEntity`, `FarmRevenueRepository`, `FarmRevenueService`)
  - Real-time Profit & Loss engine (`FarmProfitLossEntity`, `FarmProfitLossRepository`, `FarmProfitLossService`)
  - Feed Conversion Ratio & Cost-per-Liter computation (`CostPerLiterEntity`, `FeedConversionEntity`, `FarmFeedAnalyticsService`)
- Currently, farm managers can only view these metrics on screen via disparate REST endpoints. There is no downloadable, print-ready, or archivable monthly executive statement PDF.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `MonthlyStatementQueryDto`: specifies `year`, `month`, and optional `currency`.
  - `MonthlyPerformanceStatementDto`: structured JSON contract of all aggregated statement sections.
- **Domain & PDF Engine (`apps/api/src/modules/financial/pdf/`)**:
  - `FarmPerformancePdfGenerator`: Uses `pdf-lib` to render high-contrast, professional A4 PDF reports with executive summary tiles, breakdown tables, dairy unit economics, FCR ratings, and verification footers.
- **Service Layer (`apps/api/src/modules/financial/services/`)**:
  - `IFarmPerformanceStatementService` & `FarmPerformanceStatementService`:
    - Validates year and month bounds (`month >= 1 && month <= 12`).
    - Synthesizes Farm metadata, P&L statement, Cost-Per-Liter, and FCR analytics.
    - Generates binary PDF document buffer (`application/pdf`) and JSON metadata.
- **Controller Layer (`apps/api/src/modules/financial/`)**:
  - `FinancialStatementController`:
    - `GET /api/v1/financial/statements/monthly-pdf`: Streams downloadable PDF buffer with headers `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="farm-statement-<slug>-YYYY-MM.pdf"`.
    - `GET /api/v1/financial/statements/monthly-summary`: Returns structured JSON summary.
    - Guarded with `JwtAuthGuard`, `TenantGuard`, and `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`.

---

## 3. Architectural & Design Trade-offs

| Decision Area | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **PDF Rendering Technology** | Headless Chrome (Puppeteer / Playwright) with HTML/CSS templates | Pure programmatic vector PDF generation via `pdf-lib` | **Option B** is 100x lighter in memory, has zero external browser binary dependencies, starts in <5ms, and executes deterministically across all environments (Windows, Linux, Docker). |
| **Data Aggregation Strategy** | Re-implement raw database queries specifically for PDF generation | Reuse existing domain services (`FarmProfitLossService`, `FarmFeedAnalyticsService`) | **Option B** honors DRY (Don't Repeat Yourself) and guarantees 100% mathematical consistency between API responses and exported PDF statements. |
| **Response Format** | PDF download endpoint only | Dual endpoints: Streamed PDF (`/monthly-pdf`) and Structured JSON (`/monthly-summary`) | **Option B** empowers web/mobile clients to preview statement figures in UI dashboards before triggering the full PDF download. |

---

## 4. Document Layout & Styling Specification (A4)
- **Geometry**: Standard A4 (`595.28 x 841.89 pt`), 40pt margins, printable safe-zone.
- **Color Palette**:
  - Primary Brand: Dark Forest Green (`rgb(0.08, 0.35, 0.22)`)
  - Accent Gold: (`rgb(0.78, 0.62, 0.22)`)
  - Charcoal Text: (`rgb(0.15, 0.15, 0.15)`)
  - Light Gray Table Headers & Borders: (`rgb(0.92, 0.94, 0.93)`)
  - Alert Red (Loss): (`rgb(0.80, 0.15, 0.15)`)
  - Success Green (Profit): (`rgb(0.12, 0.55, 0.25)`)
- **Typography**: Standard Helvetica & Helvetica-Bold.
- **Sections**:
  1. Header Bar: Logo title, Farm details, Reporting Period, Document ID / Verification hash.
  2. Executive Financial Summary: 5-column metric block (Revenue, Expenses, Net Profit, Margin %, OPEX Ratio).
  3. Side-by-side Revenue & Expense Breakdown Tables.
  4. Dairy Production & Cost-Per-Liter Card.
  5. Feed Efficiency & Livestock FCR Card.
  6. Footer: Disclaimer, page numbers, generated timestamp.

---

## 5. Security & Edge Cases
1. **Tenant Isolation**: Strictly scoped by `farmId` validated by `TenantGuard`.
2. **Access Control**: Limited to `FarmRole.OWNER` and `FarmRole.MANAGER`.
3. **Invalid Dates**: Rejects invalid months (`month < 1 || month > 12`) and future years.
4. **Zero-Activity Months**: Renders gracefully with zero values and `$0.00` metrics without crashing.
