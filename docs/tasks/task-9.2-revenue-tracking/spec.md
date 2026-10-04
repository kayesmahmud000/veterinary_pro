# SPEC-902: Revenue Tracking (Milk Sales, Livestock Sales, Manure, Byproducts)

## 1. Feature Overview & Objective
A farm enterprise cannot survive without continuous visibility into its revenue streams. While dairy milk yields and livestock herds are the primary production assets, modern farms monetize several distinct outputs:
1. **Milk Sales (`MILK_SALES`)**: Commercial bulk tank milk pickups by dairy processors (e.g. daily/weekly milk invoices, fat/protein incentives) and local retail sales.
2. **Livestock Sales (`LIVESTOCK_SALES`)**: Sale of surplus dairy bull calves, breeding heifers, mature breeding rams/bucks, cull cows for beef, or broiler batches.
3. **Manure & Organic Fertilizer (`MANURE`)**: Sale of raw manure, bio-slurry from anaerobic digesters, aged compost, or vermicompost to neighboring crop farms or nursery operations.
4. **Byproducts (`BYPRODUCTS`)**: Sale of agricultural and animal byproducts such as hides, fleeces/wool, feathers, excess fodder silage, or surplus equipment resale.
5. **Other Miscellaneous Income (`OTHER`)**: Agricultural subsidies, government grant disbursements, agritourism farm tours, or breeding service stud fees.

**Objective**:
Implement an enterprise-grade, multi-tenant Revenue Tracking & Categorization service in VETRALINK PRO (Phase 3, Sprint 9, Task 9.2) that allows farm owners, managers, and authorized farm personnel to:
- Record, categorize, query, update, and soft-delete revenue transactions.
- Enforce strict double-entry ledger compatibility using `type: INCOME` in the unified `farm_transactions` table.
- Link revenues to individual animals where applicable (especially for `LIVESTOCK_SALES`, with optional automated status update to `AnimalStatus.SOLD`).
- Provide real-time category breakdown analytics (total revenue, percentage per category, top revenue driver, and daily timeline distribution).
- Ensure multi-tenant isolation (`farmId`), optimistic concurrency control (`syncVersion`), soft-deletion (`deletedAt`), and atomic database transaction-bound audit logging (`AuditLog`).

---

## 2. Current State vs. Proposed State

### Current State
- `FarmTransaction` table in `apps/api/prisma/schema.prisma` supports `type: TransactionType` (`INCOME`, `EXPENSE`), but `TransactionCategory` enum currently only contains:
  `[FEED, MEDICINE, LABOR, EQUIPMENT, UTILITY, MILK_SALES, LIVESTOCK_SALES, OTHER]`.
  It lacks `MANURE` and `BYPRODUCTS`.
- In Task 9.1, `FinancialModule` was created with `FarmExpenseRepository`, `FarmExpenseService`, and `FinancialExpenseController` for `/api/v1/financial/expenses`.
- No repository, service, DTOs, or controller exist for revenues (`type: INCOME`).

### Proposed State
- **Database Layer**:
  - Add `MANURE` and `BYPRODUCTS` to `TransactionCategory` enum in `schema.prisma`.
  - Create database migration script `apps/api/prisma/migrations/20260913130000_add_revenue_categories/migration.sql` and run `prisma generate`.
- **Shared Types (`packages/shared-types`)**:
  - Update `TransactionCategory` enum with `MANURE` and `BYPRODUCTS`.
  - Add revenue DTOs in `packages/shared-types/src/dto/financial/`:
    - `RecordRevenueDto`
    - `UpdateRevenueDto`
    - `RevenueQueryDto`
    - `RevenueSummaryQueryDto`
    - `RevenueResponseDto`
    - `RevenueSummaryResponseDto`
