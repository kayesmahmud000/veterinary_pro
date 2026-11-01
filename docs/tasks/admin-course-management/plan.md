# Admin Courses Management Implementation Plan

> **For agentic workers:** Use executing-plans inline with test-driven-development; obtain one fresh final reviewer under requesting-code-review. The user explicitly requests execution after planning. Preserve the supplied checkout and do not commit.

**Goal:** Make course administration list-first and connect information, lessons, review and publication in one workflow.
**Architecture:** Reuse the guarded versioned product/curriculum/action APIs, add safe artwork/count projections, and compose course-specific list/dialog/wizard components. Preserve learner authorization and existing storage/payment paths.
**Tech stack:** Existing Next/React/Tailwind, Nest/Prisma/shared Zod and repository CDP/Jest tooling; no new dependencies.
**Spec:** [Requirements and actual root causes](spec.md).

## Global constraints

- Courses administration only; no ROADMAP/recovery/unrelated notification work, no Git history/index writes or production mutations.
- Preserve bilingual copy, Tailwind utilities and prior learner `w-11/12`/Courses-first navbar.
- Existing current-role/version guards, reason confirmation, audit transactions, soft-delete relations and private/no-store behavior remain authoritative.
- No invented category/learner personal fields or fake enrollment numbers. Optional read fields remain backwards compatible.
- User resolved paid source for this stage: no gateway/payment; all active courses free, public videos; paid configuration may be saved only as an unpublished draft. Do not enable paid YouTube access or claim Private videos are unlocked by enrollment. Record the selected supported path before dependent paid implementation.

## Review focus

1. Lost create acknowledgement/repeated Next clicks cannot create duplicate courses; returned draft ID must be reused.
2. Moving steps preserves both information and lesson drafts/version, and publication never silently drops unsaved lessons.
3. A published course edit preserves visibility until an explicit confirmed unpublish; deletion retains enrollment/media/lesson rows.
4. Account/role/version changes during queued mutations or preview loading cannot act as another administrator or retain private playback.
5. Older API fields, failed/slow reads, long Bangla labels and 320px dialogs must recover without invented counts, clipping or hidden controls.

## Task 1: Actual artwork/count projection and future pricing drafts

**Files:** shared validation `admin-catalog.ts`, `youtube-courses.ts`; API `products/admin-products.repository.ts`, `admin-products.service.ts`, course repository/service and adjacent tests; web boundary tests.
**Interfaces:** optional nullable public HTTPS `thumbnailUrl` in admin create/edit/read; optional `previewImageUrl`, lessonCount/enrollmentCount in admin reads. Metadata stores explicit art only; counts derive actual active lessons/all memberships.

- [x] Write/run failing service/schema/persistence cases for safe artwork/old-response compatibility, actual counts and unchanged metadata; reject non-HTTPS/credential URLs and read-only count injection.
- [x] Add the necessary `20261023130000_course_pricing_drafts` constraint migration: paid drafts allowed, published YouTube pricing remains zero at DB/API boundaries. Apply only to the disposable test database, preserving existing rows.
- [x] Implement optional schema/projection and repository relation counts in current paths; never spread DTO-only fields into Prisma columns. Preserve legacy omitted-thumbnail edits and existing source privacy.
- [x] Build shared types, verify product/course boundaries and real PostgreSQL count/soft-delete/audit tests on explicit disposable adm3_test.

## Task 2: List, details and direct lifecycle actions

**Files:** new web `components/workspace/admin-courses.tsx`, `admin-course-dialog.tsx`, `admin-course-actions.tsx`; admin course list route; `lib/i18n/admin-courses.ts`; browser cases/fixtures.
**Interfaces:** list uses existing adminProductListSchema; details/actions consume AdminProduct and callbacks for confirmed change. Native dialog manages focus/dismissal and pending action lock; writes use existing actor header and action schema.

- [x] Extend/run browser RED for list-first/Add button, counts/details, direct publish/delete confirmation and absent product-route navigation.
- [x] Build responsive course cards/filter/pagination and skeleton/error/empty states, lazy artwork and on-demand details modal. Add direct versioned publish/unpublish/delete with title/reason, loading/error/reload and acknowledged success.
- [x] Verify draft/published lifecycle, retained enrollments on soft delete, role denial and responsive keyboard/modal behavior.

## Task 3: Connected creation/edit wizard

