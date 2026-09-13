# SPEC-702: Bulk Herd Milk Collection Logging for Commercial Operations

## 1. Feature Overview & Objective
In medium to large commercial dairy operations, measuring individual milk yields for hundreds of cows at every session via manual stanchion scales or individual flow meters is not always feasible or practiced. Instead, milk from parlour milking clusters flows directly into milk pipelines connected to a centralized refrigerated bulk milk cooling tank (bulk tank).

Bulk collection logging represents the authoritative macro production volume for the entire farm or species herd. In addition, quality parameters such as Bulk Tank Somatic Cell Count (BTSCC), bulk Fat %, bulk Solids-Not-Fat (SNF) %, and refrigerated tank temperature (°C) are tested at the bulk tank level before tanker truck dispatch.

**Objective**:
Implement a dedicated Bulk Herd Milk Collection Logging capability in VETRALINK PRO that enables commercial farm operators to record, query, update, and manage session-level bulk tank milk yields (`MORNING`, `AFTERNOON`, `EVENING`) where `animal_id IS NULL`, with composite uniqueness constraints, bulk volume validation (up to 100,000L/session), quality parameter tracking, metadata extensibility, and transactional audit logging.

---

## 2. Current State vs. Proposed State

### Current State
- `MilkLog` model in `schema.prisma` allows `animalId` to be nullable (`animalId String? @map("animal_id") @db.Uuid`), designated in `ARCHITECTURE.md` as "Nullable for bulk/herd yield".
- In PostgreSQL, standard multi-column unique index `@@unique([farmId, animalId, loggedDate, session])` does not treat `NULL` as distinct without a partial index, meaning multiple rows with `animal_id IS NULL` could bypass database-level uniqueness if not guarded.
- Task 7.1 implemented individual animal logging (`CreateMilkLogDto`), where `animalId` is required and validated for female dairy animals.
- No dedicated bulk herd collection DTOs, service methods, or API endpoints exist yet.

### Proposed State
- **Database & Schema**:
  - Add PostgreSQL partial unique index:
    `CREATE UNIQUE INDEX uq_farm_bulk_milk_session ON milk_logs(farm_id, logged_date, session) WHERE animal_id IS NULL;`
  - Optional metadata JSON on `MilkLog` to store operational parameters (`milkingAnimalsCount`, `tankTemperatureCelsius`, `notes`).
- **Shared Types (`packages/shared-types`)**:
  - `CreateBulkMilkLogRequestDto`: Session, yieldLiters (up to 100,000L), fatPercent, snfPercent, loggedDate, and optional metadata.
  - `UpdateBulkMilkLogRequestDto`: Partial updates to bulk yield and quality attributes.
  - Enhanced `MilkLogQueryRequestDto`: Added `entryType?: "INDIVIDUAL" | "BULK" | "ALL"` filter.
- **Service & Repository Layer (`apps/api/src/modules/milk-logs/`)**:
  - `IMilkLogRepository`: Enhanced `findBySessionAndDate` to handle `animalId: null` for bulk queries. Added `findBulkBySessionAndDate(farmId, loggedDate, session)`.
  - `IMilkLogService`: Implements `createBulkMilkLog`, validating date, session, volume bounds (0.1L to 100,000L), duplicate detection, and atomic transaction audit logging (`BULK_MILK_LOG_RECORDED`).
- **REST API Endpoints (`MilkLogsController`)**:
  - `POST /api/v1/milk-logs/bulk`: Record bulk tank session collection.
  - `GET /api/v1/milk-logs`: Query supporting `entryType=BULK` or `entryType=INDIVIDUAL`.
- **Unit & Integration Tests**: Comprehensive tests covering valid bulk entries, duplicate conflicts, future date rejections, volume boundaries, and controller routing.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Separate Table (`bulk_milk_logs`) vs. Polymorphic Nullable Column on `milk_logs`
- **Option A (Separate Table `bulk_milk_logs`)**:
  - Create a new distinct table specifically for bulk tank logs.
  - *Cons*: Fragments milk analytics, reporting, and revenue calculations. Every aggregate query (e.g. daily farm total, 7-day moving averages in Task 7.3, P&L in Sprint 9) would require a `UNION ALL` between individual logs and bulk logs.
- **Option B (Single Table with Nullable `animal_id` - SELECTED)**:
  - Maintain single `milk_logs` table where `animal_id IS NULL` denotes a bulk herd collection.
  - *Pros*: Follows existing schema design in `ARCHITECTURE.md`. Unifies analytics, reporting, and exports. Single index scan calculates overall farm milk yields.
  - *Justification*: Standard data warehousing and AgTech pattern for mixed individual/bulk dairy recording.

### Trade-off 2: Enforcing Bulk Uniqueness (Database Partial Index vs. Application Guard)
- **Option A (Application-Only Check)**:
  - Only check `findBySessionAndDate(farmId, null, date, session)` in service logic.
  - *Cons*: Vulnerable to race conditions when multiple concurrent parlour operators submit bulk collections simultaneously.
- **Option B (Database Partial Index + Service Guard - SELECTED)**:
  - Add partial unique index:
    `CREATE UNIQUE INDEX uq_farm_bulk_milk_session ON milk_logs(farm_id, logged_date, session) WHERE animal_id IS NULL;`
  - *Pros*: 100% ACID concurrency guarantee at database engine level, perfectly paired with Prisma's P2002 error mapping.
  - *Justification*: Prevents phantom duplicate entries and double-counting of daily production totals.

---

## 4. Data Models & Contracts

### 4.1 Schema Migration
```sql
-- apps/api/prisma/migrations/20260913040000_add_bulk_milk_log_uniqueness/migration.sql
CREATE UNIQUE INDEX IF NOT EXISTS "uq_farm_bulk_milk_session" 
ON "milk_logs"("farm_id", "logged_date", "session") 
WHERE "animal_id" IS NULL;
```

### 4.2 Shared DTO Contracts
```typescript
// packages/shared-types/src/dto/milk-logs/create-bulk-milk-log.dto.ts
export interface CreateBulkMilkLogRequestDto {
  readonly session: MilkSession;
  readonly yieldLiters: number;
  readonly fatPercent?: number | null;
  readonly snfPercent?: number | null;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly milkingAnimalsCount?: number | null;
  readonly tankTemperatureCelsius?: number | null;
  readonly notes?: string | null;
}
```

### 4.3 REST API Endpoints
| Method | Path | Auth/Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/milk-logs/bulk` | JWT, Tenant, Roles (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) | Record bulk herd collection for a session |
| `GET` | `/api/v1/milk-logs?entryType=BULK` | JWT, Tenant, Roles (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) | Query bulk herd collection logs with date filtering |

---

## 5. Security & Edge Cases
1. **Multi-Tenancy**: All operations strictly scoped by `farmId` validated by `TenantGuard`.
2. **Volume Boundaries**: Bulk yield must be between 0.1 and 100,000 liters per session.
3. **Date Invariants**: `loggedDate` cannot be in the future.
4. **Duplicate Conflicts**: Repeated submission for the same farm, date, and session throws `409 Conflict`.
5. **Cold Chain Parameters**: `tankTemperatureCelsius` (if provided) validated between -5.0°C and 45.0°C.
