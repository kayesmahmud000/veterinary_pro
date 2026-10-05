# Database and migration safety

Use [Senior Database Engineer](../roles/database.md), Backend and QA perspectives. Add [Tech Lead](../roles/architecture-lead.md) and [Production/Release](../roles/debugging-production.md) for migrations/data rollout. The [self-review cycle](../workflows/self-review.md) must assess existing production data and recovery, not only a clean local schema.

## Active schema

`apps/api/package.json` selects `apps/api/prisma/schema.prisma`. Run Prisma through the API package or pass this schema explicitly. The root `prisma/schema.prisma` differs and has a separate migration tree; it is not automatically synchronized. Do not generate migrations against the root copy by accident. Schema consolidation is a separate reviewed task.

Models cover users/refresh tokens, farms/members, animals and logs, health/vaccines/attachments, milk/anomalies, farm transactions, products/orders/items, subscriptions/dunning, consultations/messages/notes/vet profiles/prescriptions/payouts/reviews, and audit logs. Prisma maps many fields/tables to snake_case. Read both schema and SQL: partial active-tag/RFID uniqueness and product full-text GIN indexes live in migrations.

## Data invariants

Tenant-owned reads/writes must include farm scope and appropriate soft-delete conditions. Check ownership of related IDs (animal, consultation, attachment, parent animal) before linking. Platform-global catalogue/auth operations need their own authorization; do not mechanically add `farmId` to global models. Soft-delete master records according to their existing model, preserve clinical/financial history, and make any retention/erasure workflow explicit and audited.

Money/measurements use Prisma Decimal in relevant repositories. Preserve currency/precision and avoid accidental float rounding in aggregates or API mapping. Preserve immutable order item snapshots. Use constraints plus transactions to handle uniqueness and concurrency; preflight checks alone race.

For sensitive writes, share one transaction across domain persistence and audit via `ITransactionManager.run`/repository transaction parameters, following `AnimalsService`. Do not introduce direct Prisma business queries into controllers/services. Do not keep a database transaction open while waiting for remote payment/mail/media calls; define retry/reconciliation for external side effects. See [known gaps](../known-gaps.md) for sync's separate audit write.

Parameterized Prisma/raw SQL only; never concatenate user input into query text. Constant health-probe SQL is not equivalent to interpolated application SQL. Bound batch sizes and analyze query plans for large farm reports and exports.

## Migration requirements

Create new migrations; do not edit applied history. Review SQL locks, indexes, constraints, defaults, uniqueness conflicts, nullability and data volume. Use additive expand/backfill/contract steps for breaking changes. Keep schema migrations separate from dedicated, restartable and audited data backfills, preserving the existing project rule.

`db:migrate` invokes **development** migration tooling and may request a reset. Only use against an explicitly disposable development database. `db:deploy` applies committed migrations to a selected environment and requires deployment authorization. Never reset/drop production or remove Compose volumes as a routine fix.

Before release, verify schema/migration consistency, rehearse with representative disposable data, test old/new application compatibility, preserve backups and demonstrate restore/forward-recovery. A Prisma client generation/build does not prove a migration is safe. See [migration workflow](../workflows/database-change.md).
