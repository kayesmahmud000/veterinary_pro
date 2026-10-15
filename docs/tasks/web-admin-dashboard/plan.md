# ADM-1 implementation plan

> Execute inline with the executing-plans and test-driven-development skills. Track evidence here. Repository instructions preserve human-managed Git and authorize routine implementation without new approval gates.

**Goal:** deliver the first admin dashboard and navigation slice from the user's roadmap.
**Architecture:** reuse AuthProvider/WorkspaceShell; enforce active role in middleware and the fixed cookie BFF; isolate dashboard copy and UI while consuming existing count/review APIs.
**Tech stack:** existing Next.js 14, React 18, TypeScript, Tailwind 3, Lucide and Zod.
**Spec:** [spec.md](spec.md).

## Constraints and review focus

Bangla/English, full-width shell, 1024px drawer, sidebar account footer, no currency assumptions or unreleased routes. Preserve protected returns, refresh ownership, learner/Farmer behavior, role-review/privileged-access rules, and existing edits. Verify forged/demoted sessions, changed-account stale data, partial upstream failure, valid zero counts and wrong-role direct URLs. No dependency, API persistence or deployment changes.

Ruling: continue in the user's current `dev-fontend` checkout to preserve the uncommitted approved roadmap and IDE workflow; isolate production builds under `/tmp`. Git staging/commits/merges/pushes remain human-managed. The approved roadmap and execution request establish the design scope; this spec resolves implementation details within that scope.

## Task 1: entry and server authorization

Files: `src/lib/workspace/navigation.ts`, `src/lib/auth/route-session.ts`, `src/middleware.ts`, `src/components/workspace/dashboard-home.tsx`; existing navigation/protected-route tests.

Produces: active backend identity lookup plus retained `checkProtectedAccess` compatibility; exact admin-path role predicate; role-specific default/return routing and released `/admin`/`/admin/dashboard` destinations.

- [x] Update navigation/middleware tests for both administrative roles, denial, Super-only route, legacy dashboard redirect, authorized returns and forbidden role returns; run and observe expected failures.
- [x] Implement policy/identity/middleware checks and reactive common-dashboard redirect; rerun navigation/protected-route tests.
- [x] Review no-refresh behavior, private response headers, missing/invalid identity and absence of redirect loops.

## Task 2: administrative BFF and count projection

Files: `src/lib/workspace/contracts.ts`, `server.ts`, `scripts/check-admin-dashboard.mjs`, existing `check-workspace.mjs`.

Consumes: existing schemas/session cookie and fixed upstream configuration. Produces: `adminOverviewSchema` and GET `admin/overview`, plus current-role preflight on all admin mappings.

- [x] Add tests exercising actual handleWorkspace for count-only output, wrong/changed/inactive roles, Super-only access, malformed/negative counts, upstream errors, strict queries/methods and cookie/header privacy; observe failures.
- [x] Implement schemas/mapping/current-role preflight, adjust existing upstream fixtures to answer auth/me, and pass new plus existing boundary tests.

## Task 3: bilingual dashboard and navigation

Files: new `src/lib/i18n/admin.ts`, `src/components/workspace/admin-dashboard.tsx`, `(workspace)/admin/page.tsx`, `admin/dashboard/page.tsx`; navigation/shell copy and public account menu.

Consumes: Task 1 role/entry functions and Task 2 overview projection plus existing reviewQueueSchema/useRemote. Produces: functional released route and admin-specific sidebar groups with shared footer.

- [x] Extend controlled browser fixtures/assertions for admin landing, section data/error/zero/empty/retry, permissions/demotion, public menu destination and responsive navigation. Run against pre-feature build to observe a missing admin-route failure.
- [x] Implement independent overview/recent-application sections with accessible cards, dates, retry, links and role-gated UI; add new page compositions and navigation groups.
- [x] Build in an isolated temporary copy and pass controlled dashboard/auth/browser regressions; inspect desktop/mobile screenshots and resolve findings.

## Task 4: review, regression and handoff

- [x] Fresh whole-change review of spec, authorization, identity/cache isolation, UI, routes and existing admin flows; fix material in-scope findings with regression coverage.
- [x] Run relevant unit/style checks and final isolated build/browser checks after final code changes. Attempt real isolated API/database availability, preserving user data.
- [x] Update roadmap/context/spec status and evidence; validate links/whitespace and inspect Git diff. Report results, limits and a suggested conventional commit.

## Execution ledger

2026-10-13: source/context/roadmap reviewed; current branch `dev-fontend`, earlier roadmap edits preserved. Pre-flight interfaces: middleware identity drives role policy; BFF validates identity independently; UI consumes only validated count/review projections. Currency and broad admin modules remain excluded per ADM-1 roadmap. No shared-interface conflict found.


