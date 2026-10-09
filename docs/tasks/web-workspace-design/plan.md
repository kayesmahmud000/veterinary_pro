# Post-login Workspace Implementation Plan

> **For agentic workers:** use `executing-plans` for sequential implementation in the current workflow; `subagent-driven-development` is an alternative only if selected by the user. Follow tasks in order, with Code Reviewer + QA and UI Reviewer self-review after each deliverable. Repository Git operations remain human-managed.

**Goal:** deliver the common dashboard/read-only profile first, then the Farmer workspace in independently testable domain batches.  
**Architecture:** preserve root AuthProvider and the allowlisted cookie BFF. Replace only the authenticated layout with a shared localized shell; route-specific gates and farm membership remain separate. Keep page composition, navigation rules and domain data in focused files.  
**Tech stack:** existing Next.js 14, React 18, TypeScript, Tailwind 3, Lucide, Zod and local shadcn-style primitives; no stack upgrade.  
**Spec:** [spec.md](spec.md).  
**Status:** Tasks 1–6 implemented locally; **live isolated API/database acceptance remains pending**. See [execution ledger](progress.md) for current checks and review fixes.

## Global constraints

- User-selected order: common dashboard/profile → Farmer workspace. Preserve all unrelated edits and current route/locale/session compatibility.
- Bangla default with complete English; full-width workspace outer container (user update 2026-10-09), Tailwind-only styling, 44px controls, one main/H1 per page and private noindex/no-store responses.
- Active nav changes text to `#a26913`; no active background/underline. Application drawer breakpoint 1024px; public header retains 1280px.
- One primary UserRole. FarmRole and entitlement are independent authorization dimensions. No role-switch control or UI-granted permission.
- Reuse existing allowlist/session lock/refresh and error mapping. Never proxy arbitrary API URLs or put tokens/PII in browser persistent storage.
- No fake operational metrics, general notification inbox, course-progress percentage, offline save, public vet publication or profile edit without its owning contract.
- No automatic staging/commits, deployment, migration or unrelated package upgrades. Suggest a conventional commit for each reviewed batch.

## Review focus

2026-10-09 width follow-up: replace the shared shell/header `w-11/12` with `w-full`, add responsive horizontal padding and balance sidebar padding. Review all workspace routes through their shared layout; run style checks, production build and the controlled dashboard/profile responsive browser suite. No API, persistence, auth or tenant-contract changes. Verification results are recorded in [progress.md](progress.md).

1. Restored session versus explicit login: public browsing stays in place; setup and protected return paths get deterministic precedence (Task 1/3).
2. Direct URLs and changed roles: generic shell access cannot expose private page/actions; a revoked membership invalidates the selected farm (Task 1/2/4).
3. Rapid farm/account switching: a slow old response and dirty form must not enter the new context (Task 4/5).
4. Missing/malformed metrics: no zero for failed reads, no first-page count presented as total, no financial net-profit/income confusion (Task 5 and domain handoffs).
5. Long Bangla names, 320px width, keyboard drawer/account menu and zoom: usable focus, wrapping and landmarks (Task 2/3 and final acceptance).

## Stage A — common dashboard/profile

### Task 1: entry and navigation policy

**Create:** `apps/web/src/lib/workspace/navigation.ts`, `apps/web/scripts/check-workspace-navigation.mjs`.  
**Inspect:** shared roles/authUserSchema, current `workspace.tsx`, `auth-dialog.tsx`, and existing auth/workspace tests.  
**Interfaces produced:**

- `getPostLoginDestination(user: AuthUserSummary, returnTo?: string): string` — required Farmer setup → validated released workspace destination → `/dashboard`.
- `getWorkspaceNav(user: AuthUserSummary, locale: Locale): readonly WorkspaceNavItem[]`; `WorkspaceNavItem = { label: string; href: string }`. Only released routes appear. Farm operation permissions are not inferred here.
- `validateWorkspaceReturnTo(value: string | undefined): string | null` — normalization/allowlist rules from the spec; return-path parameters never authorize access.

