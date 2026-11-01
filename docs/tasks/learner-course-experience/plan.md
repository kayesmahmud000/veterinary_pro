# Learner Courses Experience Implementation Plan

> **For agentic workers:** Use executing-plans to implement inline task-by-task; the user explicitly authorizes implementation immediately after planning. One fresh final code review, with no per-task implementer delegation. Do not commit.

**Goal:** Complete public discovery, explicit free enrollment and focused lesson playback while preserving authorization and administrative behavior.

**Architecture:** Keep the existing Nest/Prisma service and BFF boundaries. Add a backwards-compatible public-demo artwork projection, shared visual primitives and selected-lesson enrollment intent. Move protected learner pages into a dedicated route group; preserve URLs, session guards and bounded player/request lifecycles.

**Tech stack:** Existing Next 14/React 18/Tailwind 3, Nest 10/Prisma 5, shared Zod, Node browser/CDP harness; no dependencies added.

**Spec:** [Learner requirements and diagnosed causes](spec.md).

## Global constraints

- Learner/public Courses only. No ROADMAP edits, recovery continuation, admin features, database changes, deployment or live data mutations.
- Preserve all existing dirty work; use supplied checkout. Git integration remains human-managed.
- All course screens and learner header use centered `w-11/12`, as explicitly requested in the follow-up.
- Tailwind utilities only. Bangla default and English; localize all new states and format counts with locale.
- Existing current-user enrollment, source protection, private/no-store and exact auth-return contracts remain authoritative.
- Enrollment body remains `{}`; no additional personal-information fields.
- Only PUBLIC_DEMO artwork may be exposed. Thumbnail field is optional/nullable for old API compatibility.

## Review focus

1. A locked lesson other than firstLessonId must remain selected through sign-in, retry and successful enrollment (Task 2 browser).
2. Broken/missing artwork, long Bengali titles and 320px screens must reserve media space without overflow or broken icons (Tasks 1/2 browser).
3. Lost enrollment acknowledgement and rapid clicks must produce one membership/audit and recover (Task 2 browser + existing PostgreSQL test).
4. Same-course lesson changes and locale changes must destroy obsolete playback without repeated outline reads or multiple players (Task 3 browser).
5. Slow API/provider, timeout then late onReady, logout/account/version changes must never display stale private data or infinite loading (Task 3 browser + session regressions).

## Task 1: Safe artwork and visual discovery

**Files:** `packages/shared-types/src/validation/youtube-courses.ts`, `apps/api/src/modules/courses/courses.repository.ts`, `courses.service.ts`, `courses.spec.ts`, `courses.database.spec.ts`; web `components/courses/course-artwork.tsx`, `course-card.tsx`, `course-catalog.tsx`, `course.styles.ts`, `lib/i18n/courses.ts`; `scripts/check-youtube-courses.mjs`, `course-browser-cases.mjs`.

**Interfaces:** Produce optional nullable CourseCard.thumbnailUrl constrained to `https://i.ytimg.com/vi/<11-character-id>/hqdefault.jpg`. CourseArtwork accepts src/title/priority; CourseCard accepts shared course card fields and destination/action. Existing course list/search contract unchanged.

- [x] Add failing service/schema/BFF tests: artwork from PUBLIC_DEMO only; enrolled-only returns null; raw restricted IDs stay absent; older responses parse; malformed/arbitrary image origins are rejected. Run focused tests and observe expected failures.
- [x] Implement projection and shared contract without metadata/database/admin changes. Build shared types before dependent tests.
- [x] Extend browser acceptance for real search, clear/no results, full-width search and card artwork/fallback dimensions. Confirm missing behavior against baseline build before implementing visuals.
- [x] Implement responsive discovery, artwork loading/error fallback and reusable card; verify API tests, web contracts and rendered discovery at all widths/locales.

## Task 2: Detail, selected lesson and explicit enrollment

