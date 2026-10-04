# PLAN-704: Execution Plan for Milk Yield Anomaly Detection Worker & Clinical Alerts

## Prerequisites
- Working NestJS monorepo (`@vetralink/api` and `@vetralink/shared-types`).
- `MilkLog` table, repository, and service from Tasks 7.1–7.3.
- BullMQ and Redis connection configured in `app.module.ts`.

---

## Implementation Steps

### Step 1: Database Migration & Schema Update
- [x] Add `MilkAnomalySeverity` and `MilkAnomalyStatus` enums to `apps/api/prisma/schema.prisma`.
- [x] Add `MilkYieldAnomaly` model to `apps/api/prisma/schema.prisma` with relations to `Farm`, `Animal`, and `User`.
- [x] Create PostgreSQL migration SQL file under `apps/api/prisma/migrations/20260913060000_add_milk_yield_anomalies/migration.sql`.
- [x] Generate Prisma Client (`pnpm --filter @vetralink/api prisma:generate`).

### Step 2: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/enums/milk-anomaly-severity.enum.ts`.
- [x] Create `packages/shared-types/src/enums/milk-anomaly-status.enum.ts`.
- [x] Create `packages/shared-types/src/dto/milk-logs/milk-anomaly.dto.ts`:
  - `MilkAnomalyJobType` (`ANIMAL_DROP_CHECK`, `FARM_DAILY_SCAN`)
  - `MilkAnomalyJobPayload`
  - `MilkAnomalyResponseDto`
  - `MilkAnomalyQueryRequestDto`
  - `AcknowledgeMilkAnomalyRequestDto`
  - `ResolveMilkAnomalyRequestDto`
  - `TriggerAnomalyScanRequestDto`
  - `AnomalyScanResultDto`
  - `PaginatedMilkAnomaliesDto`
- [x] Export enums and DTOs in `packages/shared-types/src/index.ts`.
- [x] Build shared types package (`pnpm --filter @vetralink/shared-types build`).

### Step 3: Domain Entity & Repository Layer (`apps/api/src/modules/milk-logs`)
- [x] Create `apps/api/src/modules/milk-logs/entities/milk-yield-anomaly.entity.ts`.
- [x] Create `apps/api/src/modules/milk-logs/repositories/milk-yield-anomaly.repository.interface.ts`:
  - `upsert(entity: MilkYieldAnomalyEntity): Promise<MilkYieldAnomalyEntity>`
  - `findById(id: string, farmId: string): Promise<MilkYieldAnomalyEntity | null>`
  - `findByAnimalAndDate(farmId: string, animalId: string, loggedDate: Date): Promise<MilkYieldAnomalyEntity | null>`
  - `findMany(farmId: string, filter: MilkAnomalyQueryFilter): Promise<{ items: MilkYieldAnomalyEntity[]; total: number }>`
- [x] Implement `apps/api/src/modules/milk-logs/repositories/milk-yield-anomaly.repository.ts`.

### Step 4: BullMQ Queue Producer & Background Worker
- [x] Create `apps/api/src/modules/milk-logs/services/milk-anomaly-queue.service.interface.ts`.
- [x] Implement `apps/api/src/modules/milk-logs/services/milk-anomaly-queue.service.ts`.
- [x] Create `apps/api/src/modules/milk-logs/processors/milk-anomaly.processor.ts`:
  - Handles `ANIMAL_DROP_CHECK`: computes 7-day preceding baseline, calculates drop %, upserts anomaly alert if $\ge 20\%$.
  - Handles `FARM_DAILY_SCAN`: iterates active milking animals on farm for target date, dispatches checks, returns scan summary.

### Step 5: Domain Service & MilkLog Event Triggering
- [x] Create `apps/api/src/modules/milk-logs/services/milk-anomaly.service.interface.ts`.
- [x] Implement `apps/api/src/modules/milk-logs/services/milk-anomaly.service.ts`:
  - `evaluateAnimalYieldDrop(farmId: string, animalId: string, targetDate: Date, traceId?: string): Promise<MilkYieldAnomalyEntity | null>`
  - `queryAnomalies(farmId: string, query: MilkAnomalyQueryRequestDto): Promise<PaginatedMilkAnomaliesDto>`
  - `acknowledgeAnomaly(id: string, farmId: string, userId: string, dto: AcknowledgeMilkAnomalyRequestDto): Promise<MilkAnomalyResponseDto>`
  - `resolveAnomaly(id: string, farmId: string, userId: string, dto: ResolveMilkAnomalyRequestDto): Promise<MilkAnomalyResponseDto>`
  - `triggerFarmScan(farmId: string, userId: string, dto: TriggerAnomalyScanRequestDto): Promise<AnomalyScanResultDto>`
- [x] In `MilkLogService.createMilkLog`:
  - Automatically enqueue `ANIMAL_DROP_CHECK` into BullMQ queue upon successful log creation.

### Step 6: Controller Endpoints & Module Wiring
- [x] In `apps/api/src/modules/milk-logs/milk-logs.controller.ts`:
  - `GET /api/v1/milk-logs/anomalies`: Query alerts with status, severity, date filters.
  - `POST /api/v1/milk-logs/anomalies/scan`: Trigger on-demand farm scan.
  - `PATCH /api/v1/milk-logs/anomalies/:id/acknowledge`: Acknowledge alert.
  - `PATCH /api/v1/milk-logs/anomalies/:id/resolve`: Resolve alert.
- [x] In `apps/api/src/modules/milk-logs/milk-logs.module.ts`:
  - Register `MILK_ANOMALY_QUEUE` BullMQ queue.
  - Register repository, queue service, anomaly service, and processor.

### Step 7: Unit & Integration Tests Verification
- [x] Unit tests for `MilkYieldAnomalyEntity`.
- [x] Unit tests for `MilkYieldAnomalyRepository`.
- [x] Unit tests for `MilkAnomalyProcessor`.
- [x] Unit tests for `MilkAnomalyService`.
- [x] Unit tests for `MilkLogsController` anomaly endpoints.
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run TypeScript compilation: `pnpm --filter @vetralink/api build`.
- [x] Check off items in `plan.md` and mark Task 7.4 as complete in `ROADMAP.md`.
