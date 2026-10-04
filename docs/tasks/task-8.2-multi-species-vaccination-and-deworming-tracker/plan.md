# PLAN-802: Multi-Species Vaccination and Deworming Schedule Tracker Step-by-Step Execution Plan

## Prerequisites
- Working database and Redis containers.
- Existing `VaccineRecord` table in Prisma schema.
- All existing test suites passing (100/100 suites passing).

---

## Granular Implementation Checklist

### Step 1: Shared Enums & DTO Contracts (`packages/shared-types`)
- [x] Add `VaccineRecordType` enum (`VACCINATION`, `DEWORMING`) in `packages/shared-types/src/enums/`
- [x] Add `PreventativeScheduleStatus` enum (`UPCOMING`, `DUE_SOON`, `OVERDUE`, `COMPLETED`) in `packages/shared-types/src/enums/`
- [x] Export enums in `packages/shared-types/src/enums/index.ts`
- [x] Create DTOs in `packages/shared-types/src/dto/clinical-health/`:
  - `create-vaccine-record.dto.ts`
  - `update-vaccine-record.dto.ts`
  - `vaccine-record-query.dto.ts`
  - `vaccine-record-response.dto.ts`
  - `vaccine-schedule-summary.dto.ts`
  - `species-vaccine-protocol.dto.ts`
- [x] Export DTOs from `packages/shared-types/src/dto/clinical-health/index.ts` and rebuild `@vetralink/shared-types`

### Step 2: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Define `VaccineRecordType` enum
  - Update `VaccineRecord` model with `recordType`, `cost`, `notes`, `syncVersion`, `updatedAt`
  - Add composite indexes:
    - `@@index([farmId, recordType, nextDueDate])`
    - `@@index([farmId, animalId, recordType])`
    - `@@index([farmId, administeredAt])`
- [x] Author migration SQL `apps/api/prisma/migrations/20260913080000_enhance_vaccine_records/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Implement `VaccineRecordEntity` in `apps/api/src/modules/clinical-health/entities/vaccine-record.entity.ts`
- [x] Write unit tests for `VaccineRecordEntity` in `apps/api/src/modules/clinical-health/entities/vaccine-record.entity.spec.ts`
- [x] Define `IVaccineRecordRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-record.repository.interface.ts`
- [x] Implement `VaccineRecordRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-record.repository.ts` with schedule queries and overdue detection
- [x] Write unit tests for `VaccineRecordRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-record.repository.spec.ts`

### Step 4: Species Protocols Catalog & DTOs
- [x] Implement `species-vaccine-protocols.catalog.ts` in `apps/api/src/modules/clinical-health/utils/` with multi-species protocols (`COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`, `POULTRY`)
- [x] Implement class-validator DTOs in `apps/api/src/modules/clinical-health/dto/`:
  - `create-vaccine-record.dto.ts`
  - `update-vaccine-record.dto.ts`
  - `vaccine-record-query.dto.ts`
  - `vaccine-schedule-query.dto.ts`

### Step 5: Domain Service & Business Logic
- [x] Define `IVaccineScheduleService` in `apps/api/src/modules/clinical-health/services/vaccine-schedule.service.interface.ts`
- [x] Implement `VaccineScheduleService` in `apps/api/src/modules/clinical-health/services/vaccine-schedule.service.ts`:
  - Tenant validation and animal status checks
  - Next due date validation and status derivation
  - Schedule summary metrics aggregation (due in 7d, 30d, overdue, total)
  - Multi-species protocol lookup
  - ACID transactions with audit log emission
- [x] Write unit tests for `VaccineScheduleService` in `apps/api/src/modules/clinical-health/services/vaccine-schedule.service.spec.ts`

### Step 6: Controller & API Routing
- [x] Implement `VaccineScheduleController` in `apps/api/src/modules/clinical-health/vaccine-schedule.controller.ts`
- [x] Write unit tests for `VaccineScheduleController` in `apps/api/src/modules/clinical-health/vaccine-schedule.controller.spec.ts`
- [x] Register controller, repository, and service in `apps/api/src/modules/clinical-health/clinical-health.module.ts`

### Step 7: Verification & Acceptance Testing
- [x] Run full test suites (`pnpm --filter @vetralink/api test`)
- [x] Run monorepo build (`pnpm build`)
- [x] Update `plan.md` and `ROADMAP.md`
