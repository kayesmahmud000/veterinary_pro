# PLAN-702: Step-by-Step Execution Plan for Task 7.2

## Prerequisites
- Task 7.1 completed and verified.
- PostgreSQL database accessible via `DATABASE_URL`.

---

## Granular Implementation Checklist

### Step 1: Database Migration (`apps/api/prisma/migrations/`)
- [x] `1.1`: Create migration `20260913040000_add_bulk_milk_log_uniqueness/migration.sql` creating partial unique index `uq_farm_bulk_milk_session`.
- [x] `1.2`: Run prisma migrate / verify schema synchronization.

### Step 2: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] `2.1`: Define `CreateBulkMilkLogRequestDto` in `packages/shared-types/src/dto/milk-logs/create-bulk-milk-log.dto.ts`.
- [x] `2.2`: Extend `MilkLogQueryRequestDto` to support `entryType?: "INDIVIDUAL" | "BULK" | "ALL"`.
- [x] `2.3`: Export new DTOs in `packages/shared-types/src/dto/milk-logs/index.ts`.
- [x] `2.4`: Build shared-types package (`pnpm --filter @vetralink/shared-types build`).

### Step 3: Entity & Repository Layer (`apps/api/src/modules/milk-logs/`)
- [x] `3.1`: Update `MilkLogEntity`:
  - Add `isBulk: boolean` getter (`this._animalId === null`).
  - Support bulk volume bounds (up to 100,000L).
- [x] `3.2`: Update `IMilkLogRepository`:
  - Add `findBulkBySessionAndDate(farmId, loggedDate, session)` method.
  - Support `entryType` filtering in `findMany`.
- [x] `3.3`: Implement repository changes in `MilkLogRepository`.

### Step 4: Domain Service & Business Logic
- [x] `4.1`: Add `createBulkMilkLog(farmId, actorUserId, dto, traceId)` to `IMilkLogService`.
- [x] `4.2`: Implement `createBulkMilkLog` in `MilkLogService`:
  - Validate volume (0.1L to 100,000L).
  - Validate non-future date.
  - Check for duplicate bulk session using `findBulkBySessionAndDate` -> throw `ConflictException`.
  - Persist inside transaction and emit `AuditLog` (`BULK_MILK_LOG_RECORDED`).

### Step 5: Controller & API Routing
- [x] `5.1`: Create API DTO `CreateBulkMilkLogDto` in `apps/api/src/modules/milk-logs/dto/create-bulk-milk-log.dto.ts`.
- [x] `5.2`: Add endpoint `POST /api/v1/milk-logs/bulk` to `MilkLogsController` with `@FarmRoles(OWNER, MANAGER, HERDSMAN, VET_STAFF)`.
- [x] `5.3`: Support `entryType` query filter in `GET /api/v1/milk-logs`.

### Step 6: Unit Tests & Verification
- [x] `6.1`: Add unit tests for `createBulkMilkLog` in `milk-log.service.spec.ts`.
- [x] `6.2`: Add unit tests for bulk endpoint in `milk-logs.controller.spec.ts`.
- [x] `6.3`: Add repository unit tests for bulk queries in `milk-log.repository.spec.ts`.
- [x] `6.4`: Run test suite (`pnpm --filter @vetralink/api test`) and build verification.
- [x] `6.5`: Check off items in `plan.md` and update `ROADMAP.md`.

---

## Verification & Acceptance Criteria
- Unit tests pass with 100% success rate.
- Duplicate bulk session submissions are rejected with `409 Conflict`.
- Bulk volumes up to 100,000L accepted, while non-positive or excessive volumes are rejected.
- Audit log is emitted with action `BULK_MILK_LOG_RECORDED`.
