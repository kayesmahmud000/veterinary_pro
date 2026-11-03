# Execution ledger — docs/features/admin-course-enrollments/plan.md

Original implementation authorized by user: 2026-11-02. That implementation did not include commits, merges, pushes or live migrations. The separately authorized2026-11-03 database repair is recorded below.

## Configured-database incident preflight — 2026-11-03

Observed: localhost web forwards to the live API. Admin products returns400 and the BFF maps the backend error to `VALIDATION_FAILED`. Read-only configured-database inspection reproduces Prisma `P2022`, missing `course_enrollments.status`, for both the admin product enrollment count and learner library. Both paths omit YouTube duration lookups, so the Google account used to create a YouTube key is unrelated.

The database still has the four-column legacy enrollment table and six enrollment rows. `20261102090000_admin_course_enrollments` is unapplied. Four unrelated migrations are also pending: admin communications, admin platform, account recovery and draft course pricing. A bare package `db:deploy` would apply these too and is not the scoped course repair.

Preparation only: a private0600 logical snapshot of enrollment rows, column/index/constraint definitions and migration history was verified outside the repository at `/home/syftet/.local/state/vetralink/backups/vetralink-enrollment-repair-GH4YCn.json`. This is an affected-table snapshot, not a full database backup or restore rehearsal. The isolated migration set at `/tmp/vetralink-enrollment-repair-GH4YCn/schema.prisma` contains already-applied migrations plus only the course enrollment migration. Four historical checksums differ solely because of LF/CRLF line endings; repository history was not edited.

Verification:35 tests across courses, admin products, enrollment writer and admin enrollment service pass. Existing populated disposable PostgreSQL migration/restore evidence remains in the feature plan; no new live schema change or authenticated browser acceptance has occurred. Await explicit live-migration authorization under the repository database-change workflow before applying. After authorization, recheck target fingerprint/schema/SQL checksum, apply only the selected migration, compare all six legacy IDs/user-product pairs/created timestamps against the snapshot, check ACTIVE/default lifecycle fields and the original repository reads, then request browser refresh for session-bound end-to-end confirmation. Keep unrelated migrations and feature enablement unchanged.

### Authorized repair outcome — 2026-11-03

The user explicitly approved applying only `20261102090000_admin_course_enrollments`. Before mutation, target fingerprint, unchanged legacy rows/schema/history, SQL SHA-256 and the exact prepared migration set were verified. Historical SQL line endings were normalized only in the temporary copy to match recorded checksums. `prisma migrate deploy --schema /tmp/vetralink-enrollment-repair-GH4YCn/schema.prisma` completed with exit0; the database URL was supplied through the child environment and not logged. Private deployment/verification artifacts: `deploy.log` and `verification.json` in that temporary directory.

Observed after migration, in a read-only transaction: all six original enrollment IDs, user/product pairs and created timestamps are preserved; all six are ACTIVE/SELF/version0, lifecycle timestamps match their original creation dates, and revocation fields are null. The actual compiled `AdminProductsRepository.list({limit:20,type:'VIDEO_COURSE',contentProvider:'YOUTUBE'})` returns four products and their projected list passes the shared response schema. `CoursesRepository.library` and membership reads succeed for all three enrolled accounts, returning six visible course items in total. The migration ledger adds only the authorized migration; every earlier ledger row is unchanged and the other four migrations remain pending. Live API readiness and public course listing both return200.

The initial raw verification query needed explicit enum-to-text casts because Prisma raw result decoding rejected the new enum type; the corrected diagnostic and normal ORM repository reads passed. No application code, auth/session, feature flag, unrelated schema, Git index or deployment changed. Authenticated live HTTP/browser checks still require the user's current session; refresh the affected pages to complete that confirmation. This repair establishes the reported course-query/schema recovery, not readiness of the other pending administration features.

## Enrollment gate and roster follow-up — 2026-11-03

Subsequent icon refinement: the remove action now uses a red Lucide Trash2 icon with a44px target, localized learner-specific accessible name and hover title. Existing confirmation and restore behavior are preserved. Eight enrollment rendered/boundary tests,14 style tests, styling policy and the isolated production build pass. The final ADMIN/SUPER_ADMIN enrollment browser run passes96 checks, including add/remove/restore through the existing confirmation dialogs (`/tmp/vetralink-enrollment-trash-browser.log`); desktop screenshot `/tmp/khamar-workspace-qa-PPfaV6/enrollments-ADMIN-en-1440.png` was inspected. No live deployment was performed.