**Files:** web `components/courses/course-detail.tsx`, `course-ui.tsx`, `lib/i18n/courses.ts`, `scripts/course-browser-cases.mjs`.

**Interfaces:** EnrollmentButton consumes `course`, `enrolled`, optional `lessonId` and `afterEnroll`; selected lesson must belong to course.lessons. CourseDetail owns demo/locked selection and membership state, keyed to current identity/version. Existing workspace enrollment POST and auth.open protected return retained.

- [x] Add/run failing browser cases for locked-row action/prompt, selected second locked lesson auth-return, account confirmation, no automatic login enrollment, existing-member lesson access, failed/lost acknowledgement retry and rapid clicks.
- [x] Implement hero/lesson actions and focusable enrollment prompt, with one demo at a time. Add account/free confirmation, synchronous submission guard and exact selected lesson destination. Retain useful error/retry feedback and authoritative membership checks.
- [x] Verify anonymous demo/no restricted playback call, sign-in/register return, enrollment success/error/retry, existing enrollment, library visibility and both locales. No new backend enrollment fields or handler changes.

## Task 3: Focused library, persistent learning layout and media lifecycle

**Files:** move the two `app/(workspace)/account/courses/**/page.tsx` files to identical routes under `(learner)`; create `(learner)/layout.tsx`, `components/courses/learner-header.tsx`, `course-learning-layout.tsx`; modify `course-library.tsx`, `course-player.tsx`, `youtube-player.tsx`, `lib/courses/youtube-player.ts` only if required, course-local helpers/messages/tests. Source-route checks updated only where they assume old grouping.

**Interfaces:** same-course learner layout owns authoritative outline read once, under WorkspaceGate with identity/version scope. Client lesson route consumes it; selected playback remains keyed by lesson. Compact header retains existing auth/account/language components. No farm provider or dashboard sidebar mounted on learner routes.

- [x] Add/run failing browser assertions for absent workspace sidebar/farm reads, desktop right curriculum, tablet/mobile ordering, library cards, no redundant same-course outline reads, single player, rapid navigation, late ready after timeout and retry cleanup.
- [x] Implement learner route layout and shared outline ownership; responsive library/player/curriculum. Preserve current lesson, summary and previous/next. Keep authentication on both server middleware and client gate.
- [x] Improve reserved player loading/error presentation and lifecycle without recreating a playing video merely for locale/title updates. Keep bounded API/readiness timers and remove failed frames; retry creates only one player.
- [x] Run learner browser matrix and admin course browser regressions, inspect screenshots, then run full web node regression/style checks and sequential shared/API/web builds.

## Task 4: Review, persistence verification and evidence

- [x] Run real PostgreSQL course tests on a fresh disposable loopback adm3_test database; verify concurrent idempotency, audit rollback, user isolation and safe demo-artwork projection. Do not use configured live DB.
- [x] Perform fresh reviewer pass under requesting-code-review over only this task's diff, with source/spec/plan and dirty-work exclusions. Fix material findings with a regression case and rerun affected checks.
- [x] Re-review final diff, style policy, route protection, admin compatibility, media/request counts and screenshot evidence. Record commands/results, limitations and exact changed-file ownership here. No ROADMAP edits or Git writes.

## Execution evidence

### Navigation follow-up

The user requests Courses first in the navbar. Move its existing entry to the beginning of `apps/web/src/lib/public-navigation.ts`; preserve every other destination/order and existing group behavior. Update the existing order assertions in `scripts/check-public-content.mjs`, run that suite and the style guard, then verify an isolated production build. No API, layout, styling or ROADMAP change is needed.

**Verified:** the updated navigation assertion first failed against the previous Farm management-first order. After moving the shared entry, `test:public-content` passes all 6 tests, `check:styles` passes, the isolated production Next build exits 0, and context/whitespace checks pass. Desktop/mobile consumers use the same ordered groups; footer/no-JavaScript links also follow that shared order. Suggested human-managed commit: `fix(web): place courses first in public navigation`.