**Files:** new web `admin-course-wizard.tsx`, `(workspace)/admin/courses/new/page.tsx`; change existing `[id]/page.tsx`; embed `admin-course-curriculum.tsx`; localized copy and tests.
**Interfaces:** Wizard owns saved AdminProduct/AdminCurriculum and unsaved information/lesson state. Embedded lesson editor receives initial curriculum/version and stable onSaved/onStateChange callbacks; no route exits or independent publication link.

- [x] Write/run failing browser cases for one-route steps, validation and duplicate slug, retry/lost acknowledgement, retained form/lesson drafts, same ID edits, review/readiness and published lesson guard.
- [x] Implement info save/reuse, explicit uncertain-create recovery, embedded lesson state/preview and review actions. Keep draft protection across locale/history/cancel; avoid repeated reads on steps.
- [x] Preserve published info editing and provide explicit in-place unpublish for lesson updates. Gate preview on confirmed auth and reuse bounded player on demand. Complete selected paid-source behavior only after clarification, preserving actual capabilities.
- [x] Verify create/save/reload/edit/order/publish/delete end to end for both administrative roles and locales, plus existing product/media regressions.

## Task 4: Role-aware public actions and route/loading integration

**Files:** `lib/workspace/navigation.ts`, `components/auth/public-account-menu.tsx`, public course catalog/detail, course-local loading files and adjacent tests.
**Interfaces:** current isAdministrativeRole controls management links; backend remains authoritative. Validated `/admin/courses/new` return retains all existing route restrictions.

- [x] Add/run role/navigation failures; implement management actions instead of enrollment for admins, remove administrative My courses entries, preserve ordinary learner entries/API.
- [x] Add course-scoped route skeletons and ensure auth checking hides protected controls and previews without global unrelated UI changes.
- [x] Run learner and admin browser regressions, direct-route/BFF checks and account transition cases.

## Task 5: Final review and verification

- [x] Run sequential shared/API/web builds; full relevant API and web node tests, styles and browser matrix; inspect desktop/tablet/mobile captures.
- [x] Fresh reviewer reads this task's diff against `/tmp/admin-course-task-baseline` (prior dirty work is excluded). Fix material findings with regression cases and rerun affected checks.
- [x] Re-review and record changed files, exact results, paid/provider limits and recovery/deployment boundary. Update scoped context/spec links without ROADMAP changes. Leave uncommitted.

## Execution evidence

User clarification resolved: public videos and free enrollment now; admin may configure future paid courses as unpublished drafts using existing price/discount/currency fields. No gateway or paid enrollment. Implementation/test evidence follows.


## Migration rollout and recovery

The sole new migration `20261023130000_course_pricing_drafts` replaces the existing YouTube CHECK constraint in one transaction. It adds no columns and changes no product values. Published YouTube courses still require VIDEO_COURSE, an empty internal key, zero price and null discount; draft pricing must be nonnegative with a valid lower discount. The SQL uses a five-second lock acquisition timeout; adding the validated check scans products and needs an exclusive table lock. Production table size, lock duration and the target migration state remain unmeasured.

Release preparation: inspect pending migrations and target state, capture the existing product count and current constraint definition, take the normal reviewed backup, and schedule the constraint change for acceptable write traffic. Apply the migration before enabling the new API/UI's paid-draft writes, then deploy shared/API/web together and check free creation/enrollment and paid-draft publication denial. No production execution is authorized by this task.

A failed SQL transaction leaves the old constraint intact. If new code is rolled back after paid drafts exist, keep the forward constraint and preserve those rows; older code may refuse to edit paid drafts. Reinstating the old free-only check would fail over nonzero drafts. Do not silently zero fees/delete drafts. Restoring the previous constraint requires a separately reviewed preservation/conversion or backup-restore decision and verified row counts; backup restore can lose subsequent writes. No destructive down migration is provided.

### Disposable migration rehearsal

Observed on task-owned PostgreSQL18.6 at loopback: a separate `admin_course_pricing_rehearsal` database applied the30 existing migrations, then inserted a published free YouTube course, free YouTube draft and paid internal ebook. Applying the31st migration preserved their full serialized rows exactly. Valid paid draft pricing/discount succeeded; paid publication, nonzero pricing on a published YouTube course, negative pricing and invalid equal-price discount failed at the database. Returning the paid draft to free allowed publication. This is synthetic populated-data evidence, not a production migration, historical data recovery or PostgreSQL16 parity claim. Separate `adm3_test` integration tests check actual relation counts, audit/concurrency and retained lessons/enrollments.

### Review corrections