After the migration, the reported `Enrollment management is currently unavailable.` message maps to `ENROLLMENTS_UNAVAILABLE`, emitted by the existing `AdminCourseEnrollmentsService.assert` when the typed backend flag is false. Directory reads hit this gate before their repository query. No Vercel CLI login, project link or token is available in this workspace; the user was asked to set `ADMIN_COURSE_ENROLLMENTS_ENABLED=true` on the backend's intended deployment environment and redeploy. Live flag enablement and authenticated HTTP recovery are not claimed. Redis/password/version/role checks and the false-by-default gate remain unchanged. Added the flag to the two API env examples and Turbo's environment allowlist, with an operator troubleshooting entry.

Implemented the requested roster: the selected course name is the primary heading, with separate Name, Email, Enrollment status, Enrollment dates and Actions columns. Account status and activation/removal history remain visible. A named, keyboard-focusable table region contains narrow-screen horizontal scrolling. The existing user-centric course list and audited add/remove/restore/create flows remain operational. On enrollment read failure, a separately authorized product-detail request supplies the course title while preserving the enrollment error and withholding learner rows/actions.

Verification: the two new rendered UI regressions failed against the old heading/table, then passed after implementation; all eight tests in `check-admin-course-enrollments.mjs` pass. Adjacent enrollment/workspace/YouTube/navigation suites pass41 tests (`/tmp/vetralink-enrollment-roster-tests.log`); style regressions pass14, style policy and TypeScript checks pass. API feature-policy/HTTP/config suites pass21 tests; expected configuration-rejection warnings are present in that log. The final isolated Next production build passes (`/tmp/vetralink-enrollment-roster-final-build.log`). `WORKSPACE_BROWSER_FOCUS=admin-enrollments WEB_TEST_BUILD_DIR=/tmp/vetralink-enrollment-roster/web CHROME_NO_SANDBOX=1 API_DEBUG=0 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` passes96 controlled browser checks across ADMIN/SUPER_ADMIN, bn/en, and320/768/1440px, including all five columns, title, existing actions and no page overflow. Screenshots at `/tmp/khamar-workspace-qa-eKs1gj/`; en1440 and bn320 were manually inspected. These fixtures do not establish the deployed flag value or live actor-session acceptance. No live deployment, additional migration or account/enrollment write was performed in this follow-up.

Suggested commit for the roster/configuration follow-up: `fix(courses): clarify enrollment setup and display learner roster`.

Ruling: Work in the supplied shared checkout, preserving user-managed Git and existing planning files; do not change branch/worktree state or install dependencies merely for isolation. Verification artifacts use /tmp and the ignored plan scratch directory. Cost: user reviews unstaged changes together.

Pre-flight: Task1 schemas/status consumed by Tasks2–6; consistent. Task2 locked writer consumed by Tasks3/4; consistent. Task3 candidate exact-email projection consumed by Tasks5/6; distinct from privileged lookup. Task4 create response carries no tokens; Task5 BFF must not change cookies. Task7 acceptance consumes all prior boundaries.

Initial state: Tasks 1–7 pending. Existing learner locale/player-remount regression remains a known baseline.

Ruling: use existing ValidationDomainException HTTP422 for invalid enrollment inputs instead of the proposal's HTTP400; preserve established API semantics. Cost: clients must accept422 (existing BFF does).

Baseline:54 scoped tests passed. Contract RED11 failures→GREEN11. Membership RED revoked-access test→GREEN31 scoped tests. Populated disposable PostgreSQL16.6 migration preservation/check test passed.

Implementation record (2026-11-02):