Plan prepared from source/contracts before implementation. All authorized local implementation steps are complete; deployed/provider acceptance remains separate.

### Changes and review

- Discovery/details: `apps/web/src/components/courses/course-catalog.tsx`, `course-detail.tsx`, new `course-artwork.tsx`, `course-card.tsx`, `course.styles.ts`; bilingual copy in `apps/web/src/lib/i18n/courses.ts`.
- Enrollment/library/playback: `course-ui.tsx`, `course-library.tsx`, `course-player.tsx`, `youtube-player.tsx`, new `course-learning-layout.tsx` and `learner-header.tsx`. The two old `(workspace)/account/courses/**/page.tsx` files move to identical URLs under `(learner)`, with a new group layout and `[id]/layout.tsx`. Middleware, API enrollment fields and database schema are unchanged by this task.
- API/shared: `apps/api/src/modules/courses/courses.repository.ts`, `courses.service.ts`, and `packages/shared-types/src/validation/youtube-courses.ts` add only optional nullable public-demo artwork. Restricted sources remain stripped. Existing SQL locks, membership/audit relations and admin mutation paths remain unchanged.
- Verification: course API/service/database tests, `apps/web/scripts/check-youtube-courses.mjs`, expanded `course-browser-cases.mjs`, and the browser runner's CDP subscription/provider selector. Documentation: this task, the owning YouTube specification, docs index, client architecture and testing reference. No ROADMAP changes were made for this task; pre-existing recovery/roadmap edits remain preserved.
- Fresh review identified the minimum-height source-loader width overflow and the lost auth guard around Playback. Both were corrected. Browser reproduced the unguarded session-error retention before fixing it; the final regression verifies iframe destruction and restoration. Visual self-review also caught the public width merge and fallback visibility: rendered assertions now verify both. Fresh re-review reports no remaining concrete findings in scope.

### Verification, 2026-10-23

