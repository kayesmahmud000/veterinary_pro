# PLAN-604: Step-by-Step Execution Plan for Weight Tracking History & Growth Curves

## 1. Prerequisites & Dependencies
- [x] Task 6.3 completed, verified, and checked off.
- [x] PostgreSQL connection and Prisma client active.
- [x] Workspace builds cleanly with zero errors.

---

## 2. Implementation Checklist

### Step 1: Database Schema & Migration (`apps/api`)
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `model AnimalWeightLog` with relations to `Farm`, `Animal`, and `User`.
  - Add relation `weightLogs AnimalWeightLog[]` on `Animal` model.
  - Add relation `recordedWeightLogs AnimalWeightLog[]` on `User` model.
  - Add composite indices `@@index([farmId, animalId, recordedAt])`, `@@index([animalId, recordedAt])`, `@@index([farmId, recordedAt])`.
- [x] Create Prisma migration SQL `apps/api/prisma/migrations/20260913020000_add_animal_weight_logs/migration.sql`.
- [x] Re-generate Prisma Client (`pnpm --filter @vetralink/api exec prisma generate`).

### Step 2: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Update `packages/shared-types/src/enums/index.ts`:
  - Add `GrowthTrajectory` enum (`ACCELERATING`, `STEADY`, `SLOWING`, `WEIGHT_LOSS`).
- [x] Create `packages/shared-types/src/dto/animals/weight-tracking.dto.ts`:
  - Define `RecordWeightDto`, `AnimalWeightLogDto`, `GrowthCurvePointDto`, `GrowthCurveAnalyticsDto`, `WeightHistoryQueryDto`.
- [x] Export in `packages/shared-types/src/dto/animals/index.ts` and build `@vetralink/shared-types`.

### Step 3: Domain Entity & Validation (`apps/api`)
- [x] Create `apps/api/src/modules/animals/entities/animal-weight-log.entity.ts`:
  - Domain invariants: `weightKg > 0`, `weightKg <= 2500`, `recordedAt <= now()`.
  - Reconstitution and response serialization methods.

### Step 4: Repository Layer (`apps/api`)
- [x] Create `apps/api/src/modules/animals/repositories/animal-weight.repository.interface.ts`:
  - `create(log: AnimalWeightLogEntity, tx?: Prisma.TransactionClient): Promise<AnimalWeightLogEntity>;`
  - `findByAnimalId(animalId: string, farmId: string, options?: { startDate?: Date; endDate?: Date; page?: number; limit?: number }, tx?: Prisma.TransactionClient): Promise<{ items: AnimalWeightLogEntity[]; total: number }>;`
  - `findLatestByAnimalId(animalId: string, farmId: string, tx?: Prisma.TransactionClient): Promise<AnimalWeightLogEntity | null>;`
  - `delete(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<boolean>;`
- [x] Implement `apps/api/src/modules/animals/repositories/animal-weight.repository.ts`.
- [x] Bind in `animals.module.ts`.

### Step 5: Domain Service Layer & Growth Curve Engine (`apps/api`)
- [x] Update `apps/api/src/modules/animals/services/animals.service.interface.ts`:
  - Add `recordWeight(animalId: string, farmId: string, dto: RecordWeightDto, actorUserId: string, traceId?: string): Promise<AnimalWeightLogDto>;`
  - Add `getWeightHistory(animalId: string, farmId: string, query?: WeightHistoryQueryDto): Promise<{ items: AnimalWeightLogDto[]; total: number; page: number; limit: number }>;`
  - Add `getGrowthCurve(animalId: string, farmId: string): Promise<GrowthCurveAnalyticsDto>;`
  - Add `deleteWeightLog(animalId: string, weightLogId: string, farmId: string, actorUserId: string, traceId?: string): Promise<void>;`
- [x] Update `apps/api/src/modules/animals/services/animals.service.ts`:
  - Implement `recordWeight`: saves log, syncs `Animal.weightKg` in a transaction, emits `ANIMAL_WEIGHT_RECORDED` audit log.
  - Implement `getWeightHistory`: paginated historical weigh-in logs with age calculation.
  - Implement `getGrowthCurve`: computes interval ADG, overall ADG, cumulative gain, growth trajectory classification, and negative growth alerts.
  - Implement `deleteWeightLog`: removes log, recalibrates `Animal.weightKg` to latest remaining entry in a transaction, emits `ANIMAL_WEIGHT_DELETED` audit log.

### Step 6: Controller & Swagger DTOs (`apps/api`)
- [x] Create `apps/api/src/modules/animals/dto/record-weight.dto.ts` and `weight-history-query.dto.ts`.
- [x] Update `apps/api/src/modules/animals/animals.controller.ts`:
  - `POST /api/v1/animals/:id/weights`
  - `GET /api/v1/animals/:id/weights`
  - `GET /api/v1/animals/:id/growth-curve`
  - `DELETE /api/v1/animals/:id/weights/:weightId`

### Step 7: Unit & Integration Tests
- [x] Create `animal-weight-log.entity.spec.ts`: Test weight validations, dates, and response mapping.
- [x] Create `animal-weight.repository.spec.ts`: Test weight logging, pagination, latest entry query, and deletion.
- [x] Update `animals.service.spec.ts`: Test weight recording with animal synchronization, growth curve mathematics (interval ADG, overall ADG, trajectory status, alerts), and weight deletion.
- [x] Update `animals.controller.spec.ts`: Unit test controller endpoints.
- [x] Update `animals.int.spec.ts`: Supertest integration tests for all 4 endpoints with RBAC and multi-tenancy verification.

### Step 8: Verification & Build
- [x] Run test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 6.4 in `ROADMAP.md` and present conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **Time-Series Persistence:** Weigh-ins persist with timestamp, weight in kg, recorder user, and optional notes.
2. **Animal Synchronization:** `Animal.weight_kg` automatically reflects the latest logged weight; deleting the latest reverts to the preceding measurement.
3. **Growth Curve Calculations:** Accurate interval ADG (kg/day), overall ADG, and cumulative weight gain across chronological measurements.
4. **Trajectory & Alerts:** Accurately classifies trajectory (`ACCELERATING`, `STEADY`, `SLOWING`, `WEIGHT_LOSS`) and sets `hasWeightLossAlert: true` if an animal lost weight.
5. **Strict Multi-Tenancy:** Weight logs and analytics are strictly tenant-isolated (`farm_id`).
6. **Zero Regression:** 100% test pass rate across all unit and integration test suites.
