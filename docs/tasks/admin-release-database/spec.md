# ADM-9 release database readiness

Date: 2026-10-21. Baseline: `120d1cb`; clean working tree. Continues the
[release procedure](../../features/admin-release-acceptance/runbook.md).

## Required result

Verify the actual production API/database binding, capture an encrypted restricted
backup, prove restoration/data preservation and rehearse the two committed
additive migrations. Apply them to the verified target only after those checks
pass, then independently verify history/schema/data and read-only HTTP behavior.
The user's "go next" follows the explicit database-readiness/migration sequence;
it authorizes this scoped operation without overriding the human-managed Git rule.

## Scope and safety

- Production aliases: `veterinary-api-mocha.vercel.app` and
  `veterinary-pro-web.vercel.app`. Establish deployment IDs, environment binding
  and compatibility using authenticated read-only hosting metadata; never infer
  the deployed database solely from a local `.env` file.
- Only `20261019100000_admin_communications` then
  `20261019160000_admin_platform`, through the API package's active Prisma schema.
  Review applied checksums including CRLF normalization and historical rolled-back
  entries. Abort on unexpected pending/failed migrations, drift or target changes.
- Preserve all original rows, clinical/financial history, outbox/delivery jobs and
  existing authorization/PII keys. No resets, destructive schema edits, production
  test accounts/content or Redis cleanup. Bound lock/statement waits.
- Keep credentials and backup/data files outside the repository under restricted
  user/SYSTEM ACLs. Encrypt backup at rest; verify decryption/restore. Use a
  dedicated labeled disposable local PostgreSQL instance for restored data.
- No API/web/worker deployment, hosting/environment update, external provider
  send/charge or Git index/history operation is included.

## Acceptance and recovery

1. Actual target binding and exact pending SQL are established; checksums, server
   version, table sizes, activity/lock state and compatibility are recorded safely.
2. One consistent read-only exported snapshot backs the encrypted archive and
   preservation fingerprints. Restore into the isolated target and match the
   original schema/history/data; rehearse forward migration and relevant queries.
3. Recheck target immediately before migration. Apply only the reviewed additive
   changes, with bounded waits, then prove 29 completed migrations, no unresolved
   failures, schema parity and original data retention (allowing concurrent writes
   only when explicitly accounted for).
4. Verify public content/course/health reads and anonymous privileged-route denial.
   Keep hosted worker/provider/deployed authenticated acceptance separate.

On failure stop rollout, retain encrypted backup and logs, inspect the precise
migration state and prefer reviewed forward recovery. Never restore over the
production database or drop new tables automatically. A host-local encrypted
backup/rehearsal is not an off-host disaster-recovery or provider-delivery claim.
