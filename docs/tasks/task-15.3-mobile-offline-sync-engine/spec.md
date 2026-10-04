# Specification: Task 15.3 - Mobile Offline Sync Engine (Flutter SQLite/WatermelonDB <-> NestJS REST Sync)

## 1. Feature Overview & Objective
Veterinary surgeons, herdsmen, and dairy farm operators frequently work in rural, remote barn environments with zero, intermittent, or 2G/3G-degraded mobile connectivity. Despite the absence of live internet, field personnel must be able to:
1. Register new livestock, inspect animal pedigree, and log ear tag numbers.
2. Record morning, afternoon, and evening milk yields per cow or herd.
3. Document clinical health events, diagnoses, treatments, and medication administration.
4. Record vaccinations and deworming doses.
5. Log animal weight measurements for growth trajectory analytics.
6. Record immediate farm expenses (feed purchases, veterinary supplies, fuel) and revenues.

The objective of Task 15.3 is to establish a **high-reliability, bidirectional Offline Synchronization Engine** connecting the Flutter mobile client (`apps/mobile`) with the NestJS API gateway (`apps/api`).

### Key Capabilities:
1. **Delta Pull Protocol (`POST /api/v1/sync/pull`)**:
   - Accepts `farmId` and `lastPulledAt` (timestamp in milliseconds, or null for initial full sync).
   - Queries and returns incremental changes (`created`, `updated`, `deleted`) across 6 core farm entities: `animals`, `milk_logs`, `health_records`, `vaccine_records`, `weight_logs`, `farm_transactions`.
   - Returns a cryptographically sound `serverTimestamp` to be stored as the client's new sync watermark.
2. **Batch Push Protocol (`POST /api/v1/sync/push`)**:
   - Accepts a batch of client-created, updated, or deleted mutations with client-generated UUIDs.
   - Executes mutations within ACID database transactions scoped strictly to `farmId`.
   - Employs **Last-Write-Wins (LWW) with Optimistic Concurrency Control** via `syncVersion` and `updatedAt`.
   - Returns applied counts, conflict resolutions, and server timestamp.
3. **Flutter Local Persistence & Sync Client (`apps/mobile/lib/core/sync/`)**:
   - Local SQLite database (`sqflite`) matching backend relational schemas.
   - `sync_queue` table capturing uncommitted local mutations when offline.
   - `sync_metadata` table storing per-farm sync watermarks (`last_pulled_at`, `last_pushed_at`).
   - `OfflineSyncEngine` orchestrating bidirectional push-then-pull synchronization with network retry and conflict handling.

---

## 2. Current State vs. Proposed State

### Current State:
- Models in `schema.prisma` (`Animal`, `MilkLog`, `HealthRecord`, `VaccineRecord`, `AnimalWeightLog`, `FarmTransaction`) have `syncVersion Int @default(1) @map("sync_version")` and `updatedAt` / `deletedAt` timestamps.
- However, there is no centralized sync module, no REST endpoints for delta pull or batch push, and no offline sync coordination logic.
- The Flutter mobile workspace (`apps/mobile`) has dependencies (`sqflite`, `dio`, `path_provider`, `uuid`) in `pubspec.yaml`, but the `lib/core` and `lib/features` directories are empty stubs.

### Proposed State:
- `@vetralink/shared-types` exports full sync contracts:
  - `SyncPullRequestDto`, `SyncPullResponseDto`, `SyncPushRequestDto`, `SyncPushResponseDto`, `SyncConflictItemDto`, and entity-specific delta types.
- `apps/api/src/modules/sync/` provides:
  - `SyncController`: `@Post('pull')`, `@Post('push')`, `@Get('status/:farmId')`.
  - `SyncService`: Validates tenant authorization, computes delta changes, executes atomic batch mutations, handles LWW conflicts, emits audit logs.
  - `SyncRepository`: High-performance indexed queries for entities updated after `lastPulledAt`, and atomic transactional batch execution.
- `apps/mobile/lib/core/sync/` provides:
  - `offline_database.dart`: SQLite tables for `animals`, `milk_logs`, `health_records`, `vaccine_records`, `animal_weight_logs`, `farm_transactions`, `sync_queue`, `sync_metadata`.
  - `sync_models.dart`: Strongly-typed Dart DTOs matching backend contracts.
  - `sync_client.dart`: Dio HTTP client handling `/api/v1/sync/pull` and `/api/v1/sync/push`.
  - `offline_sync_engine.dart`: Complete synchronization coordinator (push local queue -> apply push response -> pull remote deltas -> update local SQLite -> advance sync watermark).

---

## 3. Architectural & Design Trade-offs

