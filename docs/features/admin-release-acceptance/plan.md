<<<<<<< HEAD
# ADM-9 execution and evidence

Status: Local acceptance and release preparation verified; full ADM-9 production gates remain open. Started 2026-10-20 at `a07d77f`, clean working tree; final local verification/handoff 2026-10-21.

## Execution plan

- [x] Inspect repository rules, workstream authority, individual batch evidence, source/test boundaries and local tooling.
- [x] Prepare task-owned PostgreSQL/Redis, populated migration/restore rehearsal and separate databases required by existing opt-in tests.
- [x] Add and run real production-web/BFF/API/database/Redis acceptance, including both roles/locales, privacy, concurrent writes and worker restart/retry.
- [x] Run package builds, relevant regressions, full administrative database checks and advisory/runtime inspection.
- [x] Review findings, fix in-scope issues, retest and visually inspect rendered mobile/desktop states.
- [x] Write release/recovery runbook; inspect deployed services read-only and record unfulfilled production/provider gates.
- [x] Re-review final diff and evidence, validate documentation, update owning tracker and hand off the concrete release artifact.

## Risks and recovery

Cross-module authorization/session, privacy, audit atomicity, exact financial units, migration order and queued notification generations are the main risks. Existing per-batch negative/race/rollback tests complement the new integrated harness. Synthetic local data cannot establish production performance, real provider validity or delivery. Production is untouched unless a separately concrete rollout is authorized. Preserve pending notifications and additive tables during application rollback.

## Investigation

Observed behavior: Node 24.9.0 and pnpm 10.18.3 are available; Docker was stopped. Docker Desktop was launched hidden and task-owned loopback PostgreSQL 16.14 / Redis 7.4.11 containers were started from cached images. Chrome 156.0.8078.35 is the tested engine. Portable PostgreSQL/prior task artifacts were not reused or modified. No pre-existing user database was reset or mutated.

## Observed integrated acceptance

**2026-10-20–21, baseline `a07d77f` plus ADM-9 changes:** the final real harness passed **21 groups**, including **192 module visits** (22 ADMIN and 26 SUPER_ADMIN destinations × bn/en × 320/1440px), through the production-built Next application and actual BFF/Nest/PostgreSQL/Redis. Sessions were created through the normal modal login during the route sweep. Additional synthetic sessions support precise denial/mutation checks; no HTTP authorization guard was replaced.

Evidence directory: `C:/Users/asus/AppData/Local/Temp/vet-adm9-acceptance-SvYlsv`; summary `results.json`, logs for API/Next/cold start/restart/role workers and eight role/locale/width screenshots plus two report viewports. Output: `adm9-integrated.log` under the OS temporary directory. Production web build ID: `3x7aTCHG3PtK91CsKuWMT`.

Verified persisted settings with wrong-password rejection and one admitted concurrent writer; current Redis/queue observations and explicit mock integration status; bounded report/audit exports without password/hash leakage; draft privacy and confirmed publish/unpublish with escaped public HTML; product/course curriculum storage; requester support and admin internal-note privacy; ordinary-role and Super-only denial; current-primary demotion rejection; access/refresh revocation; real logout/Back public handoff. API startup seeds default tiers exactly once on a fresh restored database and a restart preserves an edited price.

The separate worker test starts with no role worker and a persisted outbox event. The real missing-key Resend adapter fails safely without making an external send, consumes five real BullMQ attempts and retains the failed generation-zero job. A real confirmed BFF retry increments the durable generation; restarting with the mock adapter produces one accepted notification while the old job remains failed. The API notification history reports ACCEPTED; direct BullMQ observation verifies the separate worker registration because the platform HTTP allowlist exposes role outbox counts separately. This proves local durability/recovery, not inbox delivery or hosted worker acceptance.

Visually inspected actual Bangla 320px and English 1440px report viewport captures: readable headings/copy, stacked mobile controls, associated native fields, desktop navigation and no horizontal overflow. Exact amounts and period semantics retain database/contract checks; screenshots alone do not prove arithmetic.

## Migration and recovery

