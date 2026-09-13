# SPEC-901: Expense Tracking Categorizer (Feed, Veterinary Drugs, Labor, Utility, Equipment)

## 1. Feature Overview & Objective
In livestock farm management (dairy, beef, mixed, and poultry), daily operating expenses constitute the largest component of working capital. Uncontrolled feed costs, unexpected veterinary medical treatments, utility surges (electricity, water, diesel generator fuel), and equipment breakdowns frequently erode farm profit margins.

To support the Farm ERP Financial Ledger and Profit & Loss (P&L) Engine (Phase 3, Sprint 9), VETRALINK PRO requires a robust, multi-tenant Expense Tracking & Categorization service that enables farm owners, managers, herdsmen, and attending veterinary personnel to:
1. **Record Operational Expenses**: Capture transactional costs in real time with monetary precision, currency, transaction date, invoice/reference numbers, receipt attachments, and optional animal attribution (e.g. medical treatments or individual feed additives).
2. **Standardize Expense Categorization**: Classify disbursements into authoritative operational cost centers:
   - `FEED`: Concentrates, silage, hay, mineral licks, milk replacers, fodder additives.
   - `MEDICINE`: Veterinary prescription drugs, antibiotics, vaccines, dewormers, clinical supplies.
   - `LABOR`: Herdsman wages, farm staff salaries, temporary labor, veterinary consultation fees.
   - `EQUIPMENT`: Milking machinery repair, tractor servicing, barn sanitation tools, spare parts.
   - `UTILITY`: Electricity, clean water supply, diesel generator fuel, biogas maintenance, heating/cooling.
   - `OTHER`: General overheads (licensing, biosecurity tests, waste disposal, transport packaging).
3. **Multi-Dimensional Querying & Filtering**: Allow fast filtering by date ranges, expense category, individual animal ID, and keyword search across transaction reference notes.
4. **Real-Time Category Breakdown & Analytics**: Provide on-demand summary analytics aggregating total expenditure, breakdown per category (monetary sum, transaction count, and relative percentage), top cost drivers, and daily timeline distribution.
5. **Data Integrity, Concurrency & Tamper-Evident Auditing**: Enforce strict multi-tenant boundary checks (`farmId`), optimistic concurrency control (`syncVersion`), soft-deletion (`deletedAt`), and atomic database transaction-bound audit logging (`AuditLog`).

---

## 2. Current State vs. Proposed State

### Current State
- `apps/api/prisma/schema.prisma` contains the `FarmTransaction` table with basic schema (`id`, `farmId`, `recordedById`, `type`, `category`, `amount`, `currency`, `referenceNote`, `txDate`, `createdAt`), but lacks:
  - `animalId` foreign key (linking expenses to individual animals).
  - `receiptUrl` / `attachmentUrl` (for proof-of-purchase documents).
  - `metadata` (JSONB for custom vendor, payment method, tax, and itemized quantity details).
  - `syncVersion` (for offline synchronization and optimistic locking).
  - `updatedAt` and `deletedAt` (violating Guardrail-06: Soft Deletes on Master/Ledger Data).
  - `UTILITY` in the `TransactionCategory` enum.
- `packages/shared-types` defines `TransactionType` and `TransactionCategory`, but misses `UTILITY`, and contains no DTOs or query/summary contracts for farm financial transactions.
- No financial module, repository, entity, service, or controller currently exists in `apps/api/src/modules/financial/`.

### Proposed State
- **Database Layer**:
  - Add `UTILITY` to `TransactionCategory` enum in `schema.prisma`.
  - Extend `FarmTransaction` with `animalId`, `receiptUrl`, `metadata`, `syncVersion`, `updatedAt`, and `deletedAt`.
  - Add back-relation `transactions FarmTransaction[]` on `Animal` model.
  - Add composite indexes:
    - `@@index([farmId, type, txDate])`
    - `@@index([farmId, type, category, txDate])`
    - `@@index([farmId, animalId])`
    - `@@index([farmId, deletedAt])`
  - Execute database migration script and run `prisma generate`.
- **Shared Types (`packages/shared-types`)**:
  - Update `TransactionCategory` enum with `UTILITY`.
  - Add `RecordExpenseDto`, `UpdateExpenseDto`, `ExpenseQueryDto`, `ExpenseSummaryQueryDto`, `ExpenseResponseDto`, `ExpenseCategorySummaryDto`, `ExpenseSummaryResponseDto`.
