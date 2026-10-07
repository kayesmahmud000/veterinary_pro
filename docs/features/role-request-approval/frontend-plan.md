# Frontend implementation plan

Status: **Implemented and locally verified, 2026-10-07.** Backend-first delivery is complete; forms and response boundaries use shared Zod.

Contract: [specification](spec.md). Backend: [backend plan](backend-plan.md). Verification: [operations](operations.md). Authentication remains governed by the [modal specification](../../tasks/web-auth-modals/spec.md).

## Authentication modals

Keep a single native sign-in/sign-up/account dialog in the existing AuthProvider. Signup defaults LEARNER and permits FARMER/VET/BUYER; no administrative choice. Shared Zod validates normalized name/email/password/optional phone, local confirmation, and all six safe returned identities. Password confirmation is never sent to the backend.

Fixed auth BFF routes retain HttpOnly session cookies, same-origin mutation checks and browser-safe identity JSON. No separate login/register page or browser token persistence is added. Web Locks coordinate auth and workspace requests; fallback serializes requests within the tab. Approval rotates into live role state; privilege changes require sign-in again.

## Account entry and feature navigation

The account modal links own applications, LEARNER application entry, FARMER setup/farm, ADMIN/SUPER review, and SUPER-only administrative access. Navigation uses the returned live identity; API authorization remains authoritative.

New FARMER signup immediately closes the dialog and opens /account/farm-onboarding. FARMER sign-in resumes incomplete setup. /farm redirects until the backend flag clears; direct API tenant/sync/socket access is independently denied.

Setup creates an owned farm with FarmType, country/district/upazila/address, species, animal count, experience and optional paired bounded GPS. OWNER is derived and shown. Existing-farm mode lists only actual memberships and requires confirmation; clients cannot choose ownership/role. Submission key survives an unchanged retry; status retrieval recovers committed uncertain outcomes.

Farm entry lists real authorized farms, selected farm summary and member display names. Member form accepts an existing account email and FarmRole; managers have no OWNER option. Backend quota/conflict/eligibility errors are localized. This does not implement livestock, milk, clinical or billing dashboards.

| Implemented route | Purpose |
| --- | --- |
| /account/farm-onboarding | Mandatory create/confirm setup |
| /farm | Authorized farm selection/summary/member management |
| /account/role-requests | Own bounded history/status/filter |
| /account/role-requests/new | LEARNER professional application |
| /account/role-requests/[id] | Own safe detail/status |
| /admin/role-requests | ADMIN/SUPER review queue |
| /admin/role-requests/[id] | Review detail and confirmed decision |
| /admin/administrative-access | SUPER-only list/email lookup/confirmed privilege management |

Signed-out account pages open the auth modal and retain the internal destination; pages fetch no protected records until authenticated. Layouts are dynamic/noindex and private BFF responses use no-store.

## Application form and status

Fetch the backend version-1 bn/en questionnaire and render supported field types. Shared Zod validates consent, bounded strings, numbers and role-specific answers. Accessible labels, aria-invalid/describedby, inline localized errors and first-invalid focus support correction.

Only LEARNER can submit; existing PENDING requests show history instead. Keep answers in component memory, submission key across unchanged retries, and safe status/history after a conflict. No private application data is written to localStorage or cross-tab events. Changing target resets that target's answers explicitly; locale navigation follows the existing reload convention and does not persist drafts.

History/detail show current role, pending/terminal state, safe answers and public reason. Explicit refresh rechecks account/status, and approved history refreshes a remaining LEARNER session. There is no background status-polling loop. Retryable failures never optimistically grant a role.

## Reviewer UI

ADMIN and SUPER share a status/target-filtered paginated queue. Detail includes answers, applicant role/version, immutable history and separate public/private notes.

Decisions require confirmation and expected versions. Rejection requires a public reason; reviewed VET approval requires a qualification-verification note. Loading disables duplicate actions; conflicts/failures refresh the detail so a committed decision is visible. Own history never receives private reviewer notes.

## SUPER_ADMIN access-management UI

Lookup an existing account by normalized email, list administrative accounts with search/pagination, and show current role/version plus preserved fallback. No broad ordinary-user directory or account creation.

Grant ADMIN/SUPER or remove privilege through a confirmation dialog, mandatory reason and fresh acting password. Password is cleared after attempts/cancellation and never logged/persisted/returned. Self/inactive changes are disabled; the API enforces eligibility and last-SUPER policy independently. Normal ADMIN sees localized denial and receives backend 403 through the BFF.

## BFF and contract changes

/api/workspace/[...path] resolves a fixed method/path/UUID/query allowlist. It validates strict body and bounded queries with Zod, enforces origin/JSON/session checks, uses server-cookie bearer authorization and explicit tenant headers, bounds request size/timeouts, and projects responses through endpoint Zod schemas.

Only recognized backend errorDetails.title codes cross the boundary; provider/database text does not. On 401 the client serializes refresh then retries with the same immutable payload/version/key, and publishes an identity-free session event. Versioned terminal operations prevent duplicate successful mutations. No arbitrary upstream path or return URL is accepted.

## Dependency order and acceptance

| Step | Delivery / evidence |
| --- | --- |
| FE-1 | Six-role identity, default LEARNER/professional modal signup, shared Zod |
| FE-2 | FARMER setup/dashboard gate/member control; LEARNER application/history |
| FE-3 | Reviewer queue/detail/decision and private projection |
| FE-4 | SUPER access lookup/grant/removal/password confirmation |
| FE-5 | Production build, boundary tests, real local API/DB/Redis browser checks, bn/en 320–1440px, existing auth/public regressions |

All implementation steps passed local verification. Real provider/staging/production release checks remain separately documented in [operations](operations.md); local mock acceptance does not establish deployed readiness.