The final migration script was rerun from its final source against a second fresh task-labeled PostgreSQL 16.14 container at loopback port 55448. It passed **27 → 29 migrations**, populated logical dump/restore, preserved synthetic account, BDT 777-minor-unit order, legacy product/version/provider/key, old failed delivery attempts/status with generation-zero default, and returned empty schema differences on both migrated and separately restored targets. Prisma ran from temporary schema/migration copies without repository environment files. Final backup/evidence: `C:/Users/asus/AppData/Local/Temp/vet-adm9-migrations-Hovj9M`, output `adm9-migrations-final.log`. The initial successful rehearsal is retained separately at `vet-adm9-migrations-UyjWfL`; it preceded adding the legacy product fixture required by older opt-in suites.

The configured API database was inspected **read-only**: 27 distinct completed migrations plus a historical rolled-back `20260920240000_add_vet_license_number` entry; both new administration migrations remain pending and their editorial/support/platform tables are absent. There are no database-only migration names. Anonymous deployed checks returned readiness 200 (database/Redis up), guarded API 401, private/no-store admin-page 307 and public CMS 400. Deployment secret binding was not independently inspected. No production/configured-database migration or data write occurred. Safe outputs: `adm9-configured-schema.json` and `adm9-live-readonly.json` under the OS temporary directory.

## Failures and corrections

Two source defects were reproduced and fixed: duplicate plan-service lifecycle instances (`useExisting` binding) and cached signed-out workspace retention on logout/Back (validated public handoff). Real cold-start/restart and logout/Back checks, the detailed controlled browser and final regressions pass as recorded below.

Early Windows build copies failed on a different drive (invalid absolute module resolution) and inside `node_modules` (SWC excludes those source paths). The successful isolated build is in the repository's ignored `.turbo` directory on the same drive; source/dependencies/environment were not relocated or upgraded. Early harness iterations corrected disabled-fieldset readiness, real POST 201 expectations, signaled-child cleanup and the documented role-queue diagnostic contract; these were harness issues, not authorization bypasses or changes to public HTTP contracts.

The first all-opt-in API run had **238 suites / 2,253 tests pass and 4 suites / 8 tests fail**, with **zero skips**. Missing legacy product fixtures caused two failures; overlapping heavy builds/browser/DB work caused timeouts and cascading mock/state assertions. A focused rerun after fixture repair passed six suites but the consultation suite still timed out under concurrent work. Running that suite alone with unchanged default timeouts passed **26/26**. The final serial run passed **all 242 suites / 2,261 tests, zero skips**, with every existing administrative/course/role database opt-in enabled and unchanged timeouts; earlier failed commands are not counted as passes.

## Verification ledger

| Check | Observed result / boundary |
| --- | --- |
| Shared package / API production builds | Passed; shared CJS/ESM/declarations and generated Prisma/Nest flat runtime output. `adm9-shared-build.log`, `adm9-api-build.log` |
| Isolated production web build / styling | Passed after the final gate fix; build ID above, `adm9-web-build.log`. `check:styles` passed; no authored CSS or dependency added |
| Web boundaries | **198 passed**, zero skips; admin platform/communications/finance/consultations/directory/catalog/courses, auth/workspace/navigation/protected routes, public content and both style scripts. `adm9-web-regression.log` |
| Gate-dependent boundaries | **51 passed**, zero skips, after the handoff fix: workspace, protected routes, auth and admin overview. `adm9-gate-regression.log` |
| Serverless artifact launcher | **5 passed**, zero skips; `pnpm --filter @vetralink/api test:vercel`, `adm9-vercel-entry.log` |
| Real full stack | **21 groups passed**, actual cold start/restart, 192 route visits, persistence, permissions, privacy, concurrency and real queue/worker checks. `adm9-integrated.log`, `results.json` in the directory above |
| Detailed controlled production browser | **1,477 checks passed**, zero runtime exceptions, including 46 overview, 171 directory, 342 catalog/media (including dedicated courses), an additional 165 course workspace checks, 163 billing, 164 consultations, 199 finance/moderation, 99 communications and 123 platform checks plus five initial HTTP checks. `adm9-controlled-browser.log`; screenshots `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-Yr01Lz`. Final aggregator review removed the redundant standalone course invocation because catalog already runs it; remaining cases and assertions are unchanged |
| Final populated migration/restore | Passed on fresh PostgreSQL 16.14; 29 migrations and both schema diffs empty. `adm9-migrations-final.log` |
| Final full API regression | **242 suites / 2,261 tests passed**, zero skips, exit 0, 205.022 seconds, including every opt-in database suite. Same opt-in variables as the runbook; `pnpm --filter @vetralink/api test --runInBand`; `adm9-api-final.log` |
| Shared-session browser regression | Passed bn/en desktop/tablet/375/320px form/focus/Escape/overflow, exact signup/login identity/payload/cookies, navigation/reload, cross-tab rotation/logout, expiry/failure/retry, plus **80 localized GETs / 60 language submissions**, five unsafe returns, 12 catalog filters, four CSV downloads and two missing-template checks. Controlled upstream; `adm9-auth-browser.log`; screenshots `C:/Users/asus/AppData/Local/Temp/vetralink-auth-qa-n3zAH2` |

