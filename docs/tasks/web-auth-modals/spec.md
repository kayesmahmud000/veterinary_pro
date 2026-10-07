# Modal sign in and sign up specification

Status: Implemented and verified against real isolated backend/database; deployed acceptance remains separate
Date: 2026-10-07. Inspected Git revision: `9db3062`; auth changes remain uncommitted.
Parent: [WEB-1E](../../../apps/web/ROADMAP.md), [API-AUTH](../../../apps/api/ROADMAP.md#api-dependency-register), backend tasks [2.2](../task-2.2-auth-dtos/spec.md), [2.4](../task-2.4-auth-service-core/spec.md), [2.7](../task-2.7-auth-controller/spec.md).

## Outcome and scope

Visitors open sign in or sign up from the public header on desktop and mobile, switch between them inside one dialog, and remain on their current page after authentication. Authenticated visitors open their account summary and sign out in the same dialog. All copy, validation, pending, error and success states support Bangla (default) and English.

**User requirement, 2026-10-07:** authentication uses modals, not separate pages. This supersedes the proposed `/login`, `/register` and `(auth)` shell in the public-site spec. Farm dashboards, account orders/library, OTP, password reset and social login are separate work.

## Inspected backend contract — Confirmed from code

All paths below are relative to `/api/v1`. Controller guards, concrete DTOs, AuthService, TokenService, UserEntity, UserRepository, response interceptor/filter and existing mocked HTTP tests were inspected. Success data is inside `ApiResponse.data`; backend messages are English and must not be displayed verbatim.

| Endpoint               | Accepted input / authentication                                                                                                                                                               | Result and relevant failures                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| POST `auth/register`   | Required `email` (valid email), `name` (2–100 characters), `password` (8–128 characters); optional string `phone`, optional public `role` (default LEARNER); UI permits LEARNER/FARMER/VET/BUYER, never ADMIN/SUPER_ADMIN. | 201 `{ user, tokens }`; 400/422 invalid fields or prohibited public role; 409 duplicate email/phone. Registration signs the user in immediately. |
| POST `auth/login`      | Required valid `email`, nonempty string `password`; optional string `phone`, optional boolean `rememberMe`.                                                                                   | 200 `{ user, tokens }`; 401 invalid credentials/deleted account, 403 suspended account.                                                 |
| POST `auth/refresh`    | Public; `{ refreshToken }`, a nonempty opaque string.                                                                                                                                         | 200 `{ tokens }`; 401 invalid/expired/replayed/inactive session. Rotation revokes the old token; reuse revokes all user sessions.       |
| POST `auth/logout`     | Public; `{ refreshToken }`.                                                                                                                                                                   | 200 with null data; revokes that refresh token. Access JWT may remain valid until its expiry.                                           |
| GET `auth/me`          | Bearer access token.                                                                                                                                                                          | 200 sanitized `AuthUserSummary`; 401 invalid token, deleted/suspended/unavailable user.                                                 |
| POST `auth/logout-all` | Bearer access token.                                                                                                                                                                          | 200 with null data. Present backend capability; all-device logout is outside this UI slice.                                             |

Tokens: `accessToken`, `refreshToken`, `tokenType: Bearer`, `expiresIn` in seconds. Backend defaults: access 15 minutes, refresh 7 days (configurable). Profile fields: id, email, name, role, status, isEmailVerified, maskedPhone, avatarUrl, createdAt; additive roleVersion and farmerOnboardingRequired. Email/name are normalized by the entity/repository. Phone is encrypted with a lookup hash; raw phone is not returned.

### Existing gaps and decisions

- Login service describes phone login but LoginDto and the shared request require email. Ship email/password login; record phone-only login as a backend contract follow-up.
- `rememberMe` is accepted but AuthService does not change token lifetime. Omit the checkbox and use browser-session cookies; do not promise extended retention.
- Historical password complexity prose exceeds current DTO enforcement (length only). UI enforces the actual 8–128-character signup contract. Confirmation is local and never sent upstream. Login permits existing nonempty passwords, without applying signup minimums.
- OTP/reset DTOs exist without controller routes. Do not expose dead recovery or passwordless controls.
- RegisterDto, AuthService and shared Zod accept only LEARNER/FARMER/VET/BUYER; omission defaults LEARNER. API storage/permissions remain authoritative.
- Phone format is not enforced by the DTO. Show an international-format hint, omit blank phone and preserve nonblank trimmed input without inventing a country restriction.

## Design, sessions and security

Use the existing Next.js 14, React, CSS tokens and typed localization boundary; no new form/UI/state dependencies. A native `<dialog>` provides modal semantics, top-layer isolation and keyboard focus containment. Add Escape/backdrop/close dismissal, scroll locking, initial focus, focus restoration, narrow-screen scrolling and local field feedback. Ignore duplicate submissions, preserve fields on recoverable failure and clear passwords on dismissal/mode switch/success. Keep a pending mutation in its dialog until its response is known.

Same-origin Next route handlers at `/api/auth/{login,register,session,refresh,logout}` call the configured backend. `API_BASE_URL` is server-only, defaults to `http://localhost:3001/api/v1`, and must include the API prefix. All requests use no-store and bounded timeouts; mutation handlers require same-origin Origin and JSON. Use a fixed operation allowlist, never an arbitrary upstream proxy. Do not forward browser-supplied bearer tokens or expose raw backend failures.

Tokens stay in HttpOnly, SameSite=Lax, Path=/ cookies; Secure in production. Cookies have no persistence Max-Age (browser session), with backend refresh expiry authoritative. No localStorage/sessionStorage tokens and no user/token rendering in server HTML. Return only explicitly selected profile fields. GET session validates against `auth/me`; POST refresh rotates then retrieves the profile. Invalid sessions are cleared by the mutation response; transient backend failures preserve cookies and offer retry. Logout clears local cookies only after backend revocation succeeds, preserving retry on failure.

Serialize session restoration/refresh/login/signup/logout in one browser using Web Locks across tabs where available, and a local queue otherwise. Recheck session inside the lock before refreshing to avoid reuse. Cross-tab notifications carry only an event, never identity/tokens. No background refresh loop. On visibility/reload/another tab's auth change, validate the current session; refresh only after authenticated session returns 401. Backend user/token locking and committed reuse invalidation are now verified with real isolated PostgreSQL. Alternate-browser/multi-device acceptance remains unverified; frontend locking does not establish those results.

## Impact and recovery

Frontend/Web/UI/UX, API/Security, Tech Lead, Code Reviewer/QA and UI Reviewer perspectives apply. Public discovery and language navigation must still work with the API unavailable. New routes affect only the web session boundary; no API/shared schema/database changes or migration. Removing the modal/provider/routes restores the previous public shell; signed-up users remain ordinary backend users. No deployment or agent-managed Git mutations.

## Acceptance

1. Header exposes working sign in/sign up at desktop and 320px; no auth page navigation.
2. Forms produce exact allowed API payloads; validation, duplicate accounts, wrong credentials, suspended users, offline/timeout and retry remain understandable in both locales.
3. Successful signup/login shows the real account summary on the current URL, except incomplete FARMER accounts immediately resume /account/farm-onboarding. The [role/onboarding feature](../../features/role-request-approval/spec.md) owns this required redirect.
4. HttpOnly session persists across navigation/reload; refresh rotates once and logout revokes/clears the session. Tokens never enter browser JSON, JS storage, markup or logs.
5. Keyboard focus, Escape/backdrop, focus restoration, scroll, 44px targets and narrow/zoom layout are checked in rendered Chrome in both locales.
6. Meaningful server-boundary/session tests, backend auth baseline tests, shared/web build and public localization regression pass. Separate a controlled mock upstream from real database/backend evidence.

Updated 2026-10-07: all six roles, shared Zod, default LEARNER/professional signup, farmer setup redirect and protected application/review/access links are implemented. [Real isolated verification and release limits](../../features/role-request-approval/operations.md) supplement the original controlled-upstream auth evidence.
