# Offline synchronization

## Observed protocol

Sources: `apps/api/src/modules/sync/controllers/sync.controller.ts`, `services/sync.service.ts`, `repositories/sync.repository.ts`; shared DTOs under `packages/shared-types/src/dto/`; Flutter `apps/mobile/lib/core/sync/`.

- `POST /api/v1/sync/pull`: `farmId` and optional `lastPulledAt`; returns `serverTimestamp` and `changes`.
- `POST /api/v1/sync/push`: `farmId`, `lastPulledAt`, table changes; returns applied counts and conflicts.
- `GET /api/v1/sync/status/:farmId`: farm summary/counts.
- Delta keys: `animals`, `milkLogs`, `healthRecords`, `vaccineRecords`, `weightLogs`, `transactions`; each table uses created/updated/deleted collections.
- `SyncService.assertFarmAccess` checks membership or `SUPER_ADMIN`; this path does not use `TenantGuard`. Do not assume it enforces all farm-role and subscription permissions used by normal write endpoints.
- `SyncRepository.applyPushMutations` uses a database transaction and timestamp/conflict logic. The service records `OFFLINE_SYNC_PUSHED` afterward, outside that transaction: a known atomic-audit gap.
- `OfflineSyncEngine.synchronize` reads the farm queue, pushes, removes queued IDs after a successful response, pulls and applies local changes transactionally, then updates the pull watermark. Conflicts are returned to the caller. There is no wired application conflict UI.

SQLite uses snake_case columns, DTOs camelCase keys. The schema includes `sync_queue` and per-farm `sync_metadata`, starts at version 1 and currently only defines `onCreate`. Animal and financial tombstones differ from tables handled with local hard deletes. Do not assume all models have identical deletion support.

## Required safety for changes

Keep backend DTOs, Prisma fields, shared types, Dart parsing/mapping and SQLite schema in agreement. Old mobile versions may continue sending old payloads: use additive changes or an explicit versioned migration. Existing data needs a real SQLite upgrade path, not just edited CREATE statements.

Validate per-record ownership and related foreign keys, not only request-level membership. Enforce the same business permissions/quota/clinical/financial rules as online writes. Test UUID collisions across farms, duplicate pushes, stale versions, equal timestamps, delete/update conflicts, revoked membership and unauthorized table/field mutations.

Do not discard unsent or unresolved edits during retries, logout, farm switching or conflict handling. Verify that acknowledged queue entries correspond to the accepted snapshot even if new local edits arrive mid-sync. A pull watermark must not skip concurrent server changes. Network timeout after server commit must be safely replayable. These are acceptance requirements, not guarantees of the current engine.

See [sync workflow](../workflows/offline-sync-change.md) and [known gaps](../known-gaps.md). No WatermelonDB dependency is present; that name appears in historical specs only.
