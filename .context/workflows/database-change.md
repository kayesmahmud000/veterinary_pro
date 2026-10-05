# Workflow: persistence or migration change

**Role progression:** [Database](../roles/database.md) + Backend during design/implementation; [Tech Lead](../roles/architecture-lead.md) + [Production/Release](../roles/debugging-production.md) assess rollout/recovery; [Code Reviewer + QA](../roles/quality.md) review before final verification and re-review afterward. Apply [self-review](self-review.md) without treating migration preparation as deployment authorization.

**Inputs:** model/query change and data compatibility requirements. **Output:** scoped schema/migration, tested data behavior and rollout/recovery plan. Read [database rules](../engineering/database.md).

1. Verify API schema selection, existing migrations, repository mappings, shared contracts, indexes and all sync/mobile consumers. Inspect SQL-only constraints; do not infer them all from Prisma schema.
2. Record proposed schema and compatibility trade-offs in spec/plan. Identify existing rows that violate constraints; separate data backfill from schema migration. Estimate table size/locks and select a safe rollout sequence.
3. Generate/review a new migration using an explicitly disposable development database. Do not reset unknown data or rewrite applied history. Validate and regenerate Prisma client from the API schema.
4. Update repositories/domain serialization and, if synchronized, Dart DTOs/SQLite upgrades. Preserve tenant filtering, soft deletes, decimals, concurrency/version fields and same-transaction audit.
5. Rehearse forward migration and recovery with representative disposable data; test duplicate keys, cross-farm references, null/default/backfill cases, rollback of failed writes and compatibility with old clients.
6. Document deploy order, backups/restore evidence and any manual steps. Executing the production migration is a separate authorized release action, not an automatic consequence of generating SQL.
