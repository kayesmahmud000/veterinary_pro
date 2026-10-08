# Execution ledger — plan: docs/tasks/web-workspace-design/plan.md

Started 2026-10-08 from 582d813 on the user's main checkout; baseline working tree clean.

Scope: implement Tasks 1–6 (shared dashboard/profile and Farmer foundation/registry). Later domain handoffs remain separate plans, as specified. Existing session, setup and role/admin contracts are preserved.

Current status: Tasks 1–6 implemented and locally verified. Live PostgreSQL/Redis/API acceptance remains pending because the isolated services are unavailable. Entries below retain the execution history.

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
