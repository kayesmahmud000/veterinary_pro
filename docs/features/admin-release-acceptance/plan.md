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
