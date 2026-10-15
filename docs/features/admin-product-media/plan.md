# ADM-3 implementation plan

Spec: [spec.md](spec.md). Execute inline with executing-plans and test-driven-development; preserve human-managed Git and current checkout. Goal: functional bilingual product/media administration with protected reads and owned upload recovery.

## Tasks

- [x] 1. Shared schemas, additive Prisma migration, admin product repository/service/controller and draft/public-metadata safeguards. RED→GREEN tests for safe draft/public reads, publication readiness, optimistic actions, role/version boundaries and same-transaction audit. Update legacy repository version increments.
- [x] 2. Persistent media repository/service/controller, storage HEAD adapter, deterministic queue retry, namespace isolation and non-mutating managed processor path. RED→GREEN for ownership/key/part/type/size/retry/lost-ack behavior. No provider calls inside DB transactions.
- [x] 3. Fixed BFF mappings with strict response/ID/query/body projections, bilingual product list/form/detail/actions and media inventory/upload/progress/job/attachment screens; released routes/nav. Boundary tests first, integrated browser cases against isolated production build.
- [x] 4. Separate security/code review, fix in-scope findings with regressions, full API and relevant web regression/style/build/browser checks, inspect screenshots. Attempt disposable-service availability without live writes. Update API/web/root roadmaps and context with actual evidence and pending provider/migration limits.

## Review focus

Private metadata and legacy-route bypass; stale product snapshots from workers; duplicate initiation/completion after crashes; cross-uploader attachment/queue retries; deleted/published products during remote work; browser CORS/ETag failures and stale confirmations.

## Execution ledger

2026-10-15: clean checkout at 82d857a. Existing services and provider/queue bindings inspected. Ruling: separate additive admin contracts and persisted managed uploads, retaining legacy key shapes but denying access to the new namespace. Managed video jobs output artifacts only; explicit versioned attachment owns product mutation. This prevents worker snapshots from reverting edits. New schema requires migration before release; no live migration authorized.

Pre-flight: Task 1 schemas and product version are consumed by Task 2 attachment; Task 2 upload/job projections feed Task 3 BFF and browser. No new dependencies. Use /tmp isolated web builds; retain evidence here.

## Final review and fixes

**Confirmed from code / observed behavior:** separate read-only review identified legacy mutation bypasses, an orphaned remote session after persistence failure, abort retries stuck after a successful provider abort, and stale edit forms lacking a recovery action. Fixed these with managed-product/namespace guards and version checks, atomic legacy-product claiming, best-effort remote cleanup, idempotent NoSuchUpload handling and explicit saved-product reload. Added regression coverage, including real PostgreSQL transaction rollback and retry. The reviewer did not independently recheck the fixes; final verification below is the implementer's re-review.

Final consumer tracing also found playback still signing the legacy root HLS path. Added failing tests, then signed the attached managed playlist with cookies scoped to its upload directory. Existing playlists remain supported when a legacy product becomes managed; unready, foreign and traversal paths fail before signing. The focused playback suite passes 13 tests. Mobile screenshot review prompted Tailwind spacing improvements; final 320px media and bn/en product screenshots were inspected.

## Verification evidence — 2026-10-15

All commands ran against the uncommitted ADM-3 working tree based on 82d857a. Logs and isolated build/database artifacts are temporary local evidence under `/tmp`, not committed artifacts.

- **Observed behavior:** `pnpm --filter @vetralink/shared-types build`, API build and web/API TypeScript checks pass. The isolated production web build at `/tmp/web-adm3-8vcura6i` passes; it uses existing dependencies and no copied environment secrets (`/tmp/adm3-web-build.log`).
- **Observed behavior:** final `pnpm --filter @vetralink/api test --runInBand` with the explicit disposable `DATABASE_URL` and matching `ADM3_TEST_DATABASE_URL` passes 217 suites / 1,945 tests, including the six real-database cases and playback regressions (`/tmp/adm3-api-final.log`). One existing opt-in role-workflow suite / 26 tests remains skipped because its Redis integration environment was not enabled. The API build was rerun after the playback fix and passes (`/tmp/adm3-api-build.log`).
- **Observed behavior:** the ten relevant web Node regression scripts (`check-admin-catalog`, directory, dashboard, workspace, navigation, protected-routes, auth, farm-overview, styles and tailwind) pass 103 tests (`/tmp/adm3-web-regressions.log`). `pnpm --filter @vetralink/web check:styles` passes.
- **Observed behavior:** `WEB_TEST_BUILD_DIR=/tmp/web-adm3-8vcura6i pnpm --filter @vetralink/web test:dashboard:browser` passes 362 checks (`/tmp/adm3-browser-expanded.log`). After the spacing-only UI fix, the same command with `WORKSPACE_BROWSER_FOCUS=catalog` passes all 59 product/media checks (`/tmp/adm3-browser-spacing.log`, screenshots `/tmp/khamar-workspace-qa-wFCxi5`). Browser runs use controlled API/storage/queue responses, including failed direct PUT/retry, explicit attach/publish, stale edit recovery, failed-job retry, role denial, bn/en and 320/1440px layouts. They do not prove live provider delivery.
- **Observed behavior:** additive migration rehearsed on PostgreSQL 16.14, using an isolated loopback database named `adm3_test` on port 55439. Applied the 24 baseline migrations, inserted an existing product, then applied the new migration. Existing product/version default preserved; Prisma schema diff reports no difference. Logs: `/tmp/adm3-baseline-migrate.log`, `/tmp/adm3-new-migrate.log`, `/tmp/adm3-schema-diff.log`. Prisma schema validation passes with that explicit disposable URL.
- **Observed behavior:** the opt-in `admin-catalog.database.spec.ts` passes six real-database tests: populated upgrade, concurrent edit conflict with one audit, audit failure rollback, stale legacy write rejection, owned upload/attach/publish and abort rollback/provider retry. Storage and queue remain controlled test doubles. PostgreSQL binaries were downloaded only under `/tmp/adm3-db-tools`; application dependencies and lockfile were untouched. No configured/live database was migrated.
- **Observed behavior:** `.context/scripts/validate.py` passes (48 documents / 323 local links / 95 source entries); changed/new Markdown local links, whitespace checks and `git diff --check` pass. API/web/root roadmaps and shared context point to this evidence. Changes remain uncommitted under the human-managed Git policy.

## Rollout and remaining acceptance

**Confirmed from code:** apply `20261015090000_admin_product_media` before the new API. Drain/upgrade all API writers and media workers before exposing the new web flows; old instances do not enforce managed ownership/version semantics. To recover, disable the new UI/routes while retaining database rows, objects and audit history. Keep the new API privacy/version safeguards: reverting the API to a pre-ADM-3 version after managed records exist requires a separate reviewed recovery plan.

**Unknown / release gates:** real bucket multipart/CORS/ETag behavior, object lifecycle cleanup, Redis/BullMQ retry with a real worker, FFmpeg/provider output and durable hosting acceptance still require deployment-environment checks. The local disposable migration rehearsal is complete; production migration execution remains a release step. Course curriculum/progress/resources remain API-B2. ADM-4 is the next planned batch and was not started.

Suggested human-managed commit: `feat(admin): add product and managed media administration`.