Fresh read-only review found and drove fixes for: a no-op reload on `/new`; lost-create acknowledgement identity; edits racing a slow reload; an absent lookup racing an in-flight transaction; and ordinary initial slug-conflict correction. The wizard now reloads its saved ID/version and lessons in place, locks controls during reload, and retains the original unique slug for ambiguous retries. A definitive first-attempt rejection unlocks correction without dropping the other fields. The guarded product list adds exact bounded slug lookup rather than scanning substring pages. Browser RED demonstrated a second POST after lost acknowledgement and the read-only slug regression before their fixes. Final browser evidence is recorded below after verification.


## Final verification — 2026-10-23

| Check | Observed result and evidence scope |
| --- | --- |
| Shared build | Passed `pnpm --filter @vetralink/shared-types build` before dependent compilation/tests. |
| API production build | Passed `pnpm --filter @vetralink/api build`. |
| API complete Jest run | **241 suites / 2,190 tests passed**; eight other opt-in suites /177 tests skipped. `--runInBand` with explicit `ADM3_TEST_DATABASE_URL`, `YT_TEST_DATABASE_URL`, `YTL_TEST_DATABASE_URL` and `DATABASE_URL` pointing to task-owned loopback `/adm3_test`. Course persistence suites actually ran; skipped suites are not reported as passes. |
| Focused actual course persistence | Earlier focused products/courses run passed12 suites/110 tests. Actual count2 versus enrollment1, safe metadata preservation, soft deletion retaining memberships/lessons, audit rollback, same-version races and paid-draft/free-publication boundaries are exercised. |
| Web Node tests | **222 tests passed**, no skips. Includes fixed BFF/identity/schema/return-path boundaries, safe/malformed artwork and exact slug length compatibility. Select only scripts importing `node:test`; do not invoke browser scripts through a broad glob. |
| Web production build | Passed isolated Next build from current source without copied `.env` files. `.next` output is outside the checkout; no dependency changes. |
| Tailwind guard | `pnpm --filter @vetralink/web check:styles` passed. |
| Connected administration Chrome | **362 checks passed**: ADMIN/SUPER_ADMIN × bn/en ×320/768/1440px, list-first, same-route create/edit/version reload, initial duplicate correction, committed lost-response recovery, safe original-slug retries, double clicks, retained info/lessons, slow reload locking, URL validation, removal/reordering, lazy single preview/cleanup, review/publication, published master edits, unpublication, direct list lifecycle, counts/details, soft retention, future paid drafts and ordinary-role denial. HTTP upstream and player events are controlled fixtures. |
| Catalog/media Chrome regression | **539 checks passed**, including the362 connected administration checks and118 existing YouTube administration checks plus generic product/media coverage. Counts overlap; these are not additional unique cases. |
| Learner Chrome regression | **192 checks passed** for existing discovery/selected enrollment/auth/player/library flows, both locales/responsive widths, failures, source isolation and request counts. Synthetic backend/player fixtures; no real memberships created. |
| Real YouTube sample | Actual official IFrame API reached `onReady`, then playback/time acceptance passed against a public sample with synthetic local course data. Does not prove every administrator-supplied video is embeddable or available to every region/account. |
| General localization regression | Passed80 localized GETs,60 native language-form submissions, persistence/isolation, five unsafe-return cases,12 catalog filters, four CSV downloads and two missing templates. Separate local Next server plus explicit empty-CMS404 fixture. First invocation lacked a server, and an unavailable-CMS setup correctly returned503 rather than the test's expected404; corrected test fixtures passed without application changes. |
| Visual inspection | Inspected Bangla320 review, English768 review and English1440 details captures; readable controls/layout and no horizontal clipping. Browser checks assert review/details overflow and centered `w-11/12`. Temporary captures are under `/tmp/khamar-workspace-qa-nlpLFt`; repeat catalog captures under `/tmp/khamar-workspace-qa-LLLYno`. |
| Fresh review | Read-only reviewer compared task-scoped source against `/tmp/admin-course-task-baseline`; final focused re-review reports no material findings after the recovery fixes. Reviewer inspected code/tests; runtime evidence above was run by the implementer. |
| Context/diff | `.context/scripts/validate.py` and `git diff --check` passed; final structural check repeated after documentation updates. |

Reproduction: run the shared build first, then API/web builds/tests. Browser commands use `WORKSPACE_BROWSER_FOCUS=admin-courses` (or `catalog`, `courses`, `courses-provider`), `WEB_TEST_BUILD_DIR=<isolated-web-app>` and `CHROME_NO_SANDBOX=1` with `pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs`. Keep these browser runs serial because they own the same local test ports. Local fixture services/PostgreSQL were stopped after verification; their task-owned files remain available for inspection.

