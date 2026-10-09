# Post-login dashboard and profile design

Status: **Implemented locally: common workspace and first Farmer registry slice; live integration acceptance pending**
Date: **2026-10-08**  
Inspected revision: **47e4680**, plus the user's current uncommitted web changes.  
User-selected order: **common dashboard/profile → Farmer workspace**.

## Outcome and scope

Design Khamar School's authenticated experience around the existing livestock, learning/store and veterinary domains. A signed-in person should understand their current role, where to continue, which farm is selected and which actions are available. Preserve Bangla-default/English localization, modal authentication and the existing farm setup/application/review flows.

This delivery contains the design, [wireframes](wireframes.png), editable [SVG](wireframes.svg) and [implementation plan](plan.md). Wireframes contain fictional sample data and future screens; they are visual proposals, not working dashboards. The selected first implementation batch is a shared workspace shell, common dashboard, read-only self-profile and post-login routing. Subsequent domain batches have separate acceptance gates.

## Confirmed baseline and implications (before implementation)

| Confirmed from code | Design implication |
| --- | --- |
| [Shared roles and FarmRole](../../../packages/shared-types/src/enums/index.ts): LEARNER, FARMER, BUYER, VET, ADMIN, SUPER_ADMIN; each user has one primary platform role | One shared shell with role-specific navigation. Farm membership is a separate permission dimension; no account-role switcher. |
| [Auth dialog](../../../apps/web/src/components/auth/auth-dialog.tsx) redirects only FARMER accounts requiring setup; other successful logins show the account summary on the current page | Add an explicit post-login destination while preserving recovery from protected pages and existing setup priority. Session restoration alone must not redirect public browsing. |
| [Workspace layout](../../../apps/web/src/app/%28workspace%29/layout.tsx) uses the marketing SiteHeader; [Workspace](../../../apps/web/src/components/workspace/workspace.tsx) owns page landmarks and view-specific gates | Replace the authenticated outer header with a compact application shell; preserve the public header on marketing routes and exactly one main/H1 per workspace page. |
| [Farm workspace](../../../apps/web/src/components/workspace/farm-workspace.tsx) provides create/confirm onboarding, authorized farm selection, farm summary and existing-account member management | Reuse those flows. The component named FarmDashboard is currently a summary/member screen, not a livestock dashboard. |
| [Auth user schema](../../../packages/shared-types/src/validation/index.ts) supplies name, email, maskedPhone, avatarUrl, role, status, isEmailVerified, createdAt and optional roleVersion/onboarding state | First profile can use the existing sanitized session projection. No phone decryption is needed. |
| [Users module](../../../apps/api/src/modules/users/users.module.ts) has no self-profile controller; the [role policy](../../features/role-request-approval/spec.md) explicitly excludes generic profile writes | Profile editing needs a separate, narrow API contract. Viewing the profile is independently deliverable. |
| [Vet availability controller](../../../apps/api/src/modules/consultations/controllers/vet-availability.controller.ts) exposes protected scheduling/profile reads and writes | Vet scheduling is separate from self-account identity and the curated public doctor directory. |
| [Doctor source](../../../apps/web/src/content/README.md) uses manually curated, labeled fictional profiles | An authenticated VET account is not automatically published as a public doctor. Role selection alone never produces a verified-clinician badge. |
| [API readiness register](../../../apps/api/ROADMAP.md#api-dependency-register) contains operational domain APIs, with remaining provider and product gaps | Show operational cards only when their API projection and destination work. No invented purchase, course progress, notification or payout totals. |

This is a source-grounded design review, not fresh runtime/deployed acceptance. Existing verification belongs to the [auth plan](../web-auth-modals/plan.md) and [role/onboarding runbook](../../features/role-request-approval/operations.md).

## Approaches and decision

| Approach | Trade-off |
| --- | --- |
| **Recommended: shared workspace shell + role-specific content** | Consistent navigation/profile/auth, small shared components, domain screens implemented separately. Fits the single-role model and current route families. |
| Independent layouts for every role | More freedom per portal, but repeated identity/localization/navigation logic and five inconsistent mobile experiences. |
| One generic dashboard containing every domain | Fast visual prototype, but distracts users and obscures farm membership, clinical access and unsupported features. |

Use the shared shell. Farmer operations remain farm-specific; admin and clinical views keep their own access rules. A reusable layout does not unify backend permissions.

## Entry and navigation flow

```mermaid
flowchart TD
  A[Successful modal login or signup] --> B{Farmer setup required?}
  B -->|Yes| C[/account/farm-onboarding]
  C --> D[/farm: select authorized farm]
  B -->|No| E{Valid protected return destination?}
  E -->|Yes| F[Resume destination through its access gate]
  E -->|No| K{LEARNER?}
  K -->|Yes| L[/: public home; Profile account link]
  K -->|No| G[/dashboard: current-role overview]
  G --> H[/account/profile]
  G --> D
  G --> I[Existing role application or admin review]
  D --> J[Farm overview and released domain pages]
```

Proposed behavior:

- Per the user's 2026-10-09 navigation update, after explicit successful login/register: pending FARMER setup wins, then a validated protected return destination, otherwise `/` for LEARNER and `/dashboard` for other ready roles. A LEARNER return to `/dashboard` falls back to `/`; opening `/dashboard` as a restored LEARNER redirects to `/account/profile` without rendering the dashboard. Existing protected profile/application returns remain supported.
- After setup, retain the current `/farm` destination. When the farm overview ships, `/farm` remains the farm discovery/selection entry and opens `/app/farms/[farmId]`. Existing member management stays reachable throughout the transition.
- Restoring a session on `/`, `/blog` or another public page keeps that page open. LEARNER public account controls link directly to Profile and all learner navigation omits Dashboard. Other roles keep Dashboard/Profile links and the modal account summary/logout shortcut. Workspace breadcrumbs use Profile as the learner entry.
- Per the user's 2026-10-09 server-protection follow-up, a signed-out protected visit redirects before protected page delivery to public Home, where Sign in opens without waiting for restoration. Escape, backdrop and Close dismissal clear the entry query and remain at `/`; successful login/signup resumes the validated return under the existing role/setup rules. Login/register switching preserves protected-entry behavior. Pending mutations remain nondismissible; failed credentials keep the modal open. Session/network failures retain Retry. Public dialogs keep their ordinary dismissal behavior. Never place private page content behind a cosmetic client-only role check.
- Validate return destinations against released workspace routes, normalize with a same-origin URL, reject absolute/external URLs, protocol-relative URLs, backslashes and API paths. An unauthorized destination still renders the ordinary denial state; return navigation grants no access.
- Losing a role or membership clears protected data and refreshes the identity. Unknown roles fail closed. LEARNER cannot open operational farm/clinical work.

## Workspace shell and visual language

### Server-enforced entry (2026-10-09 follow-up)

Before rendering or delivering a protected workspace route, middleware requires a current active identity verified through backend `auth/me`; cookie presence/decoded client identity alone is insufficient. No access cookie, expired/forged/revoked/suspended identity, malformed responses or unavailable upstreams redirect to Home with `auth=required` and an allowlisted `returnTo`. Missing access skips upstream verification. Preserve private/no-store/noindex headers and all public/API route semantics. Middleware never rotates refresh tokens; browser Web Locks remain the owner of refresh/cookie rotation.

Home immediately opens the protected sign-in dialog without waiting for the session API. Restore/refresh a viable existing session there and resume the allowed destination under the current role/setup policy. Do not auto-navigate on transient errors; show Retry. Closing while signed out removes the entry query and remains at Home, with no repeated prompt. Existing public login/signup and workspace role/tenant/API guards remain in place. Login refreshes the router cache to avoid a prefetched signed-out redirect surviving new auth cookies; successful logout also invalidates cached protected screens, including history navigation.

Desktop at **1024px and wider**: full-width (`w-full`) outer container, 240px sidebar and flexible content column with `min-w-0`. Per the user's 2026-10-09 update, all workspace routes (dashboard, profile, account, admin and farm pages) use the full available width; the header also fills its content column. Use 16px horizontal content/header padding below 640px, 24px from 640px and 32px from 1024px; give the desktop sidebar 16px horizontal padding. Below 1024px use a compact header and a labeled mobile navigation drawer. This is a separate application breakpoint; public navigation keeps its current 1280px breakpoint and public containers retain `w-11/12`.

The sidebar contains the localized SiteBrand, Dashboard, released role/domain destinations, Profile, role applications where supported, Help and Back to website. Per the user's 2026-10-09 account-placement update, its bottom contains a signed-in profile icon/name/link and a labeled Sign out icon button. Hide account identity while session restoration is pending, failed or signed out; preserve pending/error/retry logout behavior. The workspace top bar contains only the existing language control on desktop, plus the necessary drawer trigger below 1024px. Remove its breadcrumb, duplicate brand and account menu. Desktop sidebar and mobile drawer share the account controls; opening Profile closes the mobile drawer. Farm selection remains in the farm content. Public marketing navigation remains unchanged. Do not show a decorative notification bell or search field without a working purpose. Retain sidebar labels rather than requiring icon recognition; collapse-to-icons and dark mode are deferred.

Use the existing palette: ink `#183f32`, green `#214e3a`, paper `#fafbf7`, line `#dfe5dc`, muted `#53655c`. Active navigation changes **only text** to `#a26913`, with `aria-current`; no active pill background or underline. Green is reserved for primary actions. Amber is an accent/status treatment, not low-contrast body text on white. Status always includes a readable label.

Use existing system/Bengali fonts, 16px form/body text, 44px minimum controls, restrained 12–16px card radii and a 24px desktop/16px mobile gap. KPI cards wrap from four to two to one columns as space requires. Mobile content scrolls naturally; neither the header nor a fixed CTA hides form errors or the keyboard. Wide tables have a labeled local scroll region or a card equivalent, not page-wide overflow.

Reuse installed Card, Button, Input and Badge. Adapt the composition patterns from the official [Tailwind-3-era shadcn Sidebar](https://v3.shadcn.com/docs/components/sidebar), [Avatar](https://ui.shadcn.com/docs/components/radix/avatar) and [Sheet](https://ui.shadcn.com/docs/components/radix/sheet). Prefer a simple fixed sidebar and the existing native-dialog behavior initially. Add Radix primitives only for a concrete missing interaction, with versions compatible with Next 14/React 18. Do not copy current upstream CSS variables/inline styles or migrate Tailwind/preflight to install a block. No graph/table library is required for the first batch.

## Common dashboard — `/dashboard`

The initial page is a role-aware starting point, using real identity and existing actions rather than analytics placeholders:

1. Greeting, current primary role and one most relevant primary action.
2. Role workspace card: FARMER → setup or `/farm`; LEARNER → free learning and the existing professional application form; ADMIN/SUPER_ADMIN → existing role review queue. VET/BUYER get honest welcome/discovery content until their operational destination ships.
3. Account card with email verification label, masked phone when present, Profile link and language preference entry.
4. Existing own-application history link. Detailed application status is fetched only in the application view initially; do not invent global pending counts from a cursor page.
5. Help/resources relevant to the current role, using existing public guides/help/directory URLs.

No per-account course progress, orders, revenue, cases or unread-notification counter in this initial batch. When a domain ships, replace its discovery card with its real read model. Do not auto-publish reserved URLs as disabled sidebar links.

## Role-specific destinations and priorities

All rows below are **proposed**, with existing URLs explicitly marked.

| Role | Dashboard emphasis | Destination set as the domains ship |
| --- | --- | --- |
| LEARNER | Public home after login/signup, direct profile, application status; no dashboard | `/account/profile`, `/learning`, `/account/role-requests` and `/account/role-requests/new` **existing**; enrolled-course links ship with the enrollment feature (user-selected scope 2026-10-09); later `/account/library`, `/account/orders`, `/catalog` |
| FARMER | Current farm, next operational action, setup/access feedback | `/account/farm-onboarding`, `/farm` **existing**; later selected-farm overview, animals, milk, health/vaccinations, finance/reports, members, billing, consultations |
| BUYER | Owned resources and real order states; free discovery until commerce ships | Later `/account/library`, `/account/orders`; farm navigation only for confirmed memberships allowed by current backend rules |
| VET | Assigned cases, availability and case actions | Later `/vet`, `/vet/availability`, `/vet/settlements`, authorized `/consultations/[id]` and prescription view; never self-assign privileges or imply every case is their patient |
| ADMIN | Professional review, then triage and operational metrics | `/admin/role-requests` **existing**; later `/admin/triage`, `/admin/metrics`, `/admin/reviews` |
| SUPER_ADMIN | Same administrative overview plus controlled access management | Above, plus `/admin/administrative-access` **existing**; retain reauthentication, audit and last-super protections |

Preserve the [canonical domain routes](../../features/web-public-site/spec.md#route-inventory-and-delivery-ownership); add only `/dashboard`, `/account/profile`, `/app/farms/[farmId]` and `/app/farms/[farmId]/members` to that inventory when their owning batches implement them. No second `/doctor-dashboard` or `/farmer-dashboard` route family.

When learning/commerce ships, the LEARNER/BUYER overview puts owned resources first, with type/title and an authorized Open action, followed by recent order statuses and public discovery. Empty ownership explains how to find resources. Playback position, completion, certificates and ratings appear only when their actual contract exists; access does not depend solely on the account being named BUYER.

The later VET overview puts assigned active cases first: animal/tag, farm, case status and permitted Open action. Availability and working hours sit beside the case list; urgency/assignment/payment labels use returned data. The case workspace separately places patient history, consultation communication and authorized clinical actions; private notes stay out of farmer/common profile views. Settlement information is a separate ledger screen, not a simulated wallet.

The later ADMIN/SUPER_ADMIN overview emphasizes the professional-review queue, then authorized triage and SaaS metrics. Existing cursor-based review items can be shown as a queue preview, never as a made-up global count. Review details retain qualification checks, public reason versus private note separation and confirmation; SUPER-only access management stays distinct. No global user-management/suspension surface is inferred from the privilege-change API.

## Profile — `/account/profile`

Use a profile identity card plus three linked sections. Desktop places identity at left and section content at right; mobile stacks them. Route sections use `?section=details|access|preferences`, with unknown values falling back to details. Normal links preserve history and work without JavaScript; do not require a tabs package for three sections.

| Section | First batch | Later contract-dependent additions |
| --- | --- | --- |
| Personal details | Name, avatar or initials, email, masked phone or “Not provided”, joined date, email-verification label, account status. Read-only. No fabricated completion percentage. | Name editing after a narrow self-profile write API; photo upload after validated storage flow. Contact changes require their own verification/session policy. |
| Access and workspaces | Read-only primary role, own role applications link, LEARNER application CTA, Farmer setup/farm link, existing admin links only for exact roles | Confirmed farm membership summaries and vet scheduling settings when those batches ship. No editable role dropdown. |
| Preferences and security | Existing বাংলা/English control, logout and Help link. Explain the email/password sign-in method. | Change password, email verification resend and log out all devices only after corresponding web/API contracts are implemented and tested. No fake device/session list. |

Do not use `maskedPhone` as the value of an editable phone field. Future contact editing may reuse the signup country picker/number parser, but backend validation, encryption, blind-index uniqueness and reverification remain authoritative. Existing avatar URLs require safe rendering/fallback; phase one can use initials rather than loading arbitrary remote images. Email verification can be displayed but must not offer a nonexistent resend flow.

An operational vet profile at `/vet/availability` contains specialties, available/off-duty toggle, capacity, working hours and timezone from its protected API. The public doctor directory remains manually curated; biography, credentials, publishing consent and verification need a separate publication contract before joining the two sources.

## Farmer workspace design

Farm header always shows selected farm name and the current member role. The UUID in `/app/farms/[farmId]` is the explicit context; API requests use the same validated `x-farm-id`. Selecting a different authorized farm changes the route, clears old farm results/errors/forms and ignores or aborts stale requests. Do not silently fall back to another farm when a deep link is denied.

The operational overview, implemented after the common batch, contains:

- Total registered animals, today's recorded milk, vaccination/deworming due in seven days, and the returned financial summary where allowed. Each card has its own loading/empty/failure state. For non-dairy farms, omit the milk feature rather than render an irrelevant zero.
- Quick actions for **released** animal registration, milk entry, health incident and expense forms, subject to backend member/access permissions.
- A seven-day milk chart with a text/table alternative for dairy/mixed farms, and upcoming care events linked to supported records. Do not invent missed-task counts or a general activity feed.
- Visible subscription access/read-only message from `canRead`/`canWrite`; keep usable reads, disable denied writes and show the actual reason. Never hardcode plan prices/quotas or treat API unavailability as permission to write.
- Members/settings reachable separately; preserve adding existing accounts by email and OWNER/MANAGER restrictions. Invitations, ownership transfer, member deletion and farm editing are not implied by current create/list contracts.

Member role affects actions independently of primary platform role. Current animal/milk/schedule reads and financial KPI summary permit all four farm roles; full financial statements are OWNER/MANAGER. Animal registration currently also admits all four roles. Match each controller's actual permission contract; do not invent a HERDSMAN finance restriction or a VET_STAFF-only clinical privilege. Non-FARMER professional members may access permitted farm routes after current backend membership validation; the original FARMER-only `/farm` view must not be used as their sole gate. SUPER_ADMIN support bypass is not exposed as an arbitrary farm-ID input.

### Source-grounded card read models

Paths are relative to `/api/v1`; the implementation exposes these projections through fixed, farm-scoped web workspace mappings. Full domain editors remain separate.

| Card | API/source | Projection and behavior |
| --- | --- | --- |
| Registered animals | `GET animals?page=1&limit=1`; [controller](../../../apps/api/src/modules/animals/animals.controller.ts) | `data.meta.total` from the unfiltered registered-animal list. Label includes sold/deceased records; an active-herd card would require `status=ACTIVE` and a different label. Never use first-page item count or onboarding animalCount. |
| Recorded milk on the UTC reporting date | `GET milk-logs/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&entryType=ALL`; [controller](../../../apps/api/src/modules/milk-logs/milk-logs.controller.ts) | `summary.totalYieldLiters`; with `summary.totalRecords===0`, display “No entry for this reporting date”, distinct from recorded zero. Current API milk/finance buckets use UTC; overview labels that date/window and separately shows the Asia/Dhaka local date. Seven-day trend remains a later domain slice. |
| Care due | `GET clinical-health/vaccinations/schedule?daysAhead=7&asOfDate=YYYY-MM-DD`; [controller](../../../apps/api/src/modules/clinical-health/vaccine-schedule.controller.ts) | `dueNext7Days`, `overdueCount`, `upcomingEvents`; no fake notification delivery assertion. |
| Period financial summary | `GET financial/profit-loss/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`; [controller](../../../apps/api/src/modules/financial/financial-profit-loss.controller.ts) | `netProfit`, `totalRevenue`, `totalExpense`, API currency/date range. Do not label net profit as income or externally paid money. |
| Access/quota | `GET subscriptions/farm/:farmId/access-status` and `/quota`; [controller](../../../apps/api/src/modules/subscriptions/subscription.controller.ts) | Returned access and quotas, with permission/missing-subscription/provider error states handled explicitly. These API reads lack membership enforcement; the web BFF positively checks `farms/my` before contacting them. A selected header is not authorization. |

Do not merge partial reads into a synthetic all-success dashboard response. The first farm integration can fetch the independent validated card projections concurrently through the fixed BFF routes; add a backend summary endpoint only if measured cost justifies it.

## States, localization and acceptance

Every private page has session-checking, signed-out, unavailable/retry and role-denied states before rendering private content. Every data region distinguishes no records, explicit numeric zero, loading, malformed response, denied and failed fetch. Show no previous farm/user data during transitions. Retain unsaved text on recoverable submit failure within the same context; require confirmation before navigating away from dirty forms. Never save clinical/financial drafts in browser persistent storage without a separate isolation/offline specification.

No browser offline/sync claim in this design: disconnected saves are not queued or marked complete. Use Bangla-default typed catalogs for titles, metadata, form labels, status, validation, aria labels and dates/numbers. API enums/IDs stay stable. Financial units/currency and farm/animal identity remain visible. Long Bangla names wrap, missing avatars fall back, and 320px/200% zoom remains usable.

Implementation acceptance requires all six role landings, signed-out recovery, pending setup precedence, return-URL rejection, fresh role/membership changes, cross-farm denial and delayed response isolation; bilingual mobile/desktop keyboard/focus checks; private no-store/noindex behavior; and regression of existing setup, role review, admin access and modal login/logout. A diagram or passing build alone cannot satisfy these checks.

## Delivery boundaries

Stage A: common shell/dashboard/read-only profile and entry navigation. Stage B: farm context/summary/members transition and animal registry. Stage C: milk, health/vaccinations and finance/reporting as separate domain tasks; then billing and consultation intake. Stage D: commerce/library, doctor portal and admin operational modules under their existing web/API roadmap IDs.

Profile editing, public vet publication, course progress/certificates, general notifications, passwordless/reset, browser offline, live video and actual payment/payout execution require their own contracts/provider acceptance. Keep their product direction visible in the roadmap; do not scaffold inactive screens in Stage A.

UI/UX, architecture, frontend/API, security and QA perspectives were used for the original proposal. That design-only delivery changed documentation/artifacts; the subsequent implementation preserves existing URLs and adds reversible web components/BFF mappings without schema migrations or new dependencies.

## Local implementation evidence (2026-10-08)

Tasks 1–6 are implemented in the current checkout. See the [execution ledger](progress.md) for tests, review corrections and integration limits, and the [registry contract](../web-animal-registry/spec.md). Profile is read-only. Newly onboarded farms have no automatic subscription; writes remain blocked until an actual active subscription grants access. Subsequent domain handoffs are still separate.
