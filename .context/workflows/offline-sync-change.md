# Workflow: offline protocol change

**Role progression:** [Mobile/Frontend](../roles/frontend-ui.md) + [API/Backend](../roles/backend-api.md) + [Database](../roles/database.md) + [Security](../roles/security.md); [Tech Lead](../roles/architecture-lead.md) coordinates protocol/client impact. Use Code Reviewer + QA, and UI Reviewer for screen changes, in [self-review](self-review.md) before finalizing.

**Inputs:** online behavior, offline use case, API/shared/Dart schema. **Output:** compatible protocol and persistence behavior with recovery evidence. Read [sync behavior](../features/offline-sync.md).

1. Trace controller/service/repository and shared DTO to `SyncClient`, `sync_models.dart`, `OfflineDatabase`, `OfflineSyncEngine`; identify online endpoint rules that must also apply offline.
2. Specify field mapping, enum/date/decimal/null semantics, UUID ownership, accepted mutations and conflict policy. Define compatibility for old clients and SQLite version upgrades.
3. Update only necessary layers. Preserve pending edits until accepted or explicitly resolved. Persist local writes/queue changes consistently; advance pull cursors only after durable application of the corresponding batch.
4. Test first pull, empty delta, create/update/delete, repeated push, timeout after server commit, stale/equal versions, server-wins conflicts, concurrent local writes, concurrent server writes during pull, farm switching, logout/revocation and cross-tenant IDs.
5. Check server transaction/audit atomicity and parity with quota, farm-role and clinical/financial rules. Test real SQLite migrations and API serialization, not Dart model constructors alone.
6. Run API and Flutter checks; document any remaining integration/UI or device-test gap. Do not call the engine integrated merely because standalone unit tests pass.
