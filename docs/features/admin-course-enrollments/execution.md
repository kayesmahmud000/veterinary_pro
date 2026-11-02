# Execution ledger — docs/features/admin-course-enrollments/plan.md

Implementation authorized by user: 2026-11-02. No commits, merges, pushes or live migrations.

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
