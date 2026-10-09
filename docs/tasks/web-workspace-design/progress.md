# Execution ledger — plan: docs/tasks/web-workspace-design/plan.md

Started 2026-10-08 from 582d813 on the user's main checkout; baseline working tree clean.

Scope: implement Tasks 1–6 (shared dashboard/profile and Farmer foundation/registry). Later domain handoffs remain separate plans, as specified. Existing session, setup and role/admin contracts are preserved.

Current status: Tasks 1–6 implemented and locally verified. Live PostgreSQL/Redis/API acceptance remains pending because the isolated services are unavailable. Entries below retain the execution history.

## Full-width workspace follow-up — 2026-10-09

See also the later [protected-entry follow-up](#protected-entry-follow-up--2026-10-09).

See the later [learner navigation follow-up](#learner-navigation-follow-up--2026-10-09) for the updated login/profile behavior.

- Confirmed from code: all dashboard/profile/account/admin/farm routes inherit `(workspace)/layout.tsx`. Updated the shared shell/header from `w-11/12` to `w-full`, balanced desktop sidebar padding and aligned header/content gutters at 16/24/32px. Public containers retain their existing width. No API, identity, permission or persistence changes.
- Checks passed: `pnpm --filter @vetralink/web check:styles`; `pnpm --filter @vetralink/web test:styles` (2/2); isolated production build via `pnpm exec next build /tmp/web-full-width-xysqxdc3` from `apps/web` (including TypeScript); `WEB_TEST_BUILD_DIR=/tmp/web-full-width-xysqxdc3 pnpm --filter @vetralink/web test:dashboard:browser` (64 checks). Browser execution required approved escalation after sandbox localhost binding returned EPERM.
- Observed behavior: 40 responsive screenshots cover dashboard/profile/farm/register in bn/en at 320/375/768/1024/1440px without horizontal overflow. Visually reviewed desktop dashboard and 320px profile snapshots at `/tmp/khamar-workspace-qa-vVoKWO`. This is controlled-upstream Chrome evidence, not live database/provider acceptance.
- Self-review and final re-review found no remaining in-scope issues; shared layout coverage and docs were reconciled. No new tests were added for this reversible utility-only adjustment. Suggested commit: `fix(web): use full width for workspace routes`.

## Learner navigation follow-up — 2026-10-09

- User scope: LEARNER login/signup defaults to public home; other ready roles retain Dashboard. Learners have direct Profile access and no Dashboard navigation. User explicitly deferred enrolled-course links to the enrollment feature; no enrollment pages or placeholder routes were added.
- Confirmed from code: shared navigation preserves mandatory Farmer setup and validated protected profile/application returns, discards learner dashboard returns, and omits learner Dashboard items. Public learner account controls link directly to Profile; both account menus and workspace breadcrumbs respect the learner entry. Direct learner `/dashboard` visits replace the URL with `/account/profile` without mounting the overview.
- Navigation tests observed RED for the old `/dashboard` learner default and dashboard navigation, then GREEN (4/4) after implementation. Checks passed: `pnpm --filter @vetralink/web check:styles`, `test:styles` (2/2), `test:auth`, `test:workspace` and `test:workspace-navigation`.
- Isolated production build passed via `pnpm exec next build /tmp/web-learner-nav-xvj1b40j` from `apps/web`, including TypeScript. Approved local Chrome acceptance via `WEB_TEST_BUILD_DIR=/tmp/web-learner-nav-xvj1b40j pnpm --filter @vetralink/web test:dashboard:browser` passed **68 checks**, including learner login and default-role signup in bn/en, direct Profile links, hidden Dashboard shortcuts, dashboard-to-profile redirect, all other role views, protected returns, setup precedence and existing responsive/farm/registry regressions. Screenshot directory: `/tmp/khamar-workspace-qa-S2uMUb`.
- Self-review/re-review: no remaining in-scope findings; no auth/API/storage/tenant contract changes. Evidence uses a controlled HTTP upstream and Chrome, not live provider/database or alternate-browser acceptance. Suggested commit: `fix(web): keep learners on home after authentication`.

## Protected-entry follow-up — 2026-10-09

- User outcome: signed-out protected visits automatically open Sign in after session restoration. Close, Escape and backdrop dismissal redirect Home; successful login resumes the validated route with existing setup/role precedence. Login/register switching preserves protected-entry state. Failed login stays open; pending requests retain existing dismissal protection. Public dialogs still dismiss on the current page.
- Implementation: `WorkspaceGate` prompts once per signed-out route; provider state carries an explicit protected-entry flag; `AuthDialog` uses one dismissal handler. Header/fallback protected login callers also set the flag. No endpoint, cookie/token, permission or persistence contract changed.
- RED observed against `/tmp/web-learner-nav-xvj1b40j`: `Automatic protected sign in bn close` timed out with only the old inline login card. During review/browser acceptance, explicit logout exposed a race: the departing protected page reopened login after identity cleared. Provider now clears protected-entry prompts on Home; the regression passes. The session-failure fixture was corrected to supply an access cookie, because no-cookie session checks correctly return signed-out locally without an upstream call.
- Final checks passed: `pnpm --filter @vetralink/web check:styles`, `test:styles` (2/2), `test:auth`, `test:workspace`, `test:workspace-navigation`; isolated production build via `pnpm exec next build /tmp/web-protected-entry-5fujee_k` from `apps/web`, including TypeScript. Style/auth/navigation checks were repeated after the logout fix.
- Final approved local Chrome run: `WEB_TEST_BUILD_DIR=/tmp/web-protected-entry-5fujee_k pnpm --filter @vetralink/web test:dashboard:browser` passed **79 checks**, including bn/en automatic prompts, Close/Escape/backdrop and register-mode dismissal, session-failure Retry, failed-login retention, query-preserving successful login, public dismissal, explicit logout and existing learner/other-role/responsive/farm/registry behavior. Screenshots: `/tmp/khamar-workspace-qa-IkCnjO`; the equivalent Bangla protected-entry snapshot from `/tmp/khamar-workspace-qa-PRh7uL/protected-entry-bn.png` was visually reviewed.
- Final self-review/re-review found no remaining in-scope issues. Evidence is controlled-upstream Chrome acceptance, not live provider/database or alternate-browser certification. Suggested commit: `fix(web): require sign in on protected route entry`.

Ruling: use the current checkout and a sibling tracked ledger — the approved plan and repository policy preserve human-managed Git; do not create branches, commit or delete execution history. Builds/browser profiles use temporary isolated directories. Cost: changes share the user's checkout, so inspect/preserve concurrent changes.

Pre-flight: Tasks 1 → 2/3 share normalized navigation/return policy; Task 2 owns shell without main, each page owns main. Tasks 4 → 5/6 share validated route farm context and membership projection. Task 5 → 6 shares animal projection; mutations remain separately allowlisted. No interface conflict found.

Baseline: real source auth checks 12/12, workspace boundary 11/11, public content/navigation 6/6 pass. These are local unit/boundary checks, not live provider acceptance.

Task 1: complete — four policy tests observed RED for missing helpers, then GREEN 4/4. Exact role entries, inactive identity denial, required setup and local return normalization verified.

Task 2/3: in progress — controlled-upstream browser scenarios written before UI implementation.

### Tasks 2–3
- Shared shell/gate and localized dashboard/read-only profile implemented; explicit auth now routes with protected return context. Existing public session restore remains in place.
- Isolated production build passed; auth/workspace/navigation checks passed; controlled-upstream browser acceptance passed 22 checks across six roles, bn/en and widths 320–1440. Screenshots `/tmp/khamar-workspace-qa-7mGvzu`. Two harness waits were corrected (boolean DOM result and intentional setup redirect); no profile runtime defect.
- Ruling: component shell receives existing localized Messages rather than duplicating server catalog resolution — avoids client/server locale drift.

### Task 4 in progress
- Browser farm cases observed RED on missing canonical routes. Route-authoritative provider, professional membership discovery and extracted member management implemented. Generic remote hook now hides stale data immediately when its requested path changes.
- Task 5 boundary tests observed RED 0/6 before adding scoped read mappings.
- Ruling: subscription read endpoints currently only apply JwtAuthGuard, without membership — BFF must positively verify farms/my before these reads; this closes exposure in the new web boundary without claiming a backend permission repair.
- Ruling: API milk/finance date buckets use UTC; show labeled UTC reporting periods alongside Asia/Dhaka local date, rather than call them local-day totals.
- Live isolated database tooling: docker command absent; do not reset or load caller .env. Further local service probes pending.

### Tasks 4–5 evidence
- Task 4 controlled browser acceptance passed 31 checks, including FARMER/BUYER/VET positive membership, A→B delayed member response isolation, revoked membership and LEARNER denial; isolated build passed.
- Task 5 unit tests passed 8/8: fixed scoped reads, schema/tenant/query validation, subscription membership preflight, real-zero/empty projection, parallel GETs and lock-protected 401 refresh. Parallel-read test observed RED (one request started) then GREEN (two).
- Isolated live services unavailable: ports 55432, 56379, 3311 returned ECONNREFUSED outside sandbox and docker is absent; live database browser acceptance cannot run here. Controlled HTTP/browser fixtures are explicitly separate evidence.
- Registry spec/plan written; registry body/mapping tests observed RED 2 new failures before implementation.

### Task 6 in progress
- Isolated registry build passed; body/route tests passed 11/11, including native empty All filters (RED then GREEN). Browser creation successfully normalized a lowercase tag; corrected the fixture expectation to uppercase, consistent with API.
- Ruling: animal controller does not apply SubscriptionReadOnlyGuard (only consultation does); add membership + access-status preflight to web animal/member mutations so crafted BFF writes also fail closed. Backend authorization/quota remains authoritative and backend-wide access gaps remain separately owned. New read-only mutation test observed RED before preflight.

### Final review and local acceptance — Tasks 1–6

- Fresh whole-change review found same-identity auth revalidation unmounting drafts, full-snapshot PATCH overwriting unrelated fields, dirty navigation bypasses and a missing protected-return query. Fixed all four: keep authorized drafts mounted but hidden during revalidation, submit changed fields only, guard links/history/farm selection, and retain the query when opening login. The live browser fixture now seeds an actual active subscription before exercising enabled member writes; that fixture remains unrun here.
- Draft revalidation and partial-edit cases observed RED before their fixes and GREEN afterward. Back cancellation also observed RED: Window target listeners execute in registration order, so a late capture listener ran after Next restored the route. A root layout-effect listener now dispatches the active farm guard before Next's passive router listener. Cancellation preserves form state; confirmation allows navigation. Chrome acceptance covers both Navigation API indices and an emulated API-unavailable fallback. The fallback restores the source with pushState, which can truncate forward history; it does not persist drafts.
- Final controlled-upstream Chrome suite: **64 checks passed**, covering all six role dashboard/profile identities, protected/public login routing, setup priority, professional farm membership, cross-farm delayed response isolation, membership revocation, separate empty/zero/error cards, bilingual animal create/detail/partial-edit, duplicate-submit protection, rejection retaining inputs, query-preserving pagination/Back, dirty exit cancellation/confirmation and read-only/quota denial.
- Responsive snapshots: **40 screenshots**, dashboard/profile/overview/register in bn/en at 320, 375, 768, 1024 and 1440px. Drawer focus, Escape, route and resize dismissal; account Enter/Escape; active gold text with transparent background; long-name/missing-phone/verification fallbacks; and 720 CSS pixels at DPR 2 for 200% zoom-equivalent reflow passed. Screenshots: `/tmp/khamar-workspace-qa-UlK1mH`; representative desktop/mobile views visually reviewed. Native browser zoom and alternate-browser/device acceptance remain unverified.
- Final auth browser regression passed bn/en responsive forms, identity/payload/cookie checks, reload/cross-tab rotation/logout, expiry and failure/retry. Its localization child passed **80 localized GETs, 60 language-form submissions**, return isolation, unsafe URL cases, catalog filters and localized CSV/template checks. Screenshots: `/tmp/vetralink-auth-qa-jnKNtY`. Both browser suites use controlled HTTP fixtures, not real providers or a live database.
- Direct source checks: **auth 12/12, existing workspace 11/11, navigation 4/4, farm boundary/projection/registry 14/14 and public content 6/6 passed**. Tailwind policy and style suites passed. Fresh isolated production build (including TypeScript) passed at `/tmp/web-workspace-final-build`; the user's `.next` was preserved. Documentation validation passed 48 context documents, 306 links and 95 source entries, plus 131 task/registry/roadmap links; `git diff --check` passed.
- Harness corrections: Enter dispatch now includes its native character event; legacy-navigation setup returns a serializable value to CDP. These were test-driver failures, not product changes. Temporary product/browser diagnostic logging was removed.
- Live integration limit: PostgreSQL 55432, Redis 56379 and API 3311 refuse connections; docker is absent. Existing live onboarding/member/admin and new two-farm registry acceptance therefore remain pending, with no database reset, secret environment read or provider claim. No Git staging/commit/branch/merge/push was performed. Suggested commit: `feat(web): add account dashboard and farmer workspace`.