### Handoff and remaining boundary

All selected implementation tasks are locally complete. Free course enrollment, current source/privacy rules and prior learner navigation remain; Admin/Super use management actions. Paid configuration is an unpublished draft preparation path, not a paid enrollment or payment integration. No live content changes, target migration, deployment, Git staging/commit/merge/push, or unrelated recovery/notification/ROADMAP edits occurred. PostgreSQL16 parity, production lock/row-volume behavior, target deployment and future paid entitlements/provider acceptance remain separate work. Existing production release gates are unchanged.

Suggested commit: `feat(courses): connect admin course management and future pricing drafts`.


## Protected course table refinement — 2026-10-23

User requests a table list instead of cards for the protected Admin/Super Admin course screen. Replace only that listing with seven semantic columns: course (compact artwork/title/slug), publication, pricing, lessons, enrollments, updated date and the existing actions. Keep the centered width, filters, pagination, dialogs and wizard. A labeled focusable overflow region keeps all columns/actions reachable on narrow screens without changing to cards. Shared artwork receives an optional compact fallback; default learner/detail artwork remains unchanged.

- [x] Update table presentation and compact thumbnail; review semantics/overflow and existing data/action paths.
- [x] Run the existing administrative browser matrix with table/scroll assertions, styles and isolated production build; inspect desktop/mobile table captures.
- [x] Record results and leave all changes uncommitted.

Observed verification: the new semantic-table check failed against the prior card build (`Course table loaded`), then **410 connected administration browser checks passed** after the change, covering both roles/locales at320/768/1440px. Columns retain native table/row/column semantics, actual counts and all prior lifecycle actions. Table overflow remains inside a focusable region; the page itself does not overflow. Production Next build, Tailwind guard,14 styling tests, context validator and diff whitespace check passed. Desktop and mobile table-start/actions captures were inspected under `/tmp/khamar-workspace-qa-dn0LC9`. No API/schema/payment changes or new dependencies were needed for this refinement. Existing in-progress checkout changes are preserved and uncommitted. Suggested refinement commit: `style(courses): show protected admin courses in a table`.


### Table width correction — 2026-10-23

The user removes the `w-11/12` requirement specifically from the protected course table list. Removed the centered width wrapper from `AdminCourses` and the corresponding route loading state; they now use the normal full workspace content width. The table keeps its contained horizontal scroll region. Wizard/public/learner widths are unchanged. This supersedes the centered-list wording in the table refinement above. Verification: Tailwind guard, context validation and whitespace review; no new tests or broad browser/build rerun for this utility-only correction. Suggested commit: `style(courses): use full workspace width for admin table`.


### Icon actions and no horizontal scroll — 2026-10-23

Latest user correction requires full workspace width, icon-only row actions and no horizontal scrolling. Use a fixed-layout responsive table: seven columns on large workspaces, and course information plus actions columns on smaller screens, retaining the other values inside the course cell. Keep44px action targets, localized accessible names/tooltips, existing confirmations and server contracts. Remove the minimum table width/scroll wrapper. Verify existing browser matrix for all action bounds, no table/page overflow, icon-only accessible actions, lifecycle behavior and both locales; rebuild the isolated web app and run styling checks.

Observed final verification for the icon/no-scroll correction: isolated production build and Tailwind guard passed,14 styling tests passed, and **434 connected administration browser checks passed** for both roles/locales at320/768/1440px. New assertions prove full workspace width, no page or table-wrapper horizontal overflow, icon-only action content, localized accessible names, and action bounds within the viewport. Existing lifecycle/dialog checks still pass using accessible action names. Mobile and desktop captures inspected under `/tmp/khamar-workspace-qa-9woHGe`; all course metadata is retained in the mobile course cell. This supersedes the earlier scrolling-table design and width-only verification note. Context validation/diff review passed. No API/schema or dependency change. Suggested commit: `style(courses): use icon actions and fit admin table`.


### Right-aligned actions — 2026-10-23

Per user correction, align the icon grid to the right edge of each action cell with `ml-auto` and right-align its heading. Existing responsive wrapping, icon sizes and cell padding remain. Verified Tailwind guard and diff whitespace; this utility-only alignment change does not require a new test or broad build/browser rerun. Suggested commit: `style(courses): right-align admin course actions`.
