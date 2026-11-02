# Administrative course enrollment management specification

Status: Implemented locally with verification; target migration, enablement and deployment remain separate. Date: 2026-11-02. Baseline revision: `471875f`.
Implementation plan: [plan.md](plan.md).
Parent scope: [YouTube courses](../youtube-courses/spec.md), [connected administrative courses](../../tasks/admin-course-management/spec.md), and [administrative directory](../admin-directory-audit/spec.md). This extends their enrollment-count-only boundary while retaining publication, account-support and privilege controls.

## Outcome and confirmed decision

ADMIN/SUPER_ADMIN can open a course's enrolled learners, inspect an individual user's courses, add an existing user, and remove/restore individual memberships. Removing membership affects only that course; it does not delete or suspend the account.

**Confirmed user decision, 2026-11-02:** the administrator supplies the new user's name, email and password and directly creates the account. The same action then enrolls that user in the selected course. This supersedes the earlier invitation proposal. No invitation, acceptance page, delivery worker or email-provider prerequisite belongs to this implementation.

Required new-user sequence: validate and confirm → hash password → transaction begins → create User → create CourseEnrollment → record both audit events → commit → show account and enrollment success. The account exists before enrollment, but neither is committed alone. Enrollment/audit failure rolls back the newly created account.

Remaining planning assumptions:

- Removal is persistent revocation for that course; free self-enrollment cannot bypass it. Administrator RESTORE explicitly returns access.
- Both administrative roles manage ordinary LEARNER/FARMER/VET/BUYER accounts. Existing administrative-account memberships are visible but read-only here. New accounts created by this feature are always LEARNER.
- Add/restore/create-and-enroll require a published, undeleted, free YouTube course. Unpublished courses retain membership history and permit removal; paid drafts/internal products gain no free entitlement.
- Existing-user search uses name/email; exact-email lookup supports reconciliation. Phone collection/search and bulk creation are excluded.

Success requires two accurate directory views, individual membership actions, secure direct account creation, preserved administrator identity, and tested authorization/transaction/concurrency/rollback behavior. This proposal is not production release approval.

## Current implementation and evidence

These observations are **Confirmed from code**, not deployed acceptance:

| Observation | Source and design consequence |
| --- | --- |
| Administrative courses show enrollment counts but no individual membership management | `apps/web/src/components/workspace/admin-courses.tsx`, `apps/api/src/modules/products/admin-products.repository.ts`; the latter counts all relation rows. Revocation requires ACTIVE-only counting. |
| CourseEnrollment has a unique user/product pair and creation timestamp, with no status/version | `apps/api/prisma/schema.prisma`; preserve existing IDs/pairs and add lifecycle fields. |
| Self-enrollment locks user then product; current detail/library/playback treat membership existence as access | `courses/courses.service.ts`, `courses.repository.ts`; update every authorization consumer, not only the new admin endpoint. |
| Account-support mutations recheck current identity, password and versions and share audit transactions | `administration/directory.service.ts`; reuse this policy shape without suspending accounts or using privilege endpoints. |
| Directory projections expose bounded name/email/role/status and omit secrets | `administration/directory.repository.ts`, shared `validation/admin-directory.ts`; use the same identity minimization. |
| Public registration creates a learner session as well as a User | `auth/services/auth.service.ts`; direct administrative creation must use UserEntity/IUserRepository/IPasswordHasher and must not call public registration or install learner cookies. |
| Password hashing uses bcryptjs with 12 rounds; shared registerSchema validates name 2–100, normalized email max254, password 8–128 | `auth/services/bcrypt-password-hasher.service.ts`, shared `validation/index.ts`. Installed bcryptjs3.0.3 `index.js` documents UTF-8 truncation above72 bytes; reject that input on the new creation route rather than silently truncate. |
| User repository normalizes email, preserves a unique email constraint and maps create uniqueness errors | `users/repositories/user.repository.ts`; translate a racing duplicate to safe ACCOUNT_EXISTS, never overwrite the existing account. |
| Workspace BFF uses exact route/schema/error allowlists and actor-bound session-serialized writes | `apps/web/src/lib/workspace/server.ts`, `client.ts`. Existing `admin/users/lookup` maps to privileged access and is not a candidate lookup endpoint. |

**Confirmed from documentation:** [known gaps](../../../.context/known-gaps.md) records an independently reproduced learner locale/player-remount regression. Report it honestly during later regression checks without weakening assertions.