| Check                                                                                                               | Observed result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared-types build, then API build                                                                                  | Both exit 0. Shared distribution built before dependent tests/builds.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Isolated production Next build (`pnpm --filter @vetralink/web exec next build /tmp/vetralink-learner-web-3bftv6rg`) | Exit 0, all routes compile/typecheck. No active workspace `.next` was replaced.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pnpm --filter @vetralink/web check:styles` and all files importing `node:test` under `apps/web/scripts`            | Styling policy passes; 221 tests pass, zero skipped/failures. Includes Tailwind emission/style regressions and course boundary/schema tests.                                                                                                                                                                                                                                                                                                                                                                    |
| Focused `courses` Jest tests with explicit disposable `YTL_TEST_DATABASE_URL`                                       | 2 suites / 14 tests pass, including 5 actual PostgreSQL persistence tests (concurrent membership/audit uniqueness, isolation, denied playback and rollback).                                                                                                                                                                                                                                                                                                                                                    |
| Full API `test --runInBand` with explicit disposable course DB                                                      | 239 suites / 2174 tests pass; 10 suites / 188 tests skipped. Other optional database suites remain opt-in; skipped coverage is not claimed.                                                                                                                                                                                                                                                                                                                                                                     |
| `WORKSPACE_BROWSER_FOCUS=courses` against isolated production Next                                                  | 192 controlled Chrome checks pass across bn/en at 320/768/1440px. Covers search/results/clear/stale response, locked prompt/focus, exact nonfirst lesson auth return, explicit enrollment/lost acknowledgement/duplicate clicks, missing/broken/delayed artwork, responsive widths/layout, source/API/media failures/retry, terminal timeout/late ready, one player, same-course outline reuse, language-preserved video, rapid switching, failed session verification and same-role account/version isolation. |
| `WORKSPACE_BROWSER_FOCUS=admin-courses` against the same build                                                      | 165 existing admin course workspace checks pass. No new admin feature implemented.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Context validator and `git diff --check`                                                                            | 48 context documents / 371 local links / 95 source entries pass; whitespace check passes.                                                                                                                                                                                                                                                                                                                                                                                                                       |

Local log files: `/tmp/learner-courses-{shared-build,api-build,web-build,api-full,db-tests,web-node-final,browser-final,admin-regression,provider,style-final}.log`. Final learner captures are in `/tmp/khamar-workspace-qa-Ng9o1k`; admin captures in `/tmp/khamar-workspace-qa-pUqtRa`. The corrected English desktop catalog, Bengali 320px player and English desktop player were visually inspected; margins, fallback hiding, mobile containment and right-side curriculum are confirmed. Controlled images/video do not prove external media delivery.

The task-owned PostgreSQL 18.6 cluster on loopback port 55438 was started only for disposable `adm3_test`, all current migrations deployed there, tests cleaned their own rows, and the cluster was stopped cleanly. Existing `recovery_test` data was preserved. This does not establish PostgreSQL 16 or configured production deployment parity.

### Provider observation and remaining scope

**Observed real provider behavior:** `WORKSPACE_BROWSER_FOCUS=courses-provider WEB_TEST_BUILD_DIR=/tmp/vetralink-learner-web-3bftv6rg CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` exits 0. The real privacy-enhanced IFrame API reaches onReady for the existing official `M7lc1UVf-VE` sample; an actual CDP mouse click within the visible video starts playback, and currentTime advances over two seconds. The 1440px playback screenshot at `/tmp/khamar-workspace-qa-Lh9Xy0/course-real-provider-1440.png` was visually inspected. API/course/identity remain synthetic; only YouTube is real. Earlier attempts remained in state5/cued with a valid poster and no provider error. Waiting for settled visible coordinates made the actual-click check pass; this supports an automation input-timing explanation rather than a provider diagnosis. No production workaround, autoplay or permission broadening was added. Production origin, team-owned veterinary content, physical devices/other browser engines and real-user enrollment remain release acceptance items. No production content writes, database migration, deployment, Git staging/commit/merge/push or live enrollment was performed.

User additionally requested a notification-description display fix without identifying a screen or symptom. The only notification-history implementation found deliberately uses safe evidence without message bodies. A concise clarification is pending; no speculative notification/body/API change was made.

Suggested human-managed commit: `feat(courses): complete public discovery and focused learner experience`.

## Public catalog four-column layout — 2026-10-30

User requested four public course cards per desktop row. Confirmed from code: the catalog shared a one/two/three-column utility with the private library. Add a public-only `catalogGrid` (one column below 768px, two from 768px, four from 1280px) and pass it to catalog loading placeholders through the existing loading component. Private library layout, API, access and course data remain unchanged.

- [x] Inspect catalog/card/loading consumers and existing layout contract.
- [x] Implement the scoped Tailwind composition and update the requirement.
- [x] Check actual desktop/tablet/mobile columns and rendered card sizing, styling policy, production build and final diff.

**Observed browser evidence:** `node /tmp/vetralink-catalog-four.mjs` passed against the running localhost web. The browser received eight temporary render-only cards derived from one public course; no accounts/content were created. Verified computed columns and row geometry at 1440px (four), 768px (two) and 320px (one), with no horizontal overflow. Inspected `/tmp/vetralink-catalog-four-1440.png`; cards align in two rows of four with readable titles/actions. Tablet/mobile captures use the corresponding filename widths. This verifies controlled browser layout, not additional live course inventory.

`pnpm --filter @vetralink/web check:styles` passed; `test:styles` passed 14 tests (`/tmp/vetralink-catalog-four-styles.log`). Source self-review confirmed only public catalog/loading classes change; default loading and private library consumers retain their original grid.

The isolated production build `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-course-confirmation/web` passed (`/tmp/vetralink-catalog-four-build.log`). Context validation and `git diff --check` passed. Final scoped self-review found no material issue. Earlier hover/login work was preserved. Suggested commit: `style(web): show four public course cards per desktop row`.