- **Backend Architecture (`apps/api/src/modules/financial/`)**:
  - `FarmRevenueEntity`: Pure domain entity with invariants:
    - `amount > 0`
    - ISO 4217 currency validation (defaults to "USD")
    - Revenue category validation (strictly allows `[MILK_SALES, LIVESTOCK_SALES, MANURE, BYPRODUCTS, OTHER]`, rejects expense categories like `FEED`, `MEDICINE`, `LABOR`, `EQUIPMENT`, `UTILITY`)
    - Valid transaction date
    - Optimistic concurrency check (`syncVersion`)
  - `IFarmRevenueRepository` & `FarmRevenueRepository`: Data access wrapper returning domain entities with multi-tenant filtering, pagination, search, soft deletes, and revenue category breakdown aggregations.
  - `IFarmRevenueService` & `FarmRevenueService`: Business logic orchestrator handling tenant isolation, animal validation, automated transition to `AnimalStatus.SOLD` when selling livestock, ACID database transactions, and audit log generation.
  - `FinancialRevenueController`: Protected REST API endpoints under `/api/v1/financial/revenues` guarded by `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.
  - Comprehensive unit test suites covering entity invariants, repository queries, service orchestration, and controller routing.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Unified `farm_transactions` Table vs Separate `farm_revenues` Table
- Retain the single `farm_transactions` table with `type: INCOME` and `type: EXPENSE`.
- *Justification*: Unifies all financial records under one ledger, simplifying P&L generation in Task 9.3 and allowing consistent audit logging and indexing.

### Trade-off 2: Automated Livestock Sale Status Update
- **Option A (Manual Animal Update)**:
  - The farmer must manually navigate to the animal registry to set status to `SOLD` after logging the revenue.
  - *Cons*: Prone to human error, leaving sold animals in the active milking herd and skewing inventory/FCR.
- **Option B (Transactional Livestock Sale Synchronization - SELECTED)**:
  - If `category === LIVESTOCK_SALES` and `animalId` is provided, verify the animal exists and is not already deceased or culled.
  - If `markAnimalAsSold: true` (default: true for livestock sales with animal ID), update the animal's status to `AnimalStatus.SOLD` in the same database transaction.
  - *Justification*: Prevents inventory discrepancy and guarantees atomic consistency across animal registry and ERP financials.

### Trade-off 3: Revenue Category Validation at Domain Level
- Define `VALID_REVENUE_CATEGORIES`: `[MILK_SALES, LIVESTOCK_SALES, MANURE, BYPRODUCTS, OTHER]`.
- Attempting to record revenue with an expense category (e.g. `FEED`, `MEDICINE`) is rejected immediately at the domain entity boundary.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Changes
```prisma
enum TransactionCategory {
  FEED
  MEDICINE
  LABOR
  EQUIPMENT
  UTILITY
  MILK_SALES
  LIVESTOCK_SALES
  MANURE
  BYPRODUCTS
  OTHER
}
```

### 4.2 API Contracts (Packages: `@vetralink/shared-types`)
- **`RecordRevenueDto`**:
  - `amount`: number (> 0, required)
  - `category`: `TransactionCategory` (`MILK_SALES`, `LIVESTOCK_SALES`, `MANURE`, `BYPRODUCTS`, `OTHER`)
  - `txDate`: string (ISO date YYYY-MM-DD)
  - `currency`?: string (default "USD")
  - `referenceNote`?: string (e.g. buyer name, invoice number)
  - `animalId`?: string (UUID, e.g. for livestock sales)
  - `markAnimalAsSold`?: boolean (defaults to true if animalId provided for livestock sales)
  - `receiptUrl`?: string (URL to buyer invoice or delivery receipt)
  - `metadata`?: Record<string, unknown> (e.g. quantityLiters, pricePerLiter, buyerPhone, paymentMethod)
- **`UpdateRevenueDto`**:
  - Partial fields from `RecordRevenueDto`
  - `syncVersion`: number (required for concurrency lock)
- **`RevenueQueryDto`**:
  - `startDate`?, `endDate`?, `category`?, `animalId`?, `search`?, `page`?, `limit`?, `sortBy`?, `sortOrder`?
- **`RevenueSummaryQueryDto`**:
  - `startDate`?, `endDate`?, `animalId`?
- **`RevenueResponseDto`**:
  - `id`, `farmId`, `recordedById`, `animalId`, `type`, `category`, `amount`, `currency`, `referenceNote`, `receiptUrl`, `metadata`, `txDate`, `syncVersion`, `createdAt`, `updatedAt`, `recordedBy`, `animal`
- **`RevenueSummaryResponseDto`**:
  - `startDate`, `endDate`, `currency`, `totalRevenue`, `totalTransactions`, `topCategory`, `byCategory`, `timeline`

---

## 5. Security & RBAC Guardrails
- `POST /api/v1/financial/revenues`: `OWNER`, `MANAGER`, `HERDSMAN`
- `GET /api/v1/financial/revenues`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`
- `GET /api/v1/financial/revenues/summary`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`
- `GET /api/v1/financial/revenues/:id`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`
- `PATCH /api/v1/financial/revenues/:id`: `OWNER`, `MANAGER`
- `DELETE /api/v1/financial/revenues/:id`: `OWNER`, `MANAGER`
- Multi-tenant tenant boundary enforced via `TenantGuard` and repository queries.
- Auditing: All mutations emit structured `AuditLog` records inside the same transaction (`CREATE_REVENUE`, `UPDATE_REVENUE`, `DELETE_REVENUE`).
