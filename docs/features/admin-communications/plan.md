# ADM-7 implementation and evidence

Spec: [contracts and acceptance](spec.md). Started 2026-10-19 at `50af1f3` with clean Git state. Human-managed Git policy retained.

## Implementation plan

- [x] Add shared strict contracts, additive active-schema migration and repository mappings.
- [x] Implement current-identity guarded content/draft/revision/publication, safe public reads and vet eligibility policy.
- [x] Implement safe domain notification history, durable generation-based retry and worker compatibility.
- [x] Implement own/support administrative queue, messages, assignment/status and atomic audits.
- [x] Wire exact BFF routes, bilingual administrative and own support screens, navigation and public discovery/detail.
- [x] Review, exercise meaningful API/shared/BFF regressions, builds/styles, browser flows and disposable migration if available.
- [x] Re-review final diff; update owning roadmaps/context and record evidence/limitations.

## Investigation

**Confirmed from code:** AdministrationModule contains ADM-1–6; no CMS/support tables or controllers exist. Current role-email outbox has durable recovery but retained failed BullMQ jobs use a fixed ID; retry needs a generation. Consultation logs can describe mock-bound delivery and are not proof of recipient delivery. Existing public content is source-managed; blog/doctor middleware currently marks unknown source slugs 404 and must consult the published CMS for new slugs. Workspace BFF already provides same-origin, current auth/me, bounded strict schemas and actor binding; extend its fixed allowlist.

**Observed environment:** Docker CLI exists but Docker Desktop Linux engine is unavailable; no psql is on PATH. A temporary PostgreSQL binary package was obtained from the npm registry outside the repository. `SELECT version()` confirmed PostgreSQL 18.4 (Windows x64). Two explicitly disposable clusters under the OS temporary directory used loopback ports 55437/55438 and database `/adm7_test`. No dependency/lockfile, production database or provider configuration was changed.

## Risk and recovery

Cross-stack additive change affects public discovery, private drafts, support privacy and role-email dispatcher job identity. Preserve static source content with reserved slugs and regression tests. Never run external providers in acceptance. Migration precedes code rollout; old code can ignore new tables/defaulted column. Data stays preserved on rollback. All sensitive writes use locked current identity, optimistic versions and same-transaction audit. Run sequential self-review; no subagents are authorized by this task.

## Verification and review

**Confirmed from code:** shared Zod contracts validate and project both HTTP/BFF boundaries; new controllers/services/repositories are registered in AdministrationModule. Own support and administrative support have distinct permissions and projections. Public reads select a separate published snapshot and current VET identity/version. `EditorialText` escapes all authored text; active markup is never executed. The unified content editor replaces the roadmap's earlier proposed type-specific URLs. Its protected veterinarian reference links to the existing directory for qualification review. The additional public page/guide indexes are reachable from Help; source-authored articles/FAQs/demo doctors are preserved.

### Review findings and corrections

- Preserve generation-zero BullMQ job IDs across deployment; new explicit retries use a new generation and queue ID. Both worker dispatch and durable completion/failure are generation-fenced. Unknown/obsolete events and changed target identities are not replayed.
- The initial disposable schema comparison identified missing `ON UPDATE CASCADE` on the six new foreign keys. Corrected the new unreleased migration, restored the pre-ADM-7 cold backup to a separate cluster, applied the final migration there and obtained an empty schema diff. No existing committed migration was edited.
- A navigation regression exposed a second separated Platform group. New entries now remain beside the existing Platform entries; the original consultation grouping regression passes unchanged.
- Own support responses fail closed if an upstream sends a foreign requester, internal note or administrative event. Safe list projections enforce requested limits/filters/cursors and mutation responses must acknowledge the correct ID/version/generation/publication state.
- Deleted assignee redaction previously made an existing assignment indistinguishable from an unassigned ticket during mutation. The service now compares the locked raw assignment inside the repository boundary; a real PostgreSQL regression verifies unassignment without disclosing the deleted identity.
- Filter changes discard old result scopes; a failed filtered request cannot display rows from a previous filter. Failed draft saves preserve input and require reload for uncertain outcomes. Explicit draft reload clearly says it replaces local edits. Revalidation clears passwords/confirmation; actor changes discard the mounted workspace. Completion callbacks ignore unmounted workspaces so an old account's response cannot redirect a new session.
- Added the missing main landmark/skip target, removed duplicate public article headings/summaries and hid empty supplemental CMS sections beside existing public articles. Password/eligibility/validation errors have bilingual recovery copy. Plain-text preview/public injection and responsive wrapping have actual rendered checks.

