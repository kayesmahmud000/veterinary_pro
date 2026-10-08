# Vercel runtime repair implementation plan

Use executing-plans to implement sequentially; track evidence here.
Spec: [spec.md](spec.md).

## Constraints and rulings

- Preserve dev-fontend and human-managed Git. Prepare edits in this working
  checkout; verify the actual dev-backend revision in `/tmp/vetralink-vercel-repair`.
- Temporary source archive and independent copied dependencies provide isolation
  without changing read-only Git metadata. No worktree, commits or merges.
- Use test-driven-development for the executable entry-path defect. Environment
  templates/documentation do not need tests that mirror text.
- Existing CORS origins in local .env remain valid; add the deployed frontend.
- Preserve named unique indexes, category indexing, role tables and all old data.
- A Vercel connection was suggested; external account changes are pending access.

## Review focus

Wrong flat/nested artifact precedence, discovery from a different working
directory, diagnostics drift, populated legacy migration compatibility,
Prisma map/name compatibility, lock waits, secrets in logs/files, and confusing
local completion with live deployment/provider delivery.

## Tasks

- [x] Task 1: Add disk-based regression tests in `apps/api/test/vercel-entry.test.cjs`;
  run red, implement shared candidate discovery in `apps/api/api/index.js`, run
  green and wire `test:vercel` in `apps/api/package.json`.
- [x] Task 2: Configure `apps/api/vercel.json` shared/API build order, update
  `apps/api/.env.vercel.example`, add `apps/web/.env.vercel.example`, and update
  public URL values in local .env without disclosing secrets.
- [x] Task 3: Correct Prisma physical index mappings/category declaration; add
  transactional migration `20261008090000_restore_consultation_schema`; rehearse
  in an isolated schema with synthetic legacy data and compare to latest schema.
- [x] Task 4: Snapshot/recheck the configured database, deploy the reviewed new
  migration, verify unchanged existing records and migration/schema consistency.
- [x] Task 5: Build and check exact repaired backend archive; review final diff,
  check live health, use connected Vercel tools if available, record remaining
  deployment/worker/provider/admin prerequisites.

## Evidence

- `node --test apps/api/test/vercel-entry.test.cjs`: original wrapper 4 failures,
  1 pass; repaired wrapper 5 passes. Same 5 passes in the backend archive.
- Shared/API production builds passed in the exact backend archive using
  synthetic DATABASE_URL. Verified emitted `dist/serverless.js` and
  `dist/role-notifications.worker.js`; no runtime backend process launched.
- Prisma validate passed on the corrected backend schema.
- Live HTTPS GET checks returned 200 for both domains. Backend `/api/v1/health`
  reported `success: true`, database up, Redis up. This observes the old live
  deployment, not a deployment of this repair.
- Initial full API suite lacked required synthetic DATABASE_URL and aborted.
  `NODE_ENV=test DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test pnpm
  --filter @vetralink/api test --runInBand` in the backend archive then passed:
  210 suites / 1,854 tests. The opt-in real role suite skipped 26 tests; this run
  used controlled/mocked dependencies, not the configured live DB.
- Initial populated migration rehearsal exposed a global vet-profile FK check
  in old migration SQL. Added a table-scoped conditional FK repair to the new
  migration without changing applied history. `node /tmp/vetralink-db-repair.cjs
  rehearsal` then passed all 24 migrations, preserved populated legacy role/
  onboarding/consultation data, tested new ORM relations, review uniqueness,
  notification FK denial, and had zero Prisma schema difference. Only the owned
  synthetic schemas were dropped after rehearsal.
- First deployment precheck stopped before public schema writes because the
  pooled session retained the dropped rehearsal schema as search_path. Read-only
  diagnosis confirmed public._prisma_migrations existed. Restored session
  search_path and qualified all public precheck/snapshot table references.
- `node /tmp/vetralink-db-repair.cjs deploy` applied the single new migration to
  the configured public database. A restricted pre-repair data/catalog snapshot
  is at `/tmp/vetralink-vercel-repair/pre-repair-snapshot.json`. Verification
  confirmed all existing rows and index definitions preserved exactly, 24
  applied migrations, no failures/pending migrations and zero Prisma difference.
- Fresh reviewer found missing backend API_BASE_URL configuration. Verified
  `MailService` appends `/api/v1/orders`, corrected backend config to bare origin,
  and kept web config prefixed. No introduced resolver/index-mapping defects.
- Vercel account remains unconnected. Plugin was suggested; no dashboard setting,
  deployment, real mail, worker host or administrative account changed.
- Live Swagger does not include new role-request routes: the live API is not
  evidence of the latest backend feature deployment.
- `pnpm --filter @vetralink/web check:styles` passed. `git diff --check` passed.
- Exact branch-targeted patch prepared at
  `/tmp/vetralink-backend-vercel-repair.patch`; `git apply --check` passed against
  a clean archive of dev-backend. The original frontend branch is preserved.

## Handoff and limits

Implementation and authorized configured-database repair are verified. Vercel
account connection and deployment of the repaired dev-backend source remain
pending. [Operations](operations.md) and [public API env import](api-public.env.example)
contain concrete non-secret settings; web env is in apps/web/.env.vercel.example.
No Git stage/commit/merge/push ran. Suggested commit:
`fix(api): repair Vercel entry and missing consultation schema`.

Existing public diagnostics/HTTP-200 error responses were reviewed and retained
outside this artifact-discovery fix. Real worker hosting/mail delivery and first
reviewer-account bootstrap need their own configured operator inputs.