- [x] Write policy cases first: all six ready roles → `/dashboard`; FARMER with required setup and a valid return path → `/account/farm-onboarding`; `/account/profile?section=access` accepted; `https://evil.test`, `//evil.test`, backslash/encoded-backslash forms, `/api/auth/logout` and unknown routes rejected. Undefined/malformed identity must never fall through to a privileged role.
- [x] Run `node apps/web/scripts/check-workspace-navigation.mjs`; confirm new policy assertions fail before implementation.
- [x] Implement the pure functions with exact UserRole allowlists and a released route inventory. Preserve existing own-history, LEARNER-only application, ADMIN/SUPER review and SUPER-only access entries.
- [x] Re-run the policy checks; require zero failures. Review routing versus real backend permission ownership before Task 2.

### Task 2: shared authenticated shell

**Create:** `components/workspace/workspace-shell.tsx`, `workspace-header.tsx`, `workspace-navigation.tsx`, `workspace-gate.tsx` under `apps/web/src/`; `lib/i18n/workspace-shell.ts`.  
**Modify:** `(workspace)/layout.tsx`, `components/workspace/workspace.tsx`, `workspace.styles.ts`; extend existing `check-workspace-browser.mjs`.  
**Interface:** `WorkspaceShell({ locale, children }: { locale: Locale; children: ReactNode })` supplies navigation/header but no main; each page owns its main/H1. `WorkspaceGate({ allowedRoles?, requireFarmerSetupComplete?, children })` consumes `useAuth`, handles checking/error/login/denial and suppresses protected children. Backend checks still authorize data/mutations.

- [x] Add browser assertions for a desktop shell, 1024px drawer boundary, 320px wrapping, one main/H1, skip link, active text with transparent background, drawer Escape/focus return/path/resize dismissal and account menu keyboard behavior in both locales.
- [x] Replace the marketing header only inside `(workspace)/layout.tsx`. Reuse SiteBrand/LanguageSwitcher/root AuthProvider; keep public marketing layout and modal entry working.
- [x] Remove duplicated page navigation from existing Workspace without losing its current view gates and action links. Shared gate extraction must preserve existing denial and setup redirects.
- [x] Use simple native dialog/drawer and existing primitives first; add a Radix primitive only if an interaction needs it. No generated CSS theme reset, local styles or new state/query framework.
- [x] Run style guard/suites and production build; browser cases must pass. Re-review all current farm/application/admin pages before proceeding.

### Task 3: common dashboard, read-only profile and explicit login routing

**Create:** `(workspace)/dashboard/page.tsx`, `(workspace)/account/profile/page.tsx`, `components/workspace/dashboard-home.tsx`, `account-profile.tsx`, `lib/i18n/account.ts` under `apps/web/src/`.  
**Modify:** `components/auth/auth-dialog.tsx`, `auth-provider.tsx` only if protected return context needs a narrow typed extension, and existing `check-auth-browser.mjs`/`check-workspace-browser.mjs`.  
**Consumes:** Task 1 routing/nav policy, Task 2 shell/gate and current sanitized `useAuth().user`.  
**Produces:** working `/dashboard` and `/account/profile?section=details|access|preferences`, localized metadata and protected-login return behavior. No new backend endpoint.

- [x] Add behavioral cases: each role sees its real applicable destinations; profile shows maskedPhone rather than raw phone; missing phone/avatar have named fallbacks; unknown profile section → details; email verification flag rendered accurately; role is read-only; no save/reset/resend control exists without a working contract.
- [x] Add auth cases: explicit ready-account login → `/dashboard`; incomplete Farmer → setup; protected-page login resumes local destination; restored public session stays on the public URL; forbidden return path still denied; signout/role change clears previous identity content. Keep existing phone-picker/role/register/session tests.
- [x] Implement the real-data initial cards from spec; use free learning/help/public doctors and existing applications/admin/farm destinations. Do not fetch future order/course/clinical metrics.
- [x] Profile uses normal section links and existing locale action/logout; account modal gains Dashboard/Profile links. Keep email/contact masked fields read-only, initials avatar fallback and no editable role selector.
- [x] Connect successful auth to Task 1 destination while preserving optional protected-return context and Farmer onboarding behavior. Completing setup still reaches `/farm`.
- [x] Run auth/workspace/navigation checks, style/build and real Chrome with a controlled upstream. Record snapshots for both locales at 320, 375, 768, 1024 and 1440px, plus keyboard, 200% zoom-equivalent reflow and API error/session-expiry states. Native browser zoom and live database acceptance remain unverified.
- [x] Review and update auth/role specs and web roadmap with **actual** Stage A evidence; preserve all historical checks. Stage A is releasable independently of Stage B.

