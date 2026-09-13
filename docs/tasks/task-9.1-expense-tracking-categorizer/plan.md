# PLAN-901: Expense Tracking Categorizer Step-by-Step Execution Plan

## Prerequisites
- PostgreSQL 16 & Redis 7 active in Docker Compose environment.
- All existing 117 test suites (1076 tests) passing.
- Monorepo dependencies installed.

---

## Granular Implementation Checklist

### Step 1: Enums & Type Contracts in `@vetralink/shared-types`
- [x] Add `UTILITY` to `TransactionCategory` in `packages/shared-types/src/enums/index.ts`.
- [x] Create `packages/shared-types/src/dto/financial/record-expense.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/update-expense.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/expense-query.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/expense-summary-query.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/expense-response.dto.ts`
- [x] Create `packages/shared-types/src/dto/financial/expense-summary-response.dto.ts`
- [x] Export all financial DTOs from `packages/shared-types/src/dto/financial/index.ts` and `packages/shared-types/src/dto/index.ts`
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`)

### Step 2: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `UTILITY` to `enum TransactionCategory`
  - Extend `model FarmTransaction` with `animalId`, `receiptUrl`, `metadata`, `syncVersion`, `updatedAt`, `deletedAt`
  - Add `transactions FarmTransaction[]` on `Animal` model
  - Add composite indexes: `[farmId, txDate]`, `[farmId, type, txDate]`, `[farmId, type, category, txDate]`, `[farmId, animalId]`, `[farmId, deletedAt]`
- [x] Create SQL migration script in `apps/api/prisma/migrations/20260913120000_add_farm_transactions_expense_categorizer/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Implement `FarmExpenseEntity` in `apps/api/src/modules/financial/entities/farm-expense.entity.ts` with business invariants
- [x] Write unit tests for `FarmExpenseEntity` in `apps/api/src/modules/financial/entities/farm-expense.entity.spec.ts`
- [x] Define `IFarmExpenseRepository` in `apps/api/src/modules/financial/repositories/farm-expense.repository.interface.ts`
- [x] Implement `FarmExpenseRepository` in `apps/api/src/modules/financial/repositories/farm-expense.repository.ts`
- [x] Write unit tests for `FarmExpenseRepository` in `apps/api/src/modules/financial/repositories/farm-expense.repository.spec.ts`

### Step 4: API DTOs (class-validator & Swagger)
- [x] Create `apps/api/src/modules/financial/dto/record-expense.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/update-expense.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/expense-query.dto.ts`
- [x] Create `apps/api/src/modules/financial/dto/expense-summary-query.dto.ts`
- [x] Export DTOs from `apps/api/src/modules/financial/dto/index.ts`

### Step 5: Domain Service & Business Logic
- [x] Define `IFarmExpenseService` in `apps/api/src/modules/financial/services/farm-expense.service.interface.ts`
- [x] Implement `FarmExpenseService` in `apps/api/src/modules/financial/services/farm-expense.service.ts`:
  - Tenant isolation and validation
  - Animal ownership and status verification
  - Expense category domain validation
  - Optimistic concurrency control via `syncVersion`
  - Soft-delete semantics
  - Category breakdown and analytics computation
  - Atomic database transactions with `AuditLog` records for `CREATE`, `UPDATE`, `DELETE`
- [x] Write comprehensive unit tests for `FarmExpenseService` in `apps/api/src/modules/financial/services/farm-expense.service.spec.ts`

### Step 6: Controller & API Routing
- [x] Implement `FinancialExpenseController` in `apps/api/src/modules/financial/financial-expense.controller.ts`:
  - `POST /api/v1/financial/expenses`
  - `GET /api/v1/financial/expenses`
  - `GET /api/v1/financial/expenses/summary`
  - `GET /api/v1/financial/expenses/:id`
  - `PATCH /api/v1/financial/expenses/:id`
  - `DELETE /api/v1/financial/expenses/:id`
  - Route guards: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`
- [x] Write unit tests for `FinancialExpenseController` in `apps/api/src/modules/financial/financial-expense.controller.spec.ts`
- [x] Wire `FinancialModule` in `apps/api/src/modules/financial/financial.module.ts` and register in `apps/api/src/app.module.ts`

### Step 7: Verification & Acceptance Criteria
- [x] Run unit tests for all financial module components (40/40 passed)
- [x] Run full test suite (`pnpm --filter @vetralink/api test` - 121/121 test suites passed, 1116 tests passed)
- [x] Run build checks (`pnpm build` - all 3 packages built successfully)
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`