- **Backend Architecture (`apps/api/src/modules/financial/`)**:
  - `FarmExpenseEntity`: Pure domain entity with invariants:
    - `amount > 0`
    - ISO 4217 currency code (3 uppercase letters, defaults to 'USD')
    - Expense category validation (rejects revenue categories like `MILK_SALES`, `LIVESTOCK_SALES`)
    - Transaction date validation (cannot be in the far future)
    - Concurrency check on updates (`syncVersion`)
  - `IFarmExpenseRepository` & `FarmExpenseRepository`: Data access wrapper returning domain entities with multi-tenant filtering, pagination, and category aggregations.
  - `IFarmExpenseService` & `FarmExpenseService`: Business logic orchestrator enforcing tenant isolation, animal validation, audit log generation inside ACID transactions, and summary computation.
  - `FinancialExpenseController`: Clean REST API endpoints under `/api/v1/financial/expenses` guarded by `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.
  - Comprehensive unit test suites covering entity invariants, repository queries, service orchestration, and controller routing.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Unified `FarmTransaction` Table vs. Separate `FarmExpense` Table
- **Option A (Separate `farm_expenses` and `farm_revenues` tables)**:
  - Create separate schemas for expenses and income.
  - *Cons*: Fractures the financial ledger into two tables. Calculating comprehensive Farm Profit & Loss (P&L) in Task 9.3 would require union queries or cross-table aggregation, complicating indexes, audit trails, and reporting.
- **Option B (Unified `farm_transactions` with `TransactionType` discriminator - SELECTED)**:
  - Utilize the existing `FarmTransaction` model with `type: EXPENSE` (for Task 9.1) and `type: INCOME` (for Task 9.2).
  - *Pros*: Follows double-entry and single-ledger AgTech ERP standards. Enables single-query P&L computations (`SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)`), shared audit trail conventions, and unified database indexes.
  - *Justification*: Recommended in `ARCHITECTURE.md` Section 4.9 and preserves schema integrity.

### Trade-off 2: Expense Category Discrimination & Validation
- **Option A (Rely solely on Postgres Enum without Domain Constraints)**:
  - Allow any `TransactionCategory` to be submitted with `type: EXPENSE`.
  - *Cons*: Allows corrupt ledger states (e.g. recording an expense under `MILK_SALES`).
- **Option B (Strict Domain Rule Enforcement - SELECTED)**:
  - Maintain a strict set of valid expense categories:
    `[FEED, MEDICINE, LABOR, EQUIPMENT, UTILITY, OTHER]`.
  - Reject any expense creation/update attempting to use income-only categories (`MILK_SALES`, `LIVESTOCK_SALES`).
  - *Pros*: Guaranteed ledger integrity at the domain model level before database persistence.

### Trade-off 3: Financial Precision (Prisma Decimal vs Number)
- **Option A (Store as integer cents in DB)**:
  - Convert amounts to integer cents.
  - *Cons*: Incompatible with existing schema (`Decimal(12, 2)`) and milk yield decimals.
- **Option B (Database Decimal(12, 2) mapped to Number with 2 decimal rounding in DTO - SELECTED)**:
  - Retain `Decimal(12, 2)` in PostgreSQL for financial calculations up to $9,999,999,999.99, serialized to JSON numbers with two decimal places in API responses.
  - *Pros*: Complies with `ARCHITECTURE.md` and standard financial reporting.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Definition
```prisma
model FarmTransaction {
  id            String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId        String              @map("farm_id") @db.Uuid
  recordedById  String              @map("recorded_by_id") @db.Uuid
  animalId      String?             @map("animal_id") @db.Uuid
  type          TransactionType
  category      TransactionCategory
  amount        Decimal             @db.Decimal(12, 2)
  currency      String              @default("USD") @db.VarChar(3)
  referenceNote String?             @map("reference_note") @db.Text
  receiptUrl    String?             @map("receipt_url") @db.Text
  metadata      Json                @default("{}")
  txDate        DateTime            @map("transaction_date") @db.Date
  syncVersion   Int                 @default(1) @map("sync_version")
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime            @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt     DateTime?           @map("deleted_at") @db.Timestamptz(6)

  farm       Farm    @relation(fields: [farmId], references: [id], onDelete: Restrict)
  recordedBy User    @relation(fields: [recordedById], references: [id], onDelete: Restrict)
  animal     Animal? @relation(fields: [animalId], references: [id], onDelete: SetNull)

  @@index([farmId, txDate])
  @@index([farmId, type, txDate])
  @@index([farmId, type, category, txDate])
  @@index([farmId, animalId])
  @@index([farmId, deletedAt])
  @@map("farm_transactions")
}
```

### 4.2 API Contracts (Packages: `@vetralink/shared-types`)
- **`RecordExpenseDto`**:
  - `amount`: number (> 0, required)
  - `category`: `TransactionCategory` (`FEED`, `MEDICINE`, `LABOR`, `EQUIPMENT`, `UTILITY`, `OTHER`)
  - `txDate`: string (ISO 8601 date, e.g. `2026-09-13`)
  - `currency`?: string (3-letter uppercase, defaults to `USD`)
  - `referenceNote`?: string (max 500 chars)
  - `animalId`?: string (UUID)
  - `receiptUrl`?: string (URL)
  - `metadata`?: Record<string, unknown>
- **`UpdateExpenseDto`**:
  - Optional partial fields from `RecordExpenseDto`
  - `syncVersion`: number (required for concurrency lock)
- **`ExpenseQueryDto`**:
  - `startDate`?: string (ISO date)
  - `endDate`?: string (ISO date)
  - `category`?: `TransactionCategory`
  - `animalId`?: string (UUID)
  - `search`?: string
  - `page`?: number (default: 1)
  - `limit`?: number (default: 20, max: 100)
  - `sortBy`?: 'txDate' | 'amount' | 'createdAt'
  - `sortOrder`?: 'asc' | 'desc'
- **`ExpenseSummaryQueryDto`**:
  - `startDate`?: string (defaults to 30 days ago)
  - `endDate`?: string (defaults to current date)
  - `animalId`?: string
- **`ExpenseResponseDto`**:
  - `id`, `farmId`, `recordedById`, `animalId`, `type`, `category`, `amount`, `currency`, `referenceNote`, `receiptUrl`, `metadata`, `txDate`, `syncVersion`, `createdAt`, `updatedAt`
  - Embedded recorder: `{ id, name, email }`
  - Embedded animal: `{ id, tagNumber, name, species } | null`
- **`ExpenseSummaryResponseDto`**:
  - `startDate`: string
  - `endDate`: string
  - `totalExpense`: number
  - `currency`: string
  - `totalTransactions`: number
  - `topCategory`: `TransactionCategory` | null
  - `byCategory`: `Array<{ category: TransactionCategory; totalAmount: number; transactionCount: number; percentage: number }>`
  - `timeline`: `Array<{ date: string; amount: number; transactionCount: number }>`

---

## 5. Security, RBAC & Multi-Tenancy

1. **Multi-Tenant Isolation**:
   - `TenantGuard` extracts and verifies tenant from `x-farm-id` or active session.
   - All repository queries filter strictly by `farmId` and `deletedAt IS NULL`.
   - If an optional `animalId` is supplied, it is validated to ensure it exists and belongs to the caller's `farmId`.
2. **Role-Based Access Control**:
   - `POST /api/v1/financial/expenses`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`.
   - `GET /api/v1/financial/expenses`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`.
   - `GET /api/v1/financial/expenses/summary`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`.
   - `GET /api/v1/financial/expenses/:id`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`.
   - `PATCH /api/v1/financial/expenses/:id`: `OWNER`, `MANAGER` only.
   - `DELETE /api/v1/financial/expenses/:id`: `OWNER`, `MANAGER` only.
3. **Audit Trail**:
   - All mutations (`CREATE`, `UPDATE`, `DELETE`) emit a structured `AuditLog` inside the same database transaction with trace ID, actor user ID, previous values, and new values.
4. **Validation & Edge Cases**:
   - Amount `<= 0` triggers `400 Bad Request`.
   - Attempting to record an expense under `MILK_SALES` or `LIVESTOCK_SALES` triggers `400 Bad Request`.
   - Concurrency mismatch (`syncVersion`) triggers `409 Conflict`.
   - Soft-deleted animal (`deletedAt !== null`) cannot be linked to new expenses (`422 Unprocessable Entity`).