### Option A: WebSockets / CRDTs (Conflict-Free Replicated Data Types)
- **Pros**: Continuous real-time peer-to-peer sync, automatic mathematically provable convergence.
- **Cons**: Excessive overhead for rural intermittent 2G/3G networks, complex memory footprint on low-end Android hardware, requires persistent socket connections that rapidly drain battery.
### Option B: Delta-Based REST Sync with Last-Write-Wins (LWW) & Client-Generated UUIDs
- **Pros**:
  - Extremely resilient over high-latency, flaky cellular links (works over standard HTTPS requests).
  - Clean separation: client works 100% offline with SQLite using client-generated UUIDs (`UUIDv4`).
  - Server maintains absolute source of truth with ACID transactions and audit logs.
  - Standard WatermelonDB / SQLite sync architecture compatible with both Flutter and Web PWAs.
- **Decision**: Implement Option B. This matches enterprise agtech standards (Trimble, FarmIQ) and satisfies the project's multi-tenant isolation and auditability requirements.

---

## 4. Data Models & Contracts

### 4.1 Sync Protocol Envelope

#### Pull Request:
```typescript
interface SyncPullRequestDto {
  farmId: string;
  lastPulledAt?: number | null; // Milliseconds Unix epoch (null for initial full sync)
}
```

#### Pull Response:
```typescript
interface SyncPullResponseDto {
  farmId: string;
  serverTimestamp: number; // Current server time in ms, becomes next lastPulledAt
  changes: {
    animals: { created: SyncAnimalDto[]; updated: SyncAnimalDto[]; deleted: string[] };
    milkLogs: { created: SyncMilkLogDto[]; updated: SyncMilkLogDto[]; deleted: string[] };
    healthRecords: { created: SyncHealthRecordDto[]; updated: SyncHealthRecordDto[]; deleted: string[] };
    vaccineRecords: { created: SyncVaccineRecordDto[]; updated: SyncVaccineRecordDto[]; deleted: string[] };
    weightLogs: { created: SyncWeightLogDto[]; updated: SyncWeightLogDto[]; deleted: string[] };
    transactions: { created: SyncTransactionDto[]; updated: SyncTransactionDto[]; deleted: string[] };
  };
}
```

#### Push Request:
```typescript
interface SyncPushRequestDto {
  farmId: string;
  lastPulledAt: number;
  changes: {
    animals?: { created?: SyncAnimalDto[]; updated?: SyncAnimalDto[]; deleted?: string[] };
    milkLogs?: { created?: SyncMilkLogDto[]; updated?: SyncMilkLogDto[]; deleted?: string[] };
    healthRecords?: { created?: SyncHealthRecordDto[]; updated?: SyncHealthRecordDto[]; deleted?: string[] };
    vaccineRecords?: { created?: SyncVaccineRecordDto[]; updated?: SyncVaccineRecordDto[]; deleted?: string[] };
    weightLogs?: { created?: SyncWeightLogDto[]; updated?: SyncWeightLogDto[]; deleted?: string[] };
    transactions?: { created?: SyncTransactionDto[]; updated?: SyncTransactionDto[]; deleted?: string[] };
  };
}
```

#### Push Response:
```typescript
interface SyncPushResponseDto {
  success: boolean;
  serverTimestamp: number;
  appliedCounts: {
    animals: number;
    milkLogs: number;
    healthRecords: number;
    vaccineRecords: number;
    weightLogs: number;
    transactions: number;
  };
  conflicts: Array<{
    table: string;
    recordId: string;
    reason: string;
    resolution: 'SERVER_WINS' | 'CLIENT_APPLIED';
  }>;
}
```

---

## 5. Security & Edge Cases
1. **Multi-Tenant Isolation**: Every sync pull and push strictly validates that the requesting user is an active member or owner of `farmId`. Any attempt to sync another farm's data results in `ForbiddenException`.
2. **Client-Generated UUIDs**: All mobile offline records are minted with UUIDv4. If a record already exists on the server with identical ID, push treats it as an update, preventing duplicate insertions.
3. **Optimistic Concurrency & LWW**:
   - If a client updates a record that was modified on the server after `lastPulledAt`, the server compares timestamps.
   - If server timestamp is newer, server retains its version and flags a conflict (`SERVER_WINS`).
   - If client timestamp is newer or equal, client change is applied and `syncVersion` is incremented.
4. **Soft Deletions**: Entities with soft-delete (`animals`, `farm_transactions`) are never physically removed during sync; their `deletedAt` timestamp is set and their ID is broadcasted to clients in the `deleted` delta array.
5. **Audit Logging**: Every push operation emits an audit log record (`OFFLINE_SYNC_PUSHED`) recording the counts and tables mutated.
