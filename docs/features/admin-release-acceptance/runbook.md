# Administration release and recovery runbook

Release candidate: `a07d77f` plus reviewed ADM-9 fixes/harness changes. Status: **NO GO while the gates below remain open**. Execution results live in [plan.md](plan.md); requirements live in [spec.md](spec.md). This is an executable preparation guide, not a deployment record.

## Release gates and ownership

| Gate | Responsible operator | Required evidence |
| --- | --- | --- |
| Application acceptance | API/web maintainer | Current builds, administrative database/HTTP/BFF/browser checks; no unresolved correctness/authorization/privacy finding |
| Dependencies | Security + application maintainer | Review current lockfile advisories, remediate or demonstrate target-specific non-applicability with an explicit disposition; rerun affected acceptance after changes |
| Database | Database operator | Exact target binding, applied migration names/checksums, verified backup restoration, pending migrations applied before new API/worker/web code |
| Durable jobs | Runtime operator | Identified persistent role-worker host, matching artifact and configuration, restart/retry generation behavior, queue/failed-job observation and alert owner |
| External integrations | Provider/account operator | Configured identity/credentials, test recipients/sandbox/storage, explicit acceptance for every enabled external operation; mock and simulation statuses remain visible |
| Deployed journeys | Release operator + QA | Both administrative roles, bn/en, narrow/wide layouts, ordinary-role denial, logout/revocation, safe persistence and recovery at the actual HTTPS target |

Operators are responsibilities, not assigned people. Confirm actual owners and target before rollout. HTTP readiness alone does not close any other gate. Do not resume Farmer milk work or claim the full admin program complete until the selected ADM-9 gates are accepted.

## Known target observations

Read-only checks on 2026-10-20: the existing API readiness endpoint reported database and Redis up. Anonymous administrative API reads returned 401; `/admin/dashboard` and `/admin/settings` on the existing web origin redirected to the public sign-in handoff with private/no-store headers. Public `GET /api/v1/content/BLOG` returned 400; therefore this target does not establish successful CMS acceptance.

The configured API database was inspected read-only through the existing local configuration, without displaying connection credentials. Its applied history lacks `20261019100000_admin_communications` and `20261019160000_admin_platform`; the four corresponding editorial/support/platform tables were absent. The binding between this configured database and the deployed process was not independently inspected. Verify the deployment's secret binding before applying anything; never infer the target solely from an `.env` filename. Preserve historical finished/rolled-back migration rows; compare distinct successfully applied names, not raw row counts.

The actual deployable revision, prior rollback deployment IDs, production worker host, alert owners and provider sandbox credentials are not established by these anonymous probes. Previous release IDs in the [ADM-4 evidence](../admin-billing/plan.md) are historical references; resolve the currently active and rollback targets again at release time.

## Local reproduction

Use Node 22+ for the native WebSocket browser harness (observed here: 24.9.0), the pinned pnpm 10.18.3/lockfile, Docker with cached PostgreSQL 16/Redis 7 images and Chrome. All new acceptance writes are restricted to explicitly disposable loopback resources. The harness launches API/worker processes from an empty temporary working directory with an explicit synthetic environment; it does not load repository `.env` credentials. The web copy must also exclude environment files.

From the repository root in PowerShell, allocate uniquely named services. Keep the synthetic password below exclusively in this disposable cluster:

```powershell
$adm9Name = 'vet-adm9-' + [guid]::NewGuid().ToString('N')
docker run -d --name "$adm9Name-pg" --label vetralink.task=adm9 -p 127.0.0.1:55449:5432 -p 127.0.0.1:55432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=adm9_only -e POSTGRES_DB=adm9_test postgres:16-alpine
docker run -d --name "$adm9Name-redis" --label vetralink.task=adm9 -p 127.0.0.1:56449:6379 -p 127.0.0.1:56379:6379 redis:7-alpine redis-server --appendonly yes
docker exec "$adm9Name-pg" pg_isready -U postgres
docker exec "$adm9Name-redis" redis-cli ping
$env:ADM9_POSTGRES_CONTAINER = "$adm9Name-pg"
node apps/api/scripts/check-admin-release-migrations.mjs
```

If ports are occupied, inspect the existing processes/resources; do not stop an unrelated service. This migration script requires a fresh task-owned container and verifies the label and loopback port mapping before writing. It applies the first 27 migrations, inserts synthetic account/order/product/outbox/delivery records, dumps the populated database, applies the remaining two migrations, restores into a separate database, reapplies and checks schema parity/preservation. It also creates the separate databases needed by existing opt-in tests. Rerun it against a fresh disposable container rather than resetting an unknown database. A separate final rehearsal may use `ADM9_POSTGRES_PORT=55448` with a fresh correctly labeled container bound to that loopback port; the integrated browser/legacy test ports remain fixed.