## Stage B — Farmer workspace foundation

### Task 4: route-bound farm context and membership transition

**Create:** `(workspace)/app/farms/[farmId]/page.tsx`, `(workspace)/app/farms/[farmId]/members/page.tsx`, `components/workspace/farm-context.tsx`, `farm-members.tsx`, `lib/workspace/farm-navigation.ts`.  
**Modify:** existing `farm-workspace.tsx`, workspace navigation/contracts and browser checks; keep `/farm` and mandatory onboarding URLs.  
**Interfaces:** `FarmMembershipProjection = z.infer<typeof farmOnboardingStatusSchema>["farms"][number]`; `FarmContextValue = { farmId: string; farm: FarmMembershipProjection }`. Provider value is present only after authorized discovery confirms the route farm; unknown/denied state has no selected-farm data. `getFarmWorkspaceNav(farm: FarmMembershipProjection, locale: Locale): readonly WorkspaceNavItem[]` composes released farm destinations with Task 1's common navigation; a primary role alone is not its input.

- [x] First test A → B while a delayed A response is outstanding; B never renders A members/KPIs. Test removal of membership, malformed UUID, denied direct link and no-membership result. Test non-FARMER professional membership allowed by API and LEARNER denial.
- [x] Move existing email member management into the new members destination with the same FarmRole/quota/OWNER-assignment checks and shared schemas. Existing `/farm` actions must remain usable until the new route passes regressions.
- [x] Make selected route farm authoritative and all context changes clear errors/forms/results; add dirty-form confirmation before switching if an in-scope form is unsaved. Use current backend `farms/my`; do not add an arbitrary-ID switcher or invitation endpoint.
- [x] On the common dashboard, load existing authorized farm discovery for eligible professional accounts and show a farm entry only after positive membership; BUYER/VET members open the canonical selected-farm route, rather than the old FARMER-only `/farm` view. Keep default role landing and mandatory FARMER setup unchanged.
- [x] After real membership/browser checks pass, `/farm` becomes the discovery/selection entry leading to the selected overview; maintain old entry links and setup completion destination.
- [ ] Re-run existing isolated onboarding/member/admin acceptance; record exact primary-role/member combinations tested. Release without operational cards if Task 5 is pending.

### Task 5: farm overview card read boundary

**Create:** `lib/workspace/farm-contracts.ts`, `farm-data.ts`, `components/workspace/farm-overview.tsx`, `scripts/check-farm-overview.mjs`.  
**Modify:** the fixed resolver/error handling in `lib/workspace/server.ts`, contracts/client only for the scoped additions, and `scripts/check-workspace.mjs`.  
**Interface:** `FarmOverviewCard<T> = { state: 'loading' | 'ready' | 'empty' | 'denied' | 'error'; data?: T; code?: string }`; separate validated cards with context `(user.id, roleVersion, farmId, query)` rather than a singleton dashboard cache.

Proposed BFF GET mappings, each with a UUID `farmId` in its allowlisted path:

| Web workspace path | Existing upstream | Response source |
| --- | --- | --- |
| `farms/:farmId/animals` | `animals` plus strict animal query and validated `x-farm-id` | [PaginatedAnimalsDto](../../../packages/shared-types/src/dto/animals/animal-response.dto.ts) |
| `farms/:farmId/milk/analytics` | `milk-logs/analytics` plus strict date/entryType query and tenant header | [MilkYieldAnalyticsResponseDto](../../../packages/shared-types/src/dto/milk-logs/milk-yield-analytics.dto.ts) |
| `farms/:farmId/vaccinations/schedule` | `clinical-health/vaccinations/schedule` plus daysAhead/asOfDate and tenant header | [VaccineScheduleSummaryDto](../../../packages/shared-types/src/dto/clinical-health/vaccine-schedule-summary.dto.ts) |
| `farms/:farmId/finance/summary` | `financial/profit-loss/summary` plus strict period query and tenant header | [ProfitLossSummaryKpiDto](../../../packages/shared-types/src/dto/financial/profit-loss-response.dto.ts) |
| `farms/:farmId/access-status`, `farms/:farmId/quota` | `subscriptions/farm/:farmId/access-status`, `/quota` | Shared subscription access/quota DTOs |

