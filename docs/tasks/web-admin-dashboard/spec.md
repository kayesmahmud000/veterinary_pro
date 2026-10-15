# ADM-1 — Admin and Super Admin dashboard

Status: Implemented locally, authorized by the user's “work base on road map” instruction. Verification and live-service limits are recorded in [plan.md](plan.md).
Baseline: 2026-10-13 / `d0385ec`, including the approved uncommitted admin roadmap.

## Scope

Implement [ADM-1](../../../apps/web/ROADMAP.md#admin-and-super-admin-delivery-roadmap): `/admin/dashboard`, `/admin` entry, administrative login/navigation, real subscription count cards and recent pending applications. Integrate existing role-review and Super Admin access pages. ADMIN and SUPER_ADMIN share the existing workspace shell, with Super-only access controls. ADM-2–9 remain separate work.

Use existing Next.js/React/Tailwind/Lucide/Zod dependencies and shared session infrastructure. Preserve the full-width shell, 1024px drawer breakpoint, sidebar account footer, language-only desktop header, Bangla default and complete English. No new backend writes, migrations, secrets, providers, currency assumptions, fake metrics or links to unreleased modules.

## Source and boundaries

Confirmed from code: [metrics controller](../../../apps/api/src/modules/subscriptions/controllers/subscription-metrics.controller.ts) allows ADMIN/SUPER_ADMIN and returns [subscription summary counts](../../../packages/shared-types/src/dto/subscription/subscription-metrics.dto.ts). Money lacks a currency contract, so ADM-1 projects counts only. Existing [role queue](../../../apps/web/src/lib/workspace/contracts.ts) returns requests and nextCursor, not a platform total. Existing [privilege service](../../../apps/api/src/modules/administration/privileged-role.service.ts) owns reauthentication, version/audit/last-Super rules.

Baseline [middleware](../../../apps/web/src/middleware.ts) checks active identity only. Extend its identity result and role policy so denied administrative requests redirect before private screen delivery. The cookie BFF must independently enforce current active role for every admin mapping; backend guards remain authoritative as well. No cookie/token-derived role assumption or arbitrary proxy endpoint.

## Routes and role behavior

| Route | ADMIN | SUPER_ADMIN | Other active identities |
| --- | --- | --- | --- |
| `/admin`, `/dashboard` | Redirect to `/admin/dashboard` | Redirect to `/admin/dashboard` | `/admin` redirects to `/account/profile`; `/dashboard` keeps current behavior |
| `/admin/dashboard`, `/admin/role-requests`, existing review detail | Allow | Allow | Redirect to `/account/profile` without admin content |
| `/admin/administrative-access` | Redirect to `/admin/dashboard` | Allow | Redirect to `/account/profile` |

Signed-out, invalid, suspended or unverifiable sessions keep the existing Home/sign-in handoff with validated return URLs. Middleware does not refresh tokens. Denied signed-in access does not enter a sign-in loop. Explicit admin login defaults to `/admin/dashboard`; preserve authorized returns and filter out admin destinations the identity cannot access. Existing Farmer setup priority and learner Home/Profile policy remain intact. `/admin/dashboard` is the only new canonical screen; `/admin` is an alias. Retain `/dashboard` compatibility via server and client redirects so cached navigation cannot expose the old admin overview after identity changes.

Client gates react to session/role/version changes, hiding data during uncertain identity and clearing results on a changed identity/version. Navigation uses only released destinations and marks one active item. Administrative navigation groups are Overview, People, and (Super-only) Platform, plus the shared account/support/footer controls. Public account menus point directly to the correct role home.

## Dashboard and data

The dashboard has a bilingual role-aware heading/intro, subscription status section, recent pending applications and quick links to role review and (Super-only) administrative access. Profile remains reachable through the account footer. No monetary metrics or global user/farm totals.

GET `/api/workspace/admin/overview` maps only to GET `subscriptions/metrics/summary`, with an empty strict query. Return a Zod-projected object containing `asOfDate`, totalSubscriptionsCount, activeSubscriptionsCount, activePayingSubscriptionsCount, trialingSubscriptionsCount, pastDueSubscriptionsCount, canceledSubscriptionsCount and expiredSubscriptionsCount. Require a valid timestamp and finite safe nonnegative integer counts. Do not forward financial fields or unrecognized upstream data. Show the snapshot timestamp in Asia/Dhaka; zero counts are valid data, while missing/malformed/failed data produces a retryable error.

Fetch `admin/role-requests?status=PENDING&limit=5` separately using the existing validated queue boundary. Show applicant name, translated requested role, localized submission date and review link. Label this as recent applications, not a total. Empty queue has explicit copy; show “View pending applications” for the full filtered queue. Failures in one section do not suppress the other. Requests start independently, with no browser persistence. Existing refresh serialization applies to 401 recovery.

Every admin BFF mapping verifies active current identity through backend `auth/me` using the same bounded abort signal and trusted upstream. ADMIN/SUPER allowed on overview/review; SUPER only on the existing `admin/users` access mappings. Reject missing session, wrong role, unknown query/method, duplicate parameters, failed identity lookup and malformed output with existing private JSON errors. Do not change the `admin/users` alias to a general directory.

## Acceptance

1. Failing then passing unit tests for login/return/navigation policy, middleware role/redirect/no-refresh behavior and BFF count projection/authorization/errors.
2. Controlled production-browser tests for both admin roles and languages, HTTP and UI denial for other roles, existing review/access integration, partial/malformed/empty/zero states, independent retry, role demotion and logout/Back privacy.
3. Keyboard/mobile drawer and responsive checks at 320/375/768/1024/1440px, long names/Bangla, one main/H1 and no horizontal overflow. Visually inspect representative screenshots.
4. Existing auth, workspace, farm, localization and protected-route regressions; Tailwind policy/style suites; isolated production build without touching the active `.next`.
5. Attempt the isolated real-backend runbook separately. Report unavailable infrastructure and distinguish fixtures from live acceptance. Review final diff, validate documentation and update ADM-1 with evidence.

No Git staging/commit/merge/push or deployment. Rollback is scoped web source reversal; no persisted-data change occurs.