## Release decision

Full ADM-9 remains incomplete. [Findings](findings.md) and the [runbook](runbook.md) preserve the missing target migrations, current dependency advisory disposition, actual durable worker/provider/media hosting, external acceptance/inbox delivery, alternate browsers/devices and declared load/alert ownership. `pnpm audit --prod --json` exits 1 with 3 critical/23 high/24 moderate/4 low registry matches; no dependency was upgraded, no exploit was attempted and target exploitability is not established by a match alone.

No source was staged/committed/merged/pushed; no deployment, configured database write, provider charge/refund/transfer or external mail/SMS/push dispatch was performed. Farmer milk and actual training content remain deferred.

## Final review and handoff

The [candidate manifest](release-manifest.json) records source/lockfile/schema/migration hashes, the verified build identifier and API artifact hashes, actual checks and raw evidence hashes, with an explicit `NO_GO` release decision. The built web gate source matches the reviewed source. This is a reviewable local candidate, not a deployed artifact or committed revision.

Final sequential self-review covered provider alias lifecycle, current identity/cache handoff, preserved unavailable-session/draft behavior, test data/target guards, actor-bound BFF writes, atomic audits, queue generations, migration preservation, privacy/redaction and evidence/source consistency. No unresolved material finding remains within the implemented local fixes; the release findings above remain open. The same agent implemented and reviewed the changes.

All three task-owned Docker containers were identified by exact UUID name/ID and `vetralink.task=adm9` label, stopped and verified `exited`. The harnesses stopped their own API/Next/Chrome/worker processes. Synthetic container data, backups, logs and ignored isolated builds remain available for review; no unrelated service/data was deleted. Structural context/changed-document validation and final whitespace/syntax checks pass; these validate structure and consistency, not production readiness.

Final structural checks: **48 context documents / 358 links / 99 source entries**, **13 changed/new Markdown documents / 393 local links/anchors**; manifest source and all **29 migration hashes** match the final files. `git diff --check` and all three changed/new browser/migration JavaScript syntax checks pass.

Suggested human-managed commit: `test(admin): add integrated release acceptance and recovery checks`.


## 2026-10-21 security follow-up

The [separate remediation scope and evidence](../../tasks/admin-release-dependencies/plan.md)
replace the local dependency candidate with Next 15.5.28 / React 19.3.1 and patched
spreadsheet/transport dependencies, plus a reproduced veterinarian SSE role/owner
repair. Production audit: zero critical/high and three documented moderate matches.
The new build passes 21 real integrated groups / 192 route visits, 1,312 controlled
admin browser checks and auth/localization regression. Its candidate/evidence
manifest is separate; the original manifest and earlier raw results remain historical.
The configured-target migrations, hosted workers/providers and deployed acceptance
are still open. This follow-up does not complete full ADM-9 or authorize rollout.
=======
# ADM-9 integrated administration acceptance plan

**Goal:** execute existing admin acceptance checks and produce an evidence-backed release decision.
**Spec:** [Acceptance specification](spec.md).
**Architecture:** reuse existing API persistence/HTTP and web BFF/production-browser harnesses. Run disposable infrastructure and isolated build output; retain one matrix distinguishing controlled dependencies from real services and deployed evidence.
**Tech stack:** pnpm 10.18.3, Node 22, NestJS/Prisma/PostgreSQL, Redis/BullMQ, Next.js/Chrome.

## Global constraints