Build shared contracts and API normally. Prepare an isolated copy of `apps/web` under the repository's ignored `.turbo/<unique-name>/web`, containing `src`, `public`, `package.json`, `tsconfig.json`, `next-env.d.ts`, `postcss.config.js` and `tailwind.config.ts`, plus a junction/symlink to the existing web `node_modules`. Use the same Windows drive as the dependencies and keep the copy outside `node_modules` so Next/SWC compiles its source. A temporary `next.config.mjs` containing `export default { experimental: { cpus: 2 } };` bounds build workers. Do not copy `.env*`, credentials or the active development `.next` directory.

```powershell
$adm9Web = Join-Path (Get-Location) ('.turbo/' + $adm9Name + '/web')
New-Item -ItemType Directory -Path $adm9Web -Force | Out-Null
Copy-Item -LiteralPath apps/web/src,apps/web/public -Destination $adm9Web -Recurse
Copy-Item -LiteralPath apps/web/package.json,apps/web/tsconfig.json,apps/web/next-env.d.ts,apps/web/postcss.config.js,apps/web/tailwind.config.ts -Destination $adm9Web
New-Item -ItemType Junction -Path (Join-Path $adm9Web 'node_modules') -Target (Resolve-Path apps/web/node_modules) | Out-Null
Set-Content -LiteralPath (Join-Path $adm9Web 'next.config.mjs') -Value 'export default { experimental: { cpus: 2 } };'
$env:API_BASE_URL = 'http://127.0.0.1:35411/api/v1'
pnpm --filter @vetralink/shared-types build
pnpm --filter @vetralink/api build
pnpm --filter @vetralink/web check:styles
pnpm --filter @vetralink/web exec next build $adm9Web
$env:WEB_TEST_BUILD_DIR = $adm9Web
$env:ADM9_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm9_test'
$env:ADM9_REDIS_CONTAINER = "$adm9Name-redis"
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node apps/web/scripts/check-admin-release.mjs
# Run separately from the real integration and heavy builds/database suites.
$env:WORKSPACE_BROWSER_FOCUS = 'admin-release'
node apps/web/scripts/check-dashboard-browser.mjs
```

The real harness verifies both roles/locales at 320/1440px, loaded modules, persisted BFF actions, denial/privacy, current sessions, local queue processing and worker failure/restart/generation retry. Its cold-bootstrap database proves default tiers seed once and a later restart retains edited pricing. The controlled browser suite covers detailed form failures, uncertain/stale recovery, keyboard/drawer behavior and deterministic financial/clinical states. Neither establishes external delivery or alternate-engine/device acceptance.

Enable existing database suites with these explicit opt-in variables before the full API run; each retains its own database guard. Run expensive builds and integration suites sequentially on constrained Windows hosts. A timeout or a skipped opt-in suite is not a pass.

```powershell
$env:NODE_ENV = 'test'
$env:API_DEBUG = '0'
$env:DATABASE_URL = $env:ADM9_TEST_DATABASE_URL
$env:REDIS_URL = 'redis://127.0.0.1:56449'
$env:ROLE_TEST_DATABASE_URL = 'postgresql://role_test:role_test_only@127.0.0.1:55432/role_test'
$env:ADM3_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm3_test'
$env:YT_TEST_DATABASE_URL = $env:ADM3_TEST_DATABASE_URL
$env:YTL_TEST_DATABASE_URL = $env:ADM3_TEST_DATABASE_URL
$env:BILLING_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm4_test'
$env:CONSULTATION_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm5_test'
$env:SETTLEMENT_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm6_test'
$env:REVIEW_TEST_DATABASE_URL = $env:SETTLEMENT_TEST_DATABASE_URL
$env:COMMUNICATIONS_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm7_test'
$env:PLATFORM_TEST_DATABASE_URL = 'postgresql://postgres:adm9_only@127.0.0.1:55449/adm8_test'
pnpm --filter @vetralink/api test --runInBand
pnpm audit --prod --json
```

Retain sanitized logs, results, screenshots, migration backup and exact source/build identifiers. The browser harness stops its own API/Next/Chrome/worker children and leaves synthetic database records available for inspection. At completion, inspect the task container IDs and `vetralink.task=adm9` labels, then stop only those task-owned services. Do not remove unrelated containers/volumes or Docker Desktop; no `down -v` or database reset is needed.