Review was a sequential self-review by the implementing agent, with backend/database/security, UI and QA perspectives; it is not an independent external audit.

### Observed local verification

| Check | Result and limits |
| --- | --- |
| Shared package | `pnpm --filter @vetralink/shared-types build` passed CJS/ESM/declarations. |
| API production build | `pnpm --filter @vetralink/api build` passed Prisma generation and Nest compilation; final API type check also passed. |
| Focused API/shared/worker/HTTP | **3 suites / 31 tests passed**: 13 real PostgreSQL cases, one shared-contract case, four actual Nest HTTP cases with controlled authentication/use cases, and 13 worker/template tests with controlled queue/mail. Limiter is controlled in database/HTTP fixtures; live Redis/provider dispatch is not established. |
| Web boundaries/styles | **135/135 passed**, no skips: communications, finance, consultations, workspace, navigation, protected routes, overview, auth, public content, styling guard and Tailwind compilation. |
| Production web | Final `pnpm --filter @vetralink/web build` passed compilation/type validation/static generation, including mutation-unmount guards and the protected veterinarian reference. Build ID `2io9bzl_uzmMhTH-45y3B`. Existing optional-sharp/cache-size warnings do not fail the build; standalone ESLint configuration is not established by this command. |
| Production Chrome | Final **99 checks passed**, exit 0, on the controlled production Next/React/BFF application in both languages, both admin roles, 320/1440px and four denied roles. Creation, publication/removal, password rejection, retry, assignment/status/reopen, internal/public support, own creation/reply, stale draft/reload and failed-filter recovery passed. Explicit veterinarian verification is required before publication, the protected directory reference is present and the private verification note stays out of the public biography. |
| Final API regression | Fresh current-source full run: **231 suites / 2,114 tests passed**, exit 0; **8 suites / 127 tests skipped** because their opt-in environments were absent. The 13 ADM-7 real database cases among those skips were explicitly run in the separate 31-test focused run above. Other opt-in integration environments remain unverified. Default timeouts were retained. |

The initial broad API run had **227 suites / 2,105 tests pass**, 8 suites/126 tests skipped, and five failures: four existing PDF test timeouts during concurrent verification and one worker assertion against source loaded before the generation-zero compatibility correction. A fresh isolated rerun of all three affected suites passed **25/25 tests**, with default timeouts. The final current-source full run is recorded below; the initial failed run is not described as a pass.

Reproduce the focused database/HTTP/worker run with `NODE_ENV=test API_DEBUG=0 DATABASE_URL=<disposable-loopback-url> COMMUNICATIONS_TEST_DATABASE_URL=<same-url> pnpm --filter @vetralink/api test --runInBand --testPathPattern='communications.(database|controller).spec|role-notifications.spec'`. The opt-in URL must name loopback `/adm7_test`; the suite cleans only its synthetic fixtures. It uses actual repositories, transactions, password hashing, row locks and audit persistence. Rollback tests deliberately fail audit writes; race tests exercise different actors. Public vet visibility, protected role changes, requester isolation and internal-note privacy are real database cases.

Web command: `pnpm --filter @vetralink/web exec node --test scripts/check-admin-communications.mjs scripts/check-admin-finance.mjs scripts/check-admin-consultations.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-admin-dashboard.mjs scripts/check-auth.mjs scripts/check-public-content.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`. Browser command: `WORKSPACE_BROWSER_FOCUS=communications CHROME_PATH=<Chrome-executable> pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` against the production build. Upstreams are synthetic; the request log has no provider-send/transfer/refund/capture route.

### Observed migration and recovery rehearsal