- Human-managed Git: no staging, commits, merge or push.
- Preserve configured environments, live data, existing migrations and unrelated changes.
- Bangla default and selectable English; Tailwind utilities only for web changes.
- No new public API/schema/provider behavior is planned; scoped fixes require reproductions.
- Local execution is authorized; publishing/live migrations/provider mutations are separate release actions.

## Review focus

- A skipped opt-in suite or controlled provider must not become a release pass.
- Browser coverage must include every selected admin slice, including newer ones absent from a default harness run.
- Restore must retain representative records and migration history, not merely start a blank database.
- Notification retry generations must survive retained failed jobs and worker restarts without stale completion.
- API downgrade must not restore legacy media bypasses or collide with generation-zero notification jobs.

## Execution

- [x] Inspect repository instructions, source, scripts, individual evidence and current Git state.
- [x] Write shared acceptance criteria, task plan and explicit environment/evidence boundaries.
- [x] Provision task-owned disposable tooling/services; snapshot source without credentials or development output.
- [x] Build shared/API/web; run relevant API/web/style checks and record advisory results.
- [x] Rehearse populated migration/backup/restore/schema parity and run opt-in PostgreSQL/Redis tests.
- [x] Verify real queue/worker processing/retry/restart with controlled mail and record limitations.
- [x] Run all selected production-browser slices, inspect representative screenshots and accessibility behavior.
- [x] Reproduce/fix in-scope failures; review, test and re-review the final diff.
- [x] Write gate matrix and operational runbook; update authoritative roadmap/context with actual results.

## Execution ledger

2026-10-22: started on `a07d77f` with a clean working tree. Node 22.22.1, pnpm 10.18.3 and Chrome are available; PostgreSQL/Redis/Docker executables are absent from PATH. Scratch/evidence directory: `/tmp/vet-adm9-0bjcZp`. Existing main checkout remains human-managed; use a temporary source copy for builds and synthetic services rather than creating branches or changing Git history.

Ruling: proceed through the user's selected acceptance scope without additional design gates; the system already exists and the user approved executing the proposed acceptance work. Production release remains separate from local execution. Repository self-review remains mandatory; an additional read-only fresh-context reviewer inspected the scoped changes.

Downloaded Ubuntu PostgreSQL **18.6** and Redis **8.0.5** packages/dependent libraries and extracted them only under the scratch directory; no system package installation or repository dependency/lockfile change. Main PostgreSQL cluster listens only on `127.0.0.1:55432`; a separate restore cluster uses `55433`. Redis `56379` is reserved for the real API/role-workflow environment. Runtime acceptance has its own Redis instance at **56380**, because workers bound to different databases must never consume each other's jobs. These versions differ from the documented Compose PostgreSQL 16/Redis 7; rerun on the chosen production versions before claiming target compatibility. Chrome is **154.0.8037.97**.

The temporary source snapshot excludes environment/credential files, Git metadata, dependency/build outputs and development caches; dependencies are linked from the existing install. Shared types and Prisma generation use existing workspace dependencies. Final API builds were also verified in the original checkout; application source changes remain reviewable and uncommitted.

### Scoped fixes and failed attempts

- Real API startup produced a subscription-plan tier unique-constraint failure: `SubscriptionsModule` registered `SubscriptionPlanService` directly and again with `useClass`, causing two independent bootstrap seeders. A failing AppModule identity regression reproduced the duplicate instances (`bootstrap-red.log`); `useExisting` fixes that within-process race and the regression passes (`bootstrap-green.log`). This does not establish multi-process seed concurrency safety or change plan pricing/contracts.
- Added `WORKSPACE_BROWSER_FOCUS=admin-release` to the controlled production browser harness so ADM-4–8 are included alongside the older dashboard/directory/catalog cases. Course administration is included by the catalog scenario.
- Added a dedicated real-service admin focus to the guarded workspace browser harness. The older default scenario assumes obsolete signup radio buttons, Learner dashboard routing and public-header controls; attempts to run it failed on those stale expectations. Exploratory changes to those default helpers were reverted. Its default full Farmer/onboarding scenario remains unverified; the new admin mode covers the selected ADM scope instead.
- Initial new runtime-test inputs incorrectly included an extra `confirmed` field in strict directory actions and assumed the role-notification worker was one of the eight ADM-8 queue names. Corrected the tests to the existing contracts: queue registration is observed directly and durable role-email counters remain separate. No production contract was loosened.
- A concurrent experimental runtime run shared Redis with a worker bound to another disposable database, causing it to consume the wrong synthetic jobs. Dedicated Redis `56380` removes that test-environment collision; the resulting six tests pass. They cover real account-revocation serialization/refresh invalidation, audit rollback, protected targets/demotion, queue observation, confirmed generation retry after worker-object restart, retained legacy failed jobs, stale completion fencing and actual transient BullMQ retry with controlled mail.
- Real-admin harness development caught an invented reminder route (the implemented route is `/admin/dunning`), CDP Enter events missing character data, pending-network state crossing navigations, and incomplete actor-binding headers. The harness now uses the actual routes, sends a real Enter character, clears old navigation tracking and binds writes to `id:role:roleVersion`; wrong-password checks assert the precise error code. One launch during an API restart failed with connection refused and is not counted as acceptance.