## Deployment procedure

1. Resolve release source/artifact and exact API/web project, database, Redis and durable-worker host. Record the currently active API/web/worker versions and compatible rollback artifacts. Keep source secrets and local acceptance data out of the deployment artifact. Preserve human-managed Git.
2. Close the dependency/security gate and local acceptance findings. Review current integration configuration with the typed schema and safe diagnostics. Supply production auth/PII/signing keys through the target secret manager; never use test/default keys. Verify allowed CORS/origins, the web's server-only API URL including `/api/v1`, persistent signing keys and disabled mock/simulation behavior for operations advertised as external delivery.
3. Quiesce new CMS/support/settings writes and retry requests for the deployment window. Identify pending role outbox/delivery rows and retained BullMQ job IDs/generations. Preserve these records; do not flush Redis or delete failed jobs as routine rollout.
4. Take an encrypted, access-controlled target backup using its database tooling. Restore it into a separate isolated target and verify original records, completed migration checksums and schema parity. Capture checksums and restore evidence without credentials/PII. The synthetic rehearsal supplements this target backup; it does not replace it.
5. With `DATABASE_URL` provisioned privately for the verified target, run `pnpm --filter @vetralink/api exec prisma migrate status`, then `pnpm --filter @vetralink/api db:deploy`. The active schema is `apps/api/prisma/schema.prisma`. Apply communications then platform migrations before new API/worker/web code. Verify distinct successfully applied names and zero schema diff; never use `migrate dev`, `db push`, reset, or edit old migration SQL on this target.
6. Deploy the matching generation-aware role worker to a durable host using the built `dist/role-notifications.worker.js` entry. Verify actual heartbeat/registration, outbox progress and restart recovery. A serverless HTTP function is insufficient evidence of a worker host. Verify the persistent runtime for other enabled queues/FFmpeg/realtime independently; diagnostics cannot certify those workers from configuration alone.
7. Deploy API, then web, from the reviewed artifact. Check flat `dist/main.js`/serverless output, runtime versions and shared build. Record actual deployment IDs and source revision; avoid claiming a Git-based deployment when using a prepared CLI artifact.
8. At the real HTTPS origin, verify health/liveness/readiness, current account login, role and Super-only boundaries, all included administration modules in bn/en and mobile/desktop, public published reads and own-support privacy. Use labeled disposable acceptance records for writes and explicit consent for external provider test recipients/sandboxes. Test wrong-password rejection without a financial change, exact currencies/ranges and bounded exports. Verify logout/Back, session revocation, concurrent stale actions and unavailable-provider recovery.
9. Observe an authorized role event across API commit → durable outbox → Redis job → matching worker → configured provider acceptance, and separately confirm inbox delivery. Verify no obsolete-generation dispatch. Reconcile an ambiguous provider outcome before retrying: at-least-once email may duplicate after provider acceptance followed by a crash.
10. Record measured latency/error/queue/DB observations and actual alert owner/escalation. Define and run a bounded authorized load scenario before broad readiness claims. Canary observations need a declared duration and target; no monitoring/load certification is supplied by this task's local route sweeps.

## Abort, rollback and forward recovery

Abort rollout on missing migrations, failed restore, a current-role bypass, leaked draft/internal note/secret, mismatched report currency, repeated unexplained 5xx, unverified worker host or an unresolved applicable critical advisory. Keep the release gate open and record the exact failing scenario.

For application failures after additive migration, roll back web then API to identified compatible artifacts. Retain authored content, support messages, settings, audits and all additive tables. Do not drop tables or remove migration history to roll back application code. Fix forward where older code cannot safely serve the new rows.

Pause new retry requests and keep a generation-aware worker until pending retries drain or are reconciled. An old dispatcher can collide with a retained generation-zero failed job and leave the newer retry pending. Preserve `retryGeneration`, queue job IDs, attempts, accepted timestamps and provider message IDs. Reconcile external acceptance before repeat sends; a local `SENT`/`PAID` record does not prove inbox delivery/provider transfer.

If migration fails, stop the rollout and inspect the exact failed migration and locks. Restore only into a separate target to establish recoverability; production restore/cutover requires an explicit incident decision accounting for writes since backup. Do not automatically replay financial/clinical mutations or discard newer records. Resume after target schema, compatible artifacts, pending jobs and smoke checks are accepted.