- [x] Test route/method allowlisting, UUID/query validation, same-origin boundary, cookie-only authorization, returned schema validation, `x-farm-id` forwarding, 401 refresh and denied/partial reads. No browser token/header override.
- [x] Test projections: animal `meta.total=120` with one item → 120; no milk records → “No entry today”; legitimate recorded zero → 0 liters; malformed/failed card → error, not zero; API netProfit/currency/date range used without inventing totals. A slow old-farm response is ignored.
- [x] Implement those GET-only mappings and minimal schema-derived card projections. Fetch independent cards concurrently, honor actual query bounds, and keep every response private/no-store. Any cache must be isolated by user/role/farm; none is required initially.
- [x] Show the API's actual UTC business-date/window explicitly alongside the Asia/Dhaka local date. Resolve the aggregation mismatch without labeling UTC buckets as local-day totals.
- [x] On non-dairy farms, hide milk cards. Render access status accurately; unavailable or denied subscription reads do not unlock writes. Charts/quick actions stay absent until their actual domain routes ship.
- [ ] Run BFF/unit/build/style checks and real two-farm read-only integration. Verify staff KPI summary follows existing controller permissions and full finance pages remain separately authorized.

### Task 6: livestock registry as the first operational module

**Owning roadmap:** WEB-3 / API-ANIMAL.  
**Planned files:** `(workspace)/app/farms/[farmId]/animals/page.tsx`, `animals/new/page.tsx`, `animals/[animalId]/page.tsx`; focused list/detail/form components, shared response/body validation and explicit BFF GET/POST/PATCH mappings.  
**Consumes:** authorized farm context and Task 5 animal read schema.  
**Produces:** real list/search/filter/pagination, register-animal form and animal detail. Pedigree/weights/import/tags get their own follow-up acceptance slices under WEB-3.

- [x] Before implementation, write the scoped registry spec/plan against the [registration contract](../task-6.1-animal-registration/spec.md), current animal DTOs, controller FarmRoles and subscription quota. Specify date/weight units, required fields and update behavior there; this umbrella does not invent defaults.
- [x] Tests must cover two farms sharing a tag, invalid/duplicate tag, pagination/filter URL history, quota/read-only denial, duplicate submission, and API rejection preserving typed form values.
- [x] Implement list/register/detail and matching BFF/body allowlists; add a live sidebar entry/quick action only after its route works. Add other registry features as independent accepted slices.
- [ ] Pass real isolated API/database browser creation/read/denial scenarios in both locales; preserve onboarding/members and Stage A tests. Update WEB-3 to the exact completed slice, not the entire registry backlog.

## Later domain handoffs — separate plans

| Order | Scope / roadmap IDs | Required acceptance before showing dashboard links/widgets |
| --- | --- | --- |
| C1 | Milk logs/analytics, WEB-4 / API-MILK | Actual recording/bulk semantics, dates/units, duplicate/retry handling, authorized export; seven-day chart with text alternative. |
| C2 | Incidents, attachments, vaccination/deworming, WEB-4 / API-HEALTH | Authorized records and species schedule, confirmed upload, provider-independent reminder display; real reminders only with provider evidence. |
| C3 | Expenses/revenues/P&L/reports, WEB-4 / API-FINANCE | Controller-specific member permissions, API currency, decimal totals, period filters and tested binary export/PDF response. |
| C4 | Billing/quota, WEB-6 / API-BILLING | Returned plans/access, real read-only feedback; Stripe portal and payment behavior verified separately. |
| C5 | Consultation intake/triage, WEB-7 / API-TRIAGE | Selected farm/animal, authorized case access, intake/media, assignment/payment states; no fake booking confirmation. |
| D1 | Catalog/order/library, WEB-5 / API-STORE | Real entitlements/order states and secure media/downloads; chapters/progress/certificates require API-B2 decisions. |
| D2 | Vet scheduling/cases/EHR/room/prescriptions/ledger, WEB-7–10 | Protected vet availability read/write; assigned-patient boundaries, clinical state/signing, provider room acceptance, ledger distinguished from actual transfers. |
| D3 | Admin metrics/triage/reviews, WEB-7/10 | Existing exact admin role rules and corresponding API projections; current role-review/access screens stay intact. |
| Separate profile extension | Narrow self-profile name/avatar/contact writes | Shared allowlist + self-only API, validation and safe contact/verification/upload policy; role/status/security fields rejected. Viewing remains available while this is pending. |