### Implementation and verification — 2026-10-13

- Task 1: navigation and protected-route regressions failed against the old defaults/role admission, then passed with current-identity middleware, administrative landing/return policy and role-specific navigation. Missing identity still uses the existing no-refresh Home handoff; signed-in denial redirects without a sign-in loop.
- Task 2: the new BFF tests failed against the missing endpoint and role checks, then passed with strict count projection and active-role preflight for every admin mapping. Existing workspace fixtures were updated to answer the added identity lookup. Final direct admin run: **22/22 tests passed**.
- Task 3: browser RED against the pre-feature isolated build returned **404** for `/admin/dashboard`. New overview and navigation passed the controlled browser suite. An initial test selector was corrected from nonexistent `#target-email` to the existing `#email`; product access-page behavior was already correct.
- Task 4: independent reviewer inspected working-tree changes and new files. One material finding, Zod accepting an unparseable timestamp offset, was reproduced by a failing BFF test (200 instead of 502), fixed with finite `Date.parse` validation, and passed at **22/22**. No material implementation findings remain.

| Verification | Observed result and evidence |
| --- | --- |
| Admin, workspace, navigation, protected routes, auth, API diagnostics, farm overview and two style test scripts | All **9 script suites passed**, no skips; `pnpm --filter @vetralink/web exec node --test scripts/check-admin-dashboard.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-auth.mjs scripts/check-api-diagnostics.mjs scripts/check-farm-overview.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`; `/tmp/admin-final-tests.log` |
| Tailwind policy | `pnpm --filter @vetralink/web check:styles` passed |
| Isolated production build | `pnpm exec next build /tmp/web-admin-dashboard-g54d1t4o` from apps/web passed after final source change; `/tmp/admin-final-build.log`. Temporary copy uses existing dependencies and cpus=2; no environment files copied, active `.next` untouched |
| Dashboard browser | Final **132 checks passed**, including malformed-date recovery, `/tmp/admin-final-browser.log`; screenshots `/tmp/khamar-workspace-qa-u4wlC5`. Command: `WEB_TEST_BUILD_DIR=/tmp/web-admin-dashboard-g54d1t4o pnpm --filter @vetralink/web test:dashboard:browser` |
| Auth and public localization regression | `WEB_TEST_BUILD_DIR=/tmp/web-admin-dashboard-g54d1t4o pnpm --filter @vetralink/web test:auth:browser` passed: both languages/320–1440px, modal/session/cross-tab behavior, **80 localized GETs, 60 language submissions**, persistence/isolation, unsafe URLs, catalog and CSV checks; `/tmp/admin-auth-browser.log` |
| Visual review | Inspected `/tmp/khamar-workspace-qa-YiljSA/admin-SUPER_ADMIN-en-1440.png` and `admin-ADMIN-bn-320.png`; readable cards, mobile stacking, one active sidebar entry and shared account footer. Automated checks covered both roles/locales at 320/375/768/1024/1440px, no horizontal overflow, drawer Escape and one main/H1 |
| Isolated live infrastructure | After sandbox EPERM, authorized outside-sandbox probes returned **ECONNREFUSED** for PostgreSQL 55432, Redis 56379 and API 3311. Real workspace/database browser acceptance could not run. No live/deployed/provider acceptance claim |

Browser processes and fixtures use only synthetic data and local controlled upstream responses. Local screenshots/logs are verification artifacts, not deployment evidence. No migrations, real-data writes, dependency changes, Git staging/commits/merges/pushes or deployment occurred.

Final review: fresh independent review under requesting-code-review; final source and regression results checked by implementer. Minor deferred: dedicated browser races for same-role account-id/version changes while requests are pending; keyed WorkspaceGate/useRemote cleanup reviewed in source, while role demotion and logout/Back are directly exercised.

Review scope rulings: ADM-2–9/milk remain out of this slice per roadmap; live readiness stays unverified because services are unavailable; final docs/build and screenshots are verified by the implementer. The cost of these evidence limits is that broader administration, deployment and additional account-race acceptance cannot be inferred from ADM-1 results. The current-checkout ruling preserves user changes and relies on human review/integration of the uncommitted diff.

Next authorized handoff when selected: ADM-2 API-ADMIN-U/A contract design and implementation before publishing directory/audit navigation. Suggested commit: `feat(web): add admin dashboard and role-based navigation`.

Final documentation verification: context validator passed **48 documents / 321 links / 95 source entries**; changed/new Markdown validator passed **11 documents / 312 local links/anchors**; `git diff --check` passed. Final build and browser processes exited 0. Work retained in the current checkout under the human-managed Git policy.