**Unknown:** target migration state, production Redis/hosting behavior and deployed acceptance. Some existing guides contain committed conflict markers; leave unrelated cleanup outside this task. Existing password recovery is unavailable in its current public service binding; this plan does not depend on recovery.

## Design and boundaries

Extend CourseEnrollment with lifecycle/version fields, share transition rules through a focused enrollment writer, and add a guarded administrative service/controller/repository beside the existing course module. That administrative service owns direct account creation plus enrollment in one transaction. Existing auth, user repositories and password hashing remain the identity authority; public signup/login interfaces stay compatible.

Hard-deleting membership loses stable history and allows immediate self-re-enrollment, so retain revocation. Separate HTTP account-creation and enrollment submissions could leave an orphan account when the second fails, so use one create-and-enroll endpoint with ordered writes. Invitation provisioning was considered and superseded by the explicit user choice above.

Apply backend/API, database, security, frontend/UX and QA review perspectives. These are responsibilities, not authorization to delegate. Courses are platform-global: add no farmId. Existing roles, farms, subscriptions, orders, progress and certificates are unaffected by membership operations. Created users have role LEARNER, status ACTIVE, isEmailVerified=false and no phone or privileged-role fields. They can use ordinary login with the admin-supplied password. No session is issued during administrative creation.

## User experience

1. `/admin/courses`: the actual learner count and a named management action link to `/admin/courses/[id]/learners`; retain the responsive semantic course table. Do not fetch each row's learners on list load.
2. The learner page shows course title/publication, unfiltered active/revoked totals and a paginated table with name/email, account status, membership status, original/latest enrollment dates and actions. Filters: name/email and ACTIVE/REVOKED/ALL; default ACTIVE. Default20/max100 rows, cursor paging. ACTIVE counts include nondeleted suspended accounts' active memberships; show account status separately. Omit deleted identities from lists/counts while retaining stored history.
3. A learner name opens existing `/admin/users/[id]`, with a paginated Courses section and the same remove/restore actions. Include course publication/deletion status and membership dates. Historical soft-deleted courses remain visible as unavailable, with no public link or write action.
4. Add user offers Existing user and Create new user. Existing search selects a specific UUID and shows course/account/membership before confirmation. Already active is a safe no-op; revoked offers explicit Restore. Inactive/deleted/pending/administrative targets cannot be added.
5. Create new user collects name, email, password and confirm password. A separate confirmation collects administrator password and a 10–500 character reason and identifies the course/user. Label the submit action “Create account and enroll”. Validate names2–100, normalized email max254, password8–128 characters with UTF-8 maximum72 bytes, and matching confirmation. `newUserPassword` and `actorPassword` are distinct fields; confirmation is client-only. Passwords are masked by default with accessible reveal controls and appropriate new-password/current-password autocomplete.
6. Show “Account created and enrolled” only after the committed API response. Email already exists→clear password fields, show conflict and offer explicit existing-user selection; do not overwrite or automatically enroll it. Explain the administrator arranges credential handoff directly; the application never emails, echoes, stores a retrievable password, or treats account creation as email ownership verification.
7. Remove/restore confirmations show both user and course and require reason/admin-password confirmation. Adding uses the same policy. Removal explains protected application access will stop and admin restore is available.
8. Preserve nonsecret name/email/reason fields on errors. Clear password/confirmation fields after each completed submit attempt (including failure or timeout), dialog close, navigation or session/actor change; never persist them in browser storage, URLs, shared caches or diagnostics. Require re-entry for a failed attempt. Prevent duplicate clicks. After uncertain creation acknowledgement, query the submitted exact email and current membership for explicit review; never blindly resubmit account creation or claim the original operation succeeded solely from a matching account. Keep the submitted identity snapshot separate from editable fields.
9. Refresh related counts/views after confirmed writes, reload/reset cursors after last-row removal, revalidate on focus/return, and discard out-of-order searches. No optimistic success or persistent PII cache. Handle loading, empty, denied, validation, unavailable, retry and offline states.
10. Bangla default/selectable English, Tailwind-only styling, existing WorkspaceGate/dialog/field/session primitives, full-width admin shell and unchanged learner layouts. Validate 320/768/1440px, keyboard/focus return/screen readers, long Bengali names/emails and 200% reflow.

## Persistence, transitions and concurrency

CourseEnrollment additive fields:

- `status:ACTIVE|REVOKED`, default ACTIVE; `version:int`, default0 and nonnegative.
- `source:SELF|ADMIN`, default SELF for legacy rows, meaning latest activation source.
- `updatedAt` and `activatedAt` timestamps: initialize existing rows from their original createdAt; preserve createdAt and ID. Restore increments version, updates activatedAt and clears revocation fields.
- `revokedAt` and `revokedById` nullable; latter is a Restrict User FK. ACTIVE has neither value; REVOKED has both, enforced by CHECK.
- Preserve unique `(userId,productId)` and existing `(userId,id)` index; add `(productId,status,id)` and `(userId,status,id)` for bounded views. Counts filter ACTIVE plus nondeleted user.

Transitions: absent→ACTIVE through SELF/admin ADD/create-and-enroll; ACTIVE→REVOKED through admin REMOVE; REVOKED→ACTIVE through explicit admin RESTORE only. Self-enroll of REVOKED returns403 COURSE_ENROLLMENT_REVOKED. Repeated active add/self-enroll creates no row/event. Existing REMOVE/RESTORE require expectedVersion before any no-op decision; stale version→409. ADD expects null version; an already-active row may return unchanged, a revoked row returns409 and never restores it.

No invitation persistence, reset tokens, mail jobs or User schema extensions are needed. Create-and-enroll validates request/current actor and rate limits, verifies actorPassword and hashes newUserPassword with the injected bcrypt12 hasher before starting a transaction. Inside it: lock actor/current authorization and compare password/version snapshots → recheck existing normalized email, including soft-deleted reservations → insert active LEARNER User → lock eligible Product → create ACTIVE membership/source ADMIN → persist USER_CREATED_BY_ADMIN and COURSE_ENROLLMENT_ADDED → commit. Reject duplicate email instead of changing the existing password/name/role/status. A PostgreSQL unique constraint, not preflight alone, resolves simultaneous public signup/admin creation.

Known existing actor/target user rows are locked in sorted UUID order → product → membership; new target User is inserted after actor locking and before the product/membership writes. All writers use the same ordering and lock Product even when membership is absent. Do not hold transactions during hashing, Redis calls or remote I/O. Bound serialization/deadlock retries to two and repeat full authorization/state checks; uniqueness/version conflicts are not retried as a different intent. On create failure roll back User, membership and both audit records; rollback failure is an operational error, not reported success.

Record redacted audit events COURSE_ENROLLMENT_ADDED/REVOKED/RESTORED and USER_CREATED_BY_ADMIN with actor, target, course, trace ID, reason and safe before/after membership version/status. Event-specific safe snapshot keys are enrollmentStatus/enrollmentVersion/productId/targetUserId; preserve the existing account-status field meaning. Add explicit ADMIN operational allowlist and safe reason/snapshot projections. No password/plaintext/hash, email contact values, request bodies, learner tokens or private profile snapshots in audit/logs.

## API and shared contracts

All paths below are **proposed**, under `/api/v1`, for current ADMIN/SUPER_ADMIN, wrapped once in the existing response envelope, with `Cache-Control:private,no-store`. Strict shared Zod input/output schemas, UUID paths, body maximum8KiB and exact BFF method/path/error mappings apply. Same-origin protection and actor binding apply at the web boundary; API authorization remains independent.

| Method/path | Contract |
| --- | --- |
| GET `admin/courses/:id/enrollments` | limit default20/max100, cursor?, search max100?, status ACTIVE/REVOKED/ALL default ACTIVE. Course summary, unfiltered counts, items and nextCursor; deleted course404. |
| GET `admin/directory/users/:id/courses` | Same paging/status, no search; user identity, historical course membership rows and nextCursor; deleted target404. |
| GET `admin/courses/:id/enrollment-candidates` | Exactly one of search2–100 or normalized exact email max254, limit default20/max20, cursor?. Ordinary nondeleted identity/status and current membership/version/canAdd/canRestore/safe denial. Exact email is a separate filter so long valid addresses can be reconciled. |
| POST `admin/courses/:id/enrollments` | `{userId,expectedVersion:null,reason,actorPassword}`→`{enrollment,changed}`. |
| POST `admin/courses/:id/enrollments/:userId/actions` | `{action:REMOVE|RESTORE,expectedVersion:int>=0,reason,actorPassword}`→`{enrollment,changed}`. Restore requires active ordinary target/eligible course; remove can target suspended/pending ordinary accounts. |
| POST `admin/courses/:id/enrollments/create-user` | `{name,email,newUserPassword,reason,actorPassword}`→`{accountCreated:true,enrollment}` only after atomic account+membership+audit commit. No role/status/verified/phone/userId/confirmation overrides accepted. No password, passwordHash, refresh/access token or session returned. Existing normalized email, including soft-deleted reservation→409 ACCOUNT_EXISTS. |

