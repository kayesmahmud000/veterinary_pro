# 0003: SQLite and REST delta synchronization

- Recorded: 2026-10-05
- Status: Choice documented by task 15.3; end-to-end readiness unverified
- Evidence: `docs/tasks/task-15.3-mobile-offline-sync-engine/spec.md`, API `modules/sync/`, Flutter `lib/core/sync/`

## Context and choice

Rural farm workflows need local recording under intermittent connectivity. The existing spec chooses REST delta push/pull, client-generated UUIDs, SQLite queues and timestamp-based conflict handling over continuous WebSocket/CRDT synchronization. Six ERP entity collections participate.

## Consequences

The simpler transport fits intermittent requests, but correctness depends on durable queue acknowledgement, cursor boundaries, conflict handling, schema compatibility and parity with online authorization/business rules. Timestamp conflict logic does not automatically guarantee convergence or safe clock handling. The current client is not wired into the app, and audit atomicity/permission/cursor concerns remain in [known gaps](../known-gaps.md).

Do not replace the protocol or introduce WatermelonDB just because historical docs mention it. The actual Flutter implementation uses sqflite. Changes must account for installed old clients and existing SQLite data.

## Revisit when

Measured conflict loss, scale or collaborative-editing requirements cannot be met by a corrected delta protocol. Compare complexity and migration costs before choosing CRDTs, streaming or a new local database.