Each handoff requires an owning spec/plan and an exact API method/DTO/provider test matrix before code. This order is sequencing, not a deadline or an authorization to implement the entire backlog now.

## Verification commands and final acceptance

During implementation, use the installed scripts and newly created scoped checks. The browser harness at `check-workspace-browser.mjs` deliberately requires its existing isolated PostgreSQL/Redis/API fixture setup; follow the [runbook](../../features/role-request-approval/operations.md). Do not point mutation tests at deployed/user data.

| Command/check | Required result | Current evidence |
| --- | --- | --- |
| `pnpm --filter @vetralink/web test:auth` / `test:workspace` | Existing session/BFF/form behavior remains passing | Passing locally; see execution ledger. |
| `node apps/web/scripts/check-workspace-navigation.mjs` | Task 1 policy cases pass | Implemented; passing tests recorded in execution ledger. |
| `node apps/web/scripts/check-farm-overview.mjs` | Task 5 boundary/projection cases pass | Implemented; passing tests recorded in execution ledger. |
| `pnpm --filter @vetralink/web check:styles` / `test:styles` / `build` | Tailwind policy, type check and build pass | Passing locally; final evidence in execution ledger. |
| Auth/workspace browser scripts with isolated upstream/API | Six roles, both locales, protected returns, revocation, context isolation and unchanged admin/onboarding flows | Controlled-upstream browser acceptance passes; live isolated API/database remains unavailable. |
| Responsive/keyboard/manual review | 320–1440px, 200% zoom, long/empty names, drawer focus, slow/offline/partial/error states | Chrome responsive/keyboard and 200% zoom-equivalent reflow; native zoom/alternate browsers unverified. Exact covered cases and limits in ledger. |
| `python3 .context/scripts/validate.py`; `git diff --check` | Documentation links/structure and whitespace pass | Recorded below for the design delivery. |

## Design delivery checklist and evidence

- [x] Read existing auth/role/farm/client implementation and corresponding specs/roadmaps.
- [x] Capture the user's common-first, Farmer-next preference.
- [x] Compare layout approaches; define common, role-specific, profile and farm data states.
- [x] Produce wireframes and pair the source-grounded spec with this phased plan.
- [x] Self-review contracts, route consistency, unsupported feature claims and wireframes; record structural checks.

Design verification (2026-10-08): context validation passes for 48 documents, 306 local links and 95 source entries; a separate read-only check passes all 125 local links in this spec/plan and the linked web roadmap/public route specification. SVG XML and PNG integrity/dimensions (3200×2860) pass; `git diff --check` passes. The final PNG was visually reviewed for Bangla/Latin glyphs, text clipping, navigation colors, profile fallback, mobile stacking and clear sample-data labeling. Review corrected the financial-summary permission assumption (all four farm roles are allowed by its actual controller) and specified membership-based navigation for non-FARMER staff. Runtime application/build/browser tests were not run for this documentation-only delivery.

Application implementation now includes common dashboard/profile, selected farm overview/member routes and the first registry slice. Profile write API is absent; public clinician publication, provider-backed commerce/video and browser offline remain separate dependencies. Suggested documentation commit: `docs(web): design post-login dashboard and profile rollout`.

Local acceptance limit: the three live service items above were attempted but cannot run here (isolated PostgreSQL/Redis/API ports refuse connections; docker unavailable). Controlled API fixtures validate the web boundary/UI; they do not certify real database/provider integration.
