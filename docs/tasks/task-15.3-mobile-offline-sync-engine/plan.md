# Implementation Plan: Task 15.3 - Mobile Offline Sync Engine (Flutter SQLite/WatermelonDB <-> NestJS REST Sync)

## Prerequisites
- Database models with `syncVersion`, `updatedAt`, `deletedAt` in `apps/api/prisma/schema.prisma`.
- Shared types package `@vetralink/shared-types`.
- NestJS API core in `apps/api/src/`.
- Flutter mobile app in `apps/mobile/`.

---

## Implementation Steps (Atomic Checklist)

- [x] **Step 1: Shared Types & DTO Contracts (`@vetralink/shared-types`)**
  - Create `packages/shared-types/src/dto/sync/sync-pull.dto.ts`:
    - `SyncPullRequestDto`
    - `SyncPullResponseDto`
    - `SyncTableChangesDto<T>`
  - Create `packages/shared-types/src/dto/sync/sync-push.dto.ts`:
    - `SyncPushRequestDto`
    - `SyncPushResponseDto`
    - `SyncConflictItemDto`
  - Create `packages/shared-types/src/dto/sync/sync-entities.dto.ts`:
    - `SyncAnimalDto`
    - `SyncMilkLogDto`
    - `SyncHealthRecordDto`
    - `SyncVaccineRecordDto`
    - `SyncWeightLogDto`
    - `SyncTransactionDto`
  - Re-export sync DTOs in `packages/shared-types/src/dto/sync/index.ts`, `packages/shared-types/src/dto/index.ts`, and `packages/shared-types/src/index.ts`.
  - Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

- [x] **Step 2: NestJS Sync Module Architecture (`apps/api/src/modules/sync/`)**
  - Create `SyncRepository` & `ISyncRepository`:
    - `pullFarmDeltas(farmId: string, since: Date | null)`
    - `applyPushMutations(farmId: string, userId: string, changes: any, since: Date)`
    - `getFarmSyncSummary(farmId: string)`
  - Create `SyncService` & `ISyncService`:
    - `pull(userId: string, farmId: string, lastPulledAt?: number | null)`
    - `push(userId: string, farmId: string, lastPulledAt: number, changes: any, traceId?: string)`
    - `getStatus(userId: string, farmId: string)`
  - Create `SyncController`:
    - `POST /api/v1/sync/pull`
    - `POST /api/v1/sync/push`
    - `GET /api/v1/sync/status/:farmId`
  - Register `SyncModule` in `apps/api/src/app.module.ts`.

- [x] **Step 3: Flutter Offline Database & Sync Engine (`apps/mobile/lib/core/sync/`)**
  - Create `apps/mobile/lib/core/sync/sync_models.dart`:
    - Data models for pull/push payloads and entity representations.
  - Create `apps/mobile/lib/core/sync/offline_database.dart`:
    - SQLite schema initialization using `sqflite`.
    - Tables: `animals`, `milk_logs`, `health_records`, `vaccine_records`, `animal_weight_logs`, `farm_transactions`, `sync_queue`, `sync_metadata`.
  - Create `apps/mobile/lib/core/sync/sync_client.dart`:
    - Dio REST client for `/api/v1/sync/pull` and `/api/v1/sync/push`.
  - Create `apps/mobile/lib/core/sync/offline_sync_engine.dart`:
    - Coordinates bidirectional sync:
      1. Inspect `sync_queue`.
      2. If pending mutations exist, dispatch `POST /api/v1/sync/push`.
      3. On success, purge synced queue items and apply conflict resolutions.
      4. Query `POST /api/v1/sync/pull` with `lastPulledAt`.
      5. Upsert created/updated records into SQLite, purge deleted records.
      6. Persist new `last_pulled_at` in `sync_metadata`.

- [x] **Step 4: Unit & Integration Test Suites**
  - Create `apps/api/src/modules/sync/sync.service.spec.ts` testing:
    - Delta pull returns records modified after timestamp.
    - Tenant isolation rejects non-member farm requests.
    - Batch push applies creates, updates, and deletes atomically.
    - Last-write-wins detects conflicts and emits conflict report.
    - Audit log record emitted on push.
  - Create `apps/api/src/modules/sync/sync.controller.spec.ts` testing:
    - `@Post('pull')`, `@Post('push')`, and `@Get('status/:farmId')` endpoints.
  - Create Flutter unit tests in `apps/mobile/test/sync/sync_models_test.dart`.
  - Run tests: `pnpm --filter @vetralink/api test sync`.
  - Run API build: `pnpm --filter @vetralink/api build`.

- [x] **Step 5: Documentation & Roadmap Sign-off**
  - Update `ROADMAP.md` marking Task 15.3 `[x]`.
  - Check off all items in `plan.md`.
  - Report completion with summary, test results, and suggested commit message at human-in-the-loop gate.

---

## Verification & Acceptance Criteria
- Delta pull `/api/v1/sync/pull` returns modified entities since `lastPulledAt` and server timestamp.
- Batch push `/api/v1/sync/push` atomically creates, updates, and deletes records with audit logging.
- Optimistic concurrency detects conflicts if server has newer modifications.
- Multi-tenant isolation prevents cross-farm data leakage.
- Flutter SQLite schema and sync engine are completely implemented with end-to-end sync lifecycle.
- All unit and integration tests pass cleanly with 100% success rate.