`AdminCourseEnrollment={id,userId,productId,status,version,source,createdAt,activatedAt,revokedAt,user:{id,name,email,role,status}}`. User-centric rows replace user with minimal course summary. Use ISO timestamp strings; no invented progress/completion data. Error responses must not echo validated/rejected password values or unknown request keys/values.

Errors:422 VALIDATION_FAILED;401 unauthenticated;403 forbidden identity/target, PASSWORD_CONFIRMATION_FAILED or COURSE_ENROLLMENT_REVOKED;404 unavailable course/user;409 ENROLLMENT_VERSION_CONFLICT, ACCOUNT_EXISTS or COURSE_NOT_ENROLLABLE;429 RATE_LIMITED with Retry-After;503 RATE_LIMIT_UNAVAILABLE or ENROLLMENTS_UNAVAILABLE. Duplicate-email conflict never becomes password reset, account reactivation or automatic enrollment. After an unknown result the UI performs explicit identity/membership reconciliation, then lets the admin select an existing user or retry creation with re-entered passwords.

Existing learner detail returns only ACTIVE enrollment; revoked→enrollment:null plus optional enrollmentRestriction:ADMIN_REVOKED. Library omits revoked; protected playback requires ACTIVE. Public demos remain available. Translate revocation, disable self-enroll, and close the protected embed on a definitive revoked response at mount/lesson-switch/focus revalidation. Existing YouTube sources/buffered media cannot be recalled by an application membership change; enforcement covers subsequent application requests and revalidation.

## Security and release gates

- Current-primary role/status/authorizationVersion for private reads and inside writes; compare locked actor password/version after fresh password confirmation. No trust in client canAdd flags/token roles, no learner impersonation, and no privileged-account creation.
- Redis limits across instances: enrollment writes30/admin/15min; create-and-enroll additionally5/admin/15min; candidates60/admin/min. Failed passwords count; create requests consume both write/create limits before expensive hashing. Fail closed when Redis is unavailable. In-memory fallback is not production rate-limit evidence.
- HTTPS private requests only. Neither server nor BFF diagnostic/error/analytics hooks may log bodies/passwords; tests inspect success/error/audit outputs with synthetic password sentinels. No background email/SMS credential transmission. Only the irreversible bcrypt12 password hash persists in the existing User password field; do not mark email verified or create a refresh-token record.
- `ADMIN_COURSE_ENROLLMENTS_ENABLED=false` by default gates the new admin endpoints/UI. Disabling it never disables learner ACTIVE/revocation enforcement. No new public auth endpoint or provider requirement is introduced.
- Rehearse additive migration with populated disposable PostgreSQL16; preserve user/product/membership IDs, data and original dates; assess index/lock costs and backup restore. Build shared→API→web. Deploy schema→all API replicas enforcing ACTIVE→web→enable admin writes; drain old replicas before enabling.
- Rollback disables new writes and may revert UI; keep additive schema and ACTIVE-aware API. Never return to membership-existence authorization after revocations. Restoring a backup predating revocation can restore access: keep protected enrollment/playback access unavailable until post-backup revocations have been reconciled from independently retained audit/incident evidence. Do not infer current access from an old backup.

Acceptance requires: real PostgreSQL add/remove/restore/create races and audit rollback; public signup racing admin creation; provided password works in ordinary login while admin session remains unchanged; exact-email conflict/timeout reconciliation; two-view counts/paging/index evidence; real Redis limits; bilingual accessible UI and existing learner/admin/auth regressions; target hosting/migration acceptance under separate deployment authorization. The user subsequently authorized implementation with “implement it”; local evidence is recorded in the plan and execution ledger.

Excluded: invitation/email onboarding, bulk import, paid checkout/refunds, progress/certificates, arbitrary role/account changes, password-reset/forced-password-change features, unfinished recovery and unrelated merge-marker/player-locale fixes. Human-managed Git: no agent staging/commit/merge/push.