- Task1: contracts/migration implemented. Contract RED11→GREEN11; populated PostgreSQL16.6 migration preserves legacy membership IDs/dates/credentials and enforces revocation CHECK. Prisma validation passed.
- Task2: shared writer plus transaction-only persistence helper, active-only library/playback/detail/counts, sticky revocation and explicit restore implemented. Original revoked-access regression RED→GREEN. Actor/user→product→membership lock order retained.
- Tasks3/4: administrative directories/actions and direct fixed-role User→membership→audit creation implemented. Local unit/HTTP policy/privacy and real database races/rollback/105-row paging/exact-email tests passed; distributed Redis limits/fail-closed behavior passed. No new account/session is returned to the administrator.
- Tasks5/6: exact BFF mapping/current actor and response binding, course/user views, accessible native confirmation dialogs and direct creation forms implemented in bn/en. Passwords clear after attempts; uncertain creation requires exact-email review. Controlled browser tests cover both administrative roles at320/768/1440px and user-centric course reads.
- Task7: real BFF→Nest→PostgreSQL/Redis integration, populated migration, matching-major PostgreSQL backup/restore with gated post-backup revocation reconciliation, scoped/adjacent builds/tests and release runbook implemented. Target migration/deployment/flag enablement were not performed.

Ruling: Output schemas project/strip unknown server fields to preserve safe existing contract conventions, while request schemas reject unknown fields. Cost: an unexpected upstream field is omitted rather than causing a response failure; required identity/course bindings still reject mismatches.

Ruling: Add a stateless transaction-only enrollment persistence helper so domain services do not issue Prisma business queries directly. Cost: one focused file; shared transition behavior remains covered by writer/database tests.

Review findings: a fresh reviewer confirmed focus revalidation unnecessarily remounted authorized playback and course-list counts lacked focus/event invalidation. Both fixed with focused browser RED→GREEN evidence. A suspected existing admin-route shadowing issue was checked against HEAD and retracted (the existing branch was `me/courses`, and admin editing uses `admin/products`). The reviewer session ended before a full verdict; final coverage is sequential self-review plus tests, not a completed independent audit. Candidate partial-email search and Retry-After handling were also corrected. A self-review added strict BFF response user/course binding with RED→GREEN coverage.

Baseline limitations: full API suite retains the documented Redis-free queue/idempotency failures (2 suites/4 tests); full learner browser suite reproduces the documented locale/player-remount assertion. These unrelated issues were not changed. Initial directory browser failure was a missing new endpoint in its controlled fixture; extending that fixture restored its 171 checks. Initial legacy database run omitted the historical product seed required by that existing suite; the isolated fixture setup was corrected and rerun. Initial restore tooling used PG18 clients against PG16; the helper now requires a matching major and the rehearsal uses PG16 clients.

Ruling: Keep creation policy/database tests in the shared feature suites and migration/restore checks in guarded executable scripts, rather than creating every originally suggested spec suffix. Cost: test locations differ from the initial file map; all actual commands and integration boundaries are listed in the plan evidence.

Final self-review also added a labelled reload action after stale membership versions and explicit Asia/Dhaka presentation for administrative enrollment times. No production deployment, real user mutation, hosted configuration change, Git staging or commit was performed.

Task 1: complete — shared contracts, additive schema/migration, Prisma validation and populated preservation checked.
Task 2: complete — sticky revocation/shared writer, real membership races and legacy course persistence regression checked.
Task 3: complete — guarded directories/candidates/actions and safe operational audit projections checked.
Task 4: complete — atomic direct account creation, credential/session privacy, duplicate signup and rollback checked.
Task 5: complete — exact BFF/response binding, Retry-After and learner access UI checked.
Task 6: complete — bn/en administrative course/user management, direct creation and browser checks completed.
Task 7: complete for local implementation/verification — real DB/Redis/BFF/browser/build/restore evidence and runbook delivered; live release gates intentionally remain separate.

Final evidence:10 scoped API suites/105 tests;2 new DB/Redis suites/8 tests;2 legacy course DB suites/12 tests;71 web regression checks;72 new enrollment browser checks;470 connected course-editor browser checks;171 directory checks;6 playback-revalidation checks;2 count-refresh checks. Full API and learner suite baseline failures remain reported in plan.md. No independent full-review verdict is claimed. Documentation links/context/whitespace and Tailwind checks passed.

No Git integration was attempted: the repository's human-managed Git policy takes precedence over finishing-skill merge/commit menus. Tests that remain red are existing documented baselines, not authorization to broaden this feature into queue/idempotency/locale repairs.