## Verification evidence

**Observed behavior, 2026-10-22; candidate based on `a07d77f` with this task's working-tree changes.** Raw logs below are under `/tmp/vet-adm9-0bjcZp`; these temporary artifacts may expire, while the tests and this ledger remain in the repository.

| Command / check                                                                                                                                                                                                                                                                                                                   | Actual result and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @vetralink/shared-types build`                                                                                                                                                                                                                                                                                     | Passed CJS/ESM/declarations (`shared-build.log`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @vetralink/api build`                                                                                                                                                                                                                                                                                              | Prisma generation/Nest production compilation passed, including final source snapshot after the singleton fix (`api-build-snapshot-final.log`); emitted `dist/main.js` and `dist/role-notifications.worker.js`                                                                                                                                                                                                                                                                                                                            |
| `NODE_ENV=production API_BASE_URL=http://127.0.0.1:3411/api/v1 pnpm --filter @vetralink/web build` in temporary snapshot                                                                                                                                                                                                          | Passed styles, type checking and production build; ID `20eSXK8vWaVFX9rvLub2G` (`web-build.log`). Optional sharp and webpack cache warnings remain warnings, not provider evidence                                                                                                                                                                                                                                                                                                                                                         |
| Full API baseline, every existing opt-in database suite enabled, `pnpm --filter @vetralink/api test --runInBand`                                                                                                                                                                                                                  | **242 suites / 2,261 tests passed, no skips**, 222.016 seconds (`api-tests.log`). Real PostgreSQL/Redis plus existing controlled dependencies; before the final new suite/provider-alias regression                                                                                                                                                                                                                                                                                                                                       |
| `ADM9_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm9_test ADM9_TEST_REDIS_URL=redis://127.0.0.1:56380 pnpm --filter @vetralink/api test --runInBand --testPathPattern=release-runtime.database`                                                                                                                     | **6 tests passed**, real database/Redis and controlled mail (`runtime-isolated.log`). Worker-object close/recreation is not proof of production process/host recovery                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin*.mjs scripts/check-auth.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-api-diagnostics.mjs scripts/check-public-content.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs` | **189 tests passed**, no skips (`web-tests.log`); real web boundary code with controlled upstreams                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm --filter @vetralink/web check:styles`                                                                                                                                                                                                                                                                                       | Passed (`styles-final.log`); style compilation tests also included above                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `WORKSPACE_BROWSER_FOCUS=admin-release WEB_TEST_BUILD_DIR=/tmp/vet-adm9-0bjcZp/source/apps/web pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs`                                                                                                                                                        | **1,312 checks passed**, actual production Next/BFF with controlled upstreams, both admin roles, bn/en, mobile/desktop and scoped failure/recovery cases (`browser.log`)                                                                                                                                                                                                                                                                                                                                                                  |
| Dedicated real-service browser command below                                                                                                                                                                                                                                                                                      | **616 checks passed** (`admin-real-browser-strict.log`), actual production Next/BFF/API/PostgreSQL/Redis. Both admin roles and bn/en at 320/1440px; 22 common list/overview routes plus four Super-only routes, actual login/logout tokens, route-specific required BFF reads, terminal loading/data/empty checks, transport failure rejection, keyboard Enter/Escape drawer/focus return, wrong-password rejection, confirmed settings write/reload/persistence, stale replay rejection, one atomic audit and four ordinary-role denials |
| Visual review                                                                                                                                                                                                                                                                                                                     | Inspected actual ADMIN Bangla 320px dashboard and SUPER_ADMIN English 1440px report screenshots under `/tmp/khamar-workspace-qa-P3dF3O`: stacking/wrapping, currencies/units, native fields and no horizontal overflow. Browser assertions are separate from visual review                                                                                                                                                                                                                                                                |
| Real-service visual review                                                                                                                                                                                                                                                                                                        | Inspected ADMIN Bangla 320px reports and SUPER_ADMIN English 1440px administrative access from `/tmp/vetralink-workspace-qa-XGtBbB`. All eight role/locale/width screenshots are retained there. Visible focus returns to the mobile drawer trigger; labels and wrapped layouts remain usable. Screenshots are viewport captures, not full-page/screen-reader certification                                                                                                                                                               |
| Real API startup and `/api/v1/health/readiness`                                                                                                                                                                                                                                                                                   | Final compiled local API starts; readiness returned HTTP 200 with actual PostgreSQL/Redis up. Independent role worker was also started locally with mock mail. No external provider/deployed hosting claim                                                                                                                                                                                                                                                                                                                                |
| `pnpm audit --prod --json`                                                                                                                                                                                                                                                                                                        | Exit **1**, **54** production advisory matches: 3 critical, 23 high, 24 moderate, 4 low (`audit.json`, sanitized `audit-summary.json`). [Triage/gates](release-gates.md); no dependency changes                                                                                                                                                                                                                                                                                                                                           |