1. Initialized a new local-only PostgreSQL cluster; deployed the 27 preexisting migrations using a temporary copy of the migration tree. The root schema and all existing migration files were untouched.
2. Inserted a labeled synthetic pre-ADM-7 user, outbox and failed delivery with five attempts. Stopped the cluster cleanly and copied its data directory to `vet-adm7-pg/baseline-backup` under the OS temporary directory.
3. Applied the draft migration and compared the database with the active API schema. Reviewed/corrected the foreign-key update rules described above before finalizing this new migration.
4. Restored the cold backup to `vet-adm7-pg/restore-rehearsal`, started it separately at `127.0.0.1:55438`, and deployed the final 28th migration. The original labeled user/delivery/outbox remained intact; `retryGeneration` defaulted to zero and the existing five attempts/status were preserved.
5. `prisma migrate diff --from-url <restored-disposable-url> --to-schema-datamodel prisma/schema.prisma --exit-code --script` returned **“This is an empty migration”**, exit 0. Final real database tests ran on this restored/migrated cluster and passed.

This is a populated disposable migration and cold-backup restore rehearsal, not production backup/restore certification. Release requires an approved target, verified backup/restore, this additive migration before the new code and a durable configured notification worker. Reverting HTTP/UI code may leave these additive tables/column in place; preserve authored/support data and do not drop tables as rollback. Stop new retry requests during rollback and retain a generation-aware worker until pending retries drain; an old dispatcher can collide with a retained generation-zero failed job and leave a newer retry pending. Durable rows remain available for forward recovery. Migration removal/reapplication is not a production recovery plan.

### Release/evidence limits

No deployment, production migration/data mutation, provider email/SMS/push, infrastructure setting, Git index/history operation or follow-on ADM-8 implementation was performed. Provider acceptance is not recipient delivery, consultation logs may be mock-bound, and retry after an ambiguous provider failure may duplicate a message. Real Redis/BullMQ retry execution, configured external mail, live licensing/identity verification, alternate browsers/devices and one integrated production web/API/database journey remain release acceptance. These are local implemented workflows with explicit evidence, not a platform-wide production certification.

Logs and disposable artifacts are under the OS temporary directory: `adm7-focused-api.log`, `adm7-final-database.log`, `adm7-accepted-api.log`, `adm7-http-worker.log`, `adm7-api-all.log`, `adm7-regression-recheck.log`, `adm7-web-accepted-tests.log`, `adm7-web-accepted-build.log`, `adm7-api-accepted-build.log`, `adm7-browser-accepted.log` and `vet-adm7-pg/`. Final checks/cleanup are recorded next.

### Final re-review and completion — 2026-10-19

Final source tests/build logs: `adm7-api-final-regression.log`, `adm7-api-final-build.log`, `adm7-final-boundaries.log` (28 affected boundary/navigation/public regressions passed after the final UI corrections), `adm7-final-build.log`, `adm7-final-browser.log`. The broader web run remains **135/135**, with the final affected subset and browser pass covering subsequent scope/landmark/error/reload/unmount/reference changes. No further application change followed the final production build/browser run.

Final Chrome screenshots are in `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-P6UktL`, with eight ADMIN/SUPER_ADMIN, bn/en, 320/1440px support views. Final Bangla mobile/English desktop captures were visually inspected for actual type size, wrapping, readable history, private-note labels, navigation grouping and absence of horizontal overflow; final browser layout assertions also pass. Chrome is the tested engine. The request logs contain no external dispatch/transfer/refund/capture operation.

`python -X utf8 .context/scripts/validate.py` passed **48 Markdown documents / 346 local links / 95 curated source entries**. UTF-8 mode is needed because this Windows host's default Python encoding is cp1252; no validator source or global setting was changed. `git diff --check` passed. Final self-review covered scopes, module wiring, locked mutations, audit rollback, public snapshots, note privacy, worker compatibility, UI recovery, schema parity and documentation. No unresolved material finding was identified within local ADM-7 scope. Provider/deployment/alternate-device limits above remain explicit.

Temporary PostgreSQL clusters and browser/Next/upstream harness services are stopped after verification; test logs, cold backup and disposable data remain in the OS temporary directory for inspection. No source is staged or committed. **ADM-7 local implementation and acceptance are complete.** ADM-8 remains the next proposed batch and was not started. Suggested commit: `feat(admin): add content publication notifications and support workflows`.