### Populated migration and restore

Applied the first **24** unchanged migrations from a temporary copy into disposable `/adm3_test` on port 55432. Inserted a labeled baseline user, legacy product (BDT 777, private legacy storage key), BDT 777 order and failed role-notification delivery with five attempts. Took a logical custom-format `pg_dump` backup (`baseline.dump`) before ADM-3/course/communications/platform migrations. Restored it with `pg_restore --exit-on-error` into a distinct cluster at **55433**, then applied the full committed chain to both clusters using `pnpm --filter @vetralink/api db:deploy` with explicit loopback `DATABASE_URL` values.

Both targets have **29 successful migrations**. The restored schema comparison, `pnpm --filter @vetralink/api exec prisma migrate diff --from-url postgresql://postgres@127.0.0.1:55433/adm3_test --to-schema-datamodel prisma/schema.prisma --exit-code --script`, returned **“This is an empty migration”**, exit 0. SQL evidence (`preserved-55432.log`, `preserved-55433.log`) confirms the unchanged product title/key, default version **0**, INTERNAL provider, order amount/currency and failed delivery attempts **5** with default retry generation **0**. Existing committed migrations and the differing root schema were untouched. This tests a synthetic logical backup/restore, not production recovery objectives.

### Reproduce the full API acceptance environment

Provision only task-owned disposable loopback clusters with all 29 migrations and the labeled baseline product required by the catalog suites. The role workflow suite fixes port 55432 and database `/role_test`; the real browser harness additionally fixes its synthetic login role/password. Never point these commands at a configured/live database. Use separate Redis instances for the role environment and ADM-9 runtime environment.

```sh
export NODE_ENV=test API_DEBUG=0
export DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm9_test
export REDIS_URL=redis://127.0.0.1:56379
export ROLE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/role_test
export ADM3_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/adm3_test
export YT_TEST_DATABASE_URL="$ADM3_TEST_DATABASE_URL"
export YTL_TEST_DATABASE_URL="$ADM3_TEST_DATABASE_URL"
export BILLING_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm4_test
export CONSULTATION_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm5_test
export SETTLEMENT_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm6_test
export REVIEW_TEST_DATABASE_URL="$SETTLEMENT_TEST_DATABASE_URL"
export COMMUNICATIONS_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm7_test
export PLATFORM_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/adm8_test
export ADM9_TEST_DATABASE_URL="$DATABASE_URL"
export ADM9_TEST_REDIS_URL=redis://127.0.0.1:56380
pnpm --filter @vetralink/api test --runInBand
```

For the real browser mode, first start the compiled API on **3311**, connected to `postgresql://role_test:role_test_only@127.0.0.1:55432/role_test` and Redis **56379**, with `EMAIL_PROVIDER=mock`, `WEB_BASE_URL=http://localhost:3310` and `CORS_ORIGINS=http://localhost:3310`. These are disposable synthetic credentials. Wait for actual readiness before starting the browser. Keep ports **3310/9335** free. From repository root run:

```sh
WORKSPACE_BROWSER_FOCUS=admin-release \
ROLE_TEST_DATABASE_URL=postgresql://role_test:role_test_only@127.0.0.1:55432/role_test \
WEB_TEST_BUILD_DIR=/tmp/vet-adm9-0bjcZp/source/apps/web \
CHROME_PATH=/usr/bin/google-chrome \
pnpm --filter @vetralink/web exec node scripts/check-workspace-browser.mjs
```

Do not run database-mutating role suites concurrently with this API/browser against the same database/queue namespace. Snapshot paths above identify this run; build another credential-free temporary source copy for a later run.

## Verification evidence and release decision

The [gate matrix and rollout/recovery runbook](release-gates.md) are the release handoff. Production release remains **not approved**: dependency/security triage, public diagnostic exposure, real configured provider/durable-hosting evidence, target migration/backup/deployed acceptance and remaining accessibility/device/load/monitoring requirements are open. Local accepted checks do not close those gates. No deployment, live migration, provider message/payment, staging/commit/merge/push or dependency upgrade was performed. ADM-9 remains in progress until the release requirements are actually met.

### Final review and verification

Fresh-context read-only review found no critical/important product-code defect in the singleton fix or runtime tests. It identified one important acceptance-harness gap: an h1 and any one BFF response could be mistaken for a fully loaded dashboard. The harness now requires an explicit per-route expected BFF path matrix (including independent dashboard, settlement and media reads), terminal non-loading/non-busy content and actual dashboard counts/application data or empty state. Tracked transport failures are retained and rejected. The strengthened real-service run passed **616** checks. The review's minor health-path correction and baseline-fixture cleanup observation were also addressed. The author performs final re-review; this is not independent production certification.

An extra browser attempt during deliberate local API shutdown failed with connection refused during session cleanup (`browser-api-unavailable-extra.log`). It is recorded as a failed attempt, not another accepted run or evidence for a missing-overview fault injection. The successful stricter run above is the acceptance evidence.

**Final current-source API regression:** the full command/environment above passed **243 suites / 2,267 tests, zero failures/skips**, exit 0, **119.241 seconds** (`api-tests-final.log`). This includes all original opt-in persistence/role suites, the six new runtime tests (with isolated Redis 56380 and restored fixture state), and the AppModule singleton regression. Disposable first-run databases were renamed/preserved and fresh task-owned databases cloned from the migrated baseline for this run; real API/browser processes were stopped first. No configured/live database was reset or renamed.

**Read-only historical release smoke:** anonymous checks against the documented public URLs observed API readiness HTTP **200** with database/Redis up, unauthenticated `admin/platform/settings` HTTP **401**, and web `admin/dashboard` HTTP **307** to `/` (`public-release-smoke.json`). These probes do not identify the deployed revision, establish the pending migration ledger or exercise authenticated production workflows. They do not deploy or alter domain data.

Final author re-review covered the singleton binding, guarded disposable services, fixture/job/session cleanup, actor-bound browser writes, every route's read-completion requirements, role denials, scope/links and honest release status. New/modified scripts pass Node syntax checks, `git diff --check` and context validation pass. The fresh-context review finding was fixed and exercised by the stricter 616-check run; no unresolved material defect remains in the scoped local acceptance changes. Existing release gaps remain in the gate matrix.

Suggested human commit: `test(admin): verify integrated release acceptance and fix duplicate plan bootstrap`.

**Cleanup:** both task-owned PostgreSQL clusters and both Redis instances were stopped successfully after verification. API/worker/Next/Chrome test processes are no longer running; backup, database directories, source snapshot and logs remain under `/tmp/vet-adm9-0bjcZp` for inspection. `fixture-restored.log` confirms the named baseline outbox fixture was restored to its original null completion time. No evidence directory or user data was deleted.
>>>>>>> f0dbce1bf6a67d4b4ab0e96331522ac1cc8df952
