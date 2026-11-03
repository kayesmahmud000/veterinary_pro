# Administrative course enrollment management implementation plan

> For agentic workers: use `executing-plans` for sequential implementation after the user requests execution. No subagent method is selected. Checkboxes retain the original execution checklist; the implementation/evidence summary below records actual delivery and remaining release gates. Human-managed Git overrides skill commit steps: no staging, commit, merge or push.

**Goal:** Administrative course/user enrollment directories, audited add/remove/restore, and direct name/email/password account creation followed by enrollment.

**Architecture:** Extend CourseEnrollment lifecycle and use one shared transition writer for learner/admin paths. A focused administrative service creates User→CourseEnrollment→both audit records in one transaction, using existing user repositories and bcrypt12 hashing without issuing a learner session. Preserve existing public auth contracts.

**Tech stack:** Existing NestJS/Prisma/PostgreSQL, shared Zod/TypeScript, Next.js/React/Tailwind and Redis limits. No new dependency or mail integration.

**Spec:** [spec.md](spec.md). Date/revision:2026-11-02 / `471875f`. Status: implemented locally; operator release gates remain. The user's explicit direct-account-creation choice supersedes the initial invitation proposal and its nine-task execution draft. The revised plan has seven tasks.

**Scoped database repair,2026-11-03:** the user separately authorized the configured-database enrollment migration after missing `course_enrollments.status` caused admin product/library reads to fail. Only `20261102090000_admin_course_enrollments` was applied. Six legacy enrollments were preserved, real product/library reads passed, and the other four pending migrations were excluded. [Repair evidence and remaining session/release limits](execution.md#authorized-repair-outcome--2026-11-03). This does not enable the administrative feature flag or certify a new application deployment.

**Enrollment availability and roster follow-up,2026-11-03:** the subsequent503 with `ENROLLMENTS_UNAVAILABLE` is the existing default-disabled `ADMIN_COURSE_ENROLLMENTS_ENABLED` gate, not the repaired database column. Keep the gate/authorization/Redis protections; document the backend environment variable and redeployment requirement, and allow it through Turbo's strict environment. The current workspace has no Vercel credentials, so provider-side enablement remains with the operator. Implement the requested course-name heading and separate-column learner table, plus a product-detail title fallback when the enrollment endpoint is unavailable. Verify rendered bn/en success/error states, styles/types, isolated production build and the existing ADMIN/SUPER_ADMIN browser flow at320/768/1440px. No additional migrations or live account/enrollment mutations are authorized by this UI follow-up.

## Global constraints

2026-11-03 icon refinement: replace the remove row button text with the existing Lucide trash icon in red; retain its localized accessible name,44px target and existing confirmation flow. Verify the existing rendered/boundary suites, styles/build and administrative enrollment browser flow. No backend or live configuration changes.

- New account inputs are name/email/newUserPassword; administrator confirmation uses a separate actorPassword. Never call public AuthService.register or replace administrator cookies.
- Fixed new role LEARNER/status ACTIVE/isEmailVerified=false; no session/refresh token or invitation record. Existing account roles/credentials remain unchanged.
- User creation precedes enrollment in one transaction; any enrollment/audit failure rolls back all new records. ACCOUNT_EXISTS never means overwrite/reset/automatic add.
- One unique user/product pair; REVOKED→ACTIVE only by explicit administrator RESTORE. Old and new learner paths always enforce ACTIVE even if admin feature is disabled.
- Current primary identity/password/version checks; reason10–500, name2–100, normalized email max254, password8–128 with UTF-8 max72 bytes on the new endpoint. Confirm-password is client-only; reject password truncation and secret echoing.
- Page20/max100, candidates20/max20, search2–100 for candidates or separate exact-email max254; body8KiB. Strict Zod and `/api/v1` contracts; no arbitrary BFF proxy.
- Redis writes30/admin/15min and creation additionally5/admin/15min; candidates60/admin/minute; fail closed if distributed limiter unavailable.
- Bangla default/English, Tailwind-only, existing full-width admin shell and learner widths; 320/768/1440px and 200% reflow.
- Active schema `apps/api/prisma/schema.prisma`, additive migration, no live migration/deployment. Preserve paused ROADMAP work, unrelated changes and existing player-locale regression evidence.

## Review focus

1. Remove racing self-enroll/admin add must never restore REVOKED; Tasks2/3/7 own real-db coverage.
2. Public signup or another admin creating the same email must preserve the winner's account/password and leave no orphan membership; Task4.
3. Passwords must never appear in response/audit/log/error/storage; learner tokens must never change the admin session; Tasks4/5/6.
4. Demoted actors, changed password/auth versions, foreign course/user IDs, and paid/unpublished courses must be denied atomically; Tasks3/4/5.
5. Timeout after committed creation, last-row removal, stale tabs and session changes must reconcile safely without duplicate creation or false success; Tasks5/6/7.

## Prerequisites and file structure

Read the spec/repository entry point and recheck source/Git at execution start. The user authorized implementation after selecting direct administrative creation. Existing instructions, source/tests and current registration/password policies remain authoritative where unchanged.

Existing touchpoints:

- `apps/api/prisma/schema.prisma` and a new additive migration; shared `validation/{index.ts,youtube-courses.ts,admin-directory.ts}`.
- `apps/api/src/modules/courses/{courses.repository.ts,courses.service.ts,courses.module.ts}`, `products/admin-products.repository.ts`, `administration/directory.repository.ts` and adjacent tests.
- Existing `users/entities/user.entity.ts`, repository interface/implementation and `auth/services/{password-hasher.interface.ts,bcrypt-password-hasher.service.ts,auth.service.ts}` as dependencies; do not rewrite public auth for this feature.
- `apps/api/src/config/{env.schema.ts,env.service.ts}` and tests for the admin feature flag; existing WorkflowRateLimitModule.
- Web `lib/workspace/{server.ts,contracts.ts}`, `components/workspace/{admin-courses.tsx,admin-directory.tsx}`, `lib/i18n/{admin-courses.ts,courses.ts}`, learner detail/player/library handlers, and validated role-return helpers discovered in `lib/auth/server.ts`/`lib/workspace/navigation.ts`.

Planned new units:

| Path | Responsibility |
| --- | --- |
| `packages/shared-types/src/validation/admin-course-enrollments.ts` | Safe directories/candidates/actions/create-user contracts |
| `apps/api/src/modules/courses/course-enrollment-writer.service.ts` | Shared locked membership transition/version policy |
| `apps/api/src/modules/courses/admin-course-enrollments.controller.ts` | Exact guarded admin endpoints, including user-centric list |
| `apps/api/src/modules/courses/admin-course-enrollments.service.ts` | Administrative read/mutation/create-and-enroll use cases |
| `apps/api/src/modules/courses/admin-course-enrollments.repository.ts` | Bounded directory/candidate/count queries and projections |
| `apps/web/src/app/(workspace)/admin/courses/[id]/learners/page.tsx` | Course learner-management entry |
| `apps/web/src/components/workspace/admin-course-enrollments.tsx` | Course list and embedded AdminUserCourses section |
| `apps/web/src/components/workspace/admin-course-enrollment-actions.tsx` | Existing-user add/remove/restore confirmations |
| `apps/web/src/components/workspace/admin-course-user-create.tsx` | Name/email/password/confirmation and create-and-enroll recovery |
| `apps/web/src/lib/i18n/admin-course-enrollments.ts` | Complete bn/en content and errors |

Tasks run in order because they share persistence/contracts. Each task uses failing tests→minimal implementation→scoped verification→review. Do not claim runtime acceptance from static tests. All new test/harness/runbook paths below are planned, not existing files.

## Task 1 — Shared contracts and additive membership persistence

**Files:** active schema/new migration; new shared validation file and existing exports/learner/audit contracts. Create `apps/api/src/modules/courses/admin-course-enrollment-contracts.spec.ts` and `admin-course-enrollments.migration.spec.ts`.

**Interfaces produced:** AdminCourseEnrollment, AdminCourseEnrollmentQuery/List, AdminUserCourseList, AdminCourseCandidateQuery/List, AdminEnrollmentAddInput, AdminEnrollmentActionInput, AdminEnrollmentMutationResult `{enrollment,changed}`, AdminCourseUserCreateInput `{name,email,newUserPassword,reason,actorPassword}`, AdminCourseUserCreateResult `{accountCreated:true,enrollment}`, and matching camelCase `*Schema` exports.

- [ ] Add strict-contract tests for names/email normalization,8–128 characters and UTF-8 max72 bytes (ASCII/Bengali/emoji boundaries), reason/page bounds, candidate exact-email vs search exclusivity, UUIDs and unknown role/status/emailVerified/userId/confirmation fields. Safe create responses cannot contain password/hash/tokens. Rejected secret input must not be echoed.
- [ ] Build shared types and run `pnpm --filter @vetralink/api exec jest --runInBand admin-course-enrollment-contracts`; record failure for missing new behavior.
- [ ] Add status/version/source/timestamps/revocation fields and checks/indexes exactly as specified. Legacy timestamps derive from createdAt; preserve membership IDs, uniqueness and original rows. No invitation/User schema additions or root-schema edits.
- [ ] Run `pnpm --filter @vetralink/shared-types build`, contract tests and `pnpm --filter @vetralink/api exec prisma validate`. Add migration rehearsal tests using ENROLLMENTS_TEST_DATABASE_URL restricted in test code to task-owned loopback `/course_enrollments_test`; refuse unsafe host/database before connecting.
- [ ] Rehearse populated PostgreSQL16 preservation, constraints/indexes and locking cost; record executed results rather than counting skipped opt-ins. Review safe audit snapshot keys separately from account status semantics.

## Task 2 — Shared membership writer and learner authorization

**Files:** new writer; existing courses repository/service/module, product relation counts; tests `course-enrollment-writer.spec.ts`, existing `courses.spec.ts`, `courses.database.spec.ts`, `products/admin-products.spec.ts` and `admin-course-curriculum.database.spec.ts`.

**Interfaces produced:** `CourseEnrollmentWriter.lock(productId:string,userId:string,tx:Prisma.TransactionClient)` returns module-private locked product/membership context; `activateLocked(context,mode:'SELF'|'ADD'|'RESTORE',expectedVersion:number|null|undefined,tx)` and `revokeLocked(context,actorId:string,expectedVersion:number,tx)` return `{enrollment,changed}`. Callers first lock existing user identities. Public-service source determines mode; request data cannot supply mode/context. Use-case audit remains in caller's transaction.

- [ ] Add failing tests for revoked self-enroll/playback403, detail null+ADMIN_REVOKED, library omission and ACTIVE/nondeleted counts. Preserve public-demo, ordinary nonmember and active idempotency/projection tests.
- [ ] Run `pnpm --filter @vetralink/api exec jest --runInBand courses.spec course-enrollment-writer admin-products.spec`; establish red, then implement the writer and update all consumers discovered with `rg 'courseEnrollment|courseEnrollments|membership\(' apps packages`.
- [ ] Preserve user→product→membership lock order, single row/event for first self-enroll and audit rollback. Membership changes never increment product content version or grant paid access.
- [ ] Run scoped tests and real-db races for first-enroll/first-enroll, self-enroll/remove and remove→self-enroll→restore. Review filtered counts, minimal selections and old response compatibility.

## Task 3 — Guarded admin directories/add/remove/restore

**Files:** new admin controller/service/repository, courses.module.ts composition, directory.repository.ts safe operational audit projection. Create `admin-course-enrollments.spec.ts`, `.http.spec.ts`, `.database.spec.ts`.

**Interfaces produced:** `AdminCourseEnrollmentsService.list(claims,courseId,query):Promise<AdminCourseEnrollmentList>`, `userCourses(claims,userId,query):Promise<AdminUserCourseList>`, `candidates(claims,courseId,query):Promise<AdminCourseCandidateList>`, `add(claims,courseId,input)` and `act(claims,courseId,userId,input):Promise<AdminEnrollmentMutationResult>`. Consume Tasks1/2 and injected existing user/password/transaction/audit/limiter dependencies.

- [ ] Add real-controller/service tests for both admin roles, denied ordinary/inactive/demoted/stale actors, wrong admin password, foreign IDs, ineligible targets/courses and version conflict. Cover revoked ADD denial, suspended-target removal, deleted-target privacy and read-only legacy admin targets.
- [ ] Run `pnpm --filter @vetralink/api exec jest --runInBand admin-course-enrollments directory.spec`; implement current-primary reads, fresh password check and locked actor snapshot rechecks, writer transitions and same-transaction audit.
- [ ] Add bounded two-view/candidate queries, search vs exact-email support, deleted-course history and real counts. Register routes/WorkflowRateLimitModule; do not reuse privileged-role lookup or mechanically add farm scope.
- [ ] Run tests and real PostgreSQL add/add, remove/remove, restore/remove, suspend/add, demotion/action, stale-version and audit-failure races. Verify pages over100 synthetic users, no N+1 detail fetches, minimal PII and query plans for both indexes.
- [ ] Review literal audit allowlist plus safe reason/snapshot visibility for ADMIN. Use event-specific membership fields; unknown security audit events remain Super-only.

## Task 4 — Direct administrative account creation and enrollment

**Files:** admin service/controller/contracts from Tasks1/3; new `admin-course-user-create.spec.ts`, `.http.spec.ts`, `.database.spec.ts`; existing user repository dependencies and auth tests. Add feature flag env schema/service/config tests here. No public-auth controller change is needed.

**Interface produced:** `AdminCourseEnrollmentsService.createUserAndEnroll(claims:JwtPayload,courseId:string,input:AdminCourseUserCreateInput):Promise<AdminCourseUserCreateResult>` on POST `admin/courses/:id/enrollments/create-user`. Inject existing IUserRepository/IPasswordHasher/ITransactionManager/IAuditLogRepository. Match the fixed new-user state from the spec and produce no session.

- [ ] Add failing tests that create with supplied name/email/password, persist only bcrypt12 hash, leave email unverified/role LEARNER/status ACTIVE, create membership source ADMIN after the User, and return no credentials/tokens. Reject forged privilege/state fields, duplicate/soft-deleted email reservations, invalid course, wrong admin password, stale authorization and >72-byte multibyte passwords.
- [ ] Add transaction tests: membership or either audit failure removes all new account/membership/events; public AuthService.register racing creation preserves winner's account/password; two admins creating same email produce one account and one membership at most; failed creation never automatically enrolls an existing user. Use distinct synthetic administrator and new-user password sentinels.
- [ ] Run `pnpm --filter @vetralink/api exec jest --runInBand admin-course-user-create auth.service.spec`; establish failure, then implement rate limits/password confirmation/hashing outside tx, actor lock/recheck, normalized-email conflict check (including deleted reservations), User insert, eligible product/membership write and both redacted audit events inside tx. Map repository uniqueness conflict to ACCOUNT_EXISTS. Never call public register or issue refresh tokens.
- [ ] Enforce writes30/admin/15min, creation additionally5/admin/15min before hashing and candidates60/admin/minute with distributed Redis. Test two service instances, failed-password counting and Redis-down503. Add ADMIN_COURSE_ENROLLMENTS_ENABLED=false default; disabled feature never weakens learner revocation enforcement.
- [ ] Run real-db tests, then ordinary login with the supplied password and confirm successful learner access; administrator identity remains unchanged and creation inserted no refresh token. Review log/exception/audit output for sentinels. The learner's later login may create its own session normally.

## Task 5 — Private BFF and learner revocation UI

**Files:** workspace server/contracts; learner course-detail/player/library handlers and i18n/courses.ts as required by trace. Create `apps/web/scripts/check-admin-course-enrollments.mjs`; extend check-youtube-courses and existing course browser cases.

**Interfaces consumed/produced:** exact six admin routes from the spec and Task1 schemas, including create-user; sanitized documented errors and learner revocation restriction. Keep public course endpoints unchanged.

- [ ] Add failing real-handler tests for methods/UUIDs/query/body/output bounds, role denial, same-origin checks, actor binding, no-store responses and disabled feature. Prove exact-email candidate mapping is distinct from privileged lookup.
- [ ] Add exact allowlists/error mapping and create-user request redaction in all BFF diagnostic/error paths. Assert creation returns no Set-Cookie or learner token and preserves existing administrator cookies; forbid password echo from malformed upstream/schema failures. Existing session-lock/refresh behavior stays intact.
- [ ] Handle revoked detail/playback distinctly: disabled self-enroll, localized removed-access state, protected player close on definitive revocation at focus/lesson refresh; network failure offers retry without a false membership claim. Demos and other course/account access remain unchanged.
- [ ] Run `pnpm --filter @vetralink/web exec node --test scripts/check-admin-course-enrollments.mjs scripts/check-youtube-courses.mjs`, `pnpm --filter @vetralink/web test:workspace`, `pnpm --filter @vetralink/web test:protected-routes`, `pnpm --filter @vetralink/web test:auth`. Extend browser regression for remove→focus/playback denial→restore and retain baseline locale-remount reporting.

## Task 6 — Course/user directories and create-account UI

**Files:** new learners page/three components/translations from file map; existing admin-courses.tsx/admin-directory.tsx and role-return helpers. Create `apps/web/scripts/admin-course-enrollments-browser-cases.mjs`; add `WORKSPACE_BROWSER_FOCUS=admin-enrollments` to check-dashboard-browser.mjs and extend the scoped Node checks.

**Interfaces produced:** `AdminCourseEnrollments({courseId})`, `AdminUserCourses({userId})` and `AdminCourseUserCreate({courseId,onCreated,onClose})` consuming safe Task1 types/Task5 BFF. One shared action flow powers both course/user views.

- [ ] Add failing bilingual ADMIN/SUPER browser journeys: count→learners→user courses, select existing add/remove/restore, create with name/email/password/confirmation, successful immediate enrollment, ordinary learner login. Verify admin stays signed in and no invitation or signup step is presented.
- [ ] Implement list filters/cursors/counts and existing/create-new selection, explicit fixed LEARNER role, labelled distinct admin/new-user password fields, safe reveal/autocomplete and localized length/UTF-8/confirmation errors. Confirm user/course/reason before submission. Read-only/ineligible/draft/deleted/paid states have accurate copy.
- [ ] Implement synchronous duplicate guard and success-only count refresh. Clear all secret fields after each attempt/close/navigation/session change while retaining nonsecret fields. Test timeout after commit, original submitted exact-email reconciliation despite edited fields, conflict without credential overwrite, last-row removal, stale tabs/out-of-order search and logout/Back/actor switch. Never persist credentials or automatically resubmit creation; existing-user action requires explicit selection.
- [ ] Run scoped Node tests, `pnpm --filter @vetralink/web check:styles`, `pnpm --filter @vetralink/web test:styles`; build an isolated production web copy using existing harness instructions. Run `WORKSPACE_BROWSER_FOCUS=admin-enrollments WEB_TEST_BUILD_DIR=<absolute-isolated-web-app> pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs`, setting CHROME_PATH/CHROME_NO_SANDBOX only when required by the test environment.
- [ ] Inspect rendered screenshots/focus/Chrome accessibility at320/768/1440px, bn/en, long strings, keyboard/Escape/focus return/touch controls and200% reflow without overflow. Record alternate-browser limits accurately.

## Task 7 — Integrated acceptance and release/recovery handoff

**Files:** this spec/plan and adjacent runbook.md; create scoped `apps/web/scripts/check-admin-course-enrollments-integration.mjs` and `apps/api/scripts/check-course-enrollments-migrations.mjs` with disposable-target guards. Preserve historical parent evidence and paused roadmaps.

**Deliverable:** real isolated BFF/API/PostgreSQL/Redis/browser acceptance and explicit production gates, independent of deployment authorization.

- [ ] Rehearse populated pre-feature migration and backup restoration on task-owned PostgreSQL16; compare original user/product/membership IDs/dates, defaults/checks/indexes and lock observations. Never connect test mutation code to configured/live databases.
- [ ] Run real BFF→API→DB journeys for direct create/add/remove/restore, ordinary learner login, admin session preservation, two-view count agreement, conflict/timeout reconciliation and failed-audit rollback. Reproduce signup/create and revoke/self-enroll races with real transactions and distributed limit failures with Redis.
- [ ] Build shared types, run scoped API contract/service/HTTP/database/create suites serially, then API build; run scoped web/auth/workspace/navigation/protected-route/style tests, isolated production build and browser focuses admin-enrollments/admin-courses/courses/directory. Record exact commands, executed counts, screenshots, failures and environment; skipped opt-ins are not passing evidence.
- [ ] Review→fix→retest→re-review lock ordering, safe audit/response projections, no password/token/cookie leakage, exact-email handling, counts and query plans. Retain the pre-existing locale/player-remount regression as an explicit limitation instead of removing assertions or reporting an all-green suite.
- [ ] Document feature enablement, schema→all ACTIVE-aware API replicas→web rollout, Redis configuration, current-role/learner smoke tests, independently retained audit/backup policy, post-backup revocation reconciliation and recovery access gate. Rollback disables new writes/UI but preserves ACTIVE-aware API/schema; do not run old existence-only authorization after revocations. Production target migration/hosting/smoke tests require separate authorization.
- [ ] Final handoff has no staging/commit/deployment. Suggested implementation commit: `feat(courses): add admin enrollment and direct learner creation`.

## Planning verification record (before implementation)

At the planning stage only documentation was changed; no account, enrollment, application code, schema, migration or live state had been changed. The user-selected direct-creation flow replaces the invitation design, so mail/provider/token/worker requirements are removed from execution scope. The original task checklists below/above describe the requested execution detail; implementation evidence now follows.

Source investigation covers current course/auth/user/directory/Prisma/BFF/UI code, installed password-hasher behavior and adjacent tests. Self-review checks: User precedes enrollment with atomic rollback; duplicate email never overwrites credentials; admin session remains intact; both password fields are treated as secrets; new-user email remains unverified; restore remains explicit; no mail dependency survives in the task/interface map.

Documentation verification on 2026-11-02 after the direct-creation revision:

- `python3 .context/scripts/validate.py` — PASS: 49 context Markdown documents, 401 local links, 100 source entries; all context documents reachable. This does not establish semantic or runtime acceptance.
- Read-only Python validation of the four changed documentation files — PASS: 74 local links resolve; seven tasks remain unstarted; no stale invitation routes/types, unresolved placeholders or whitespace errors in the new documents.
- `git diff --check` — PASS for tracked documentation edits; the Python check covers new untracked documents without staging. Existing unrelated conflict markers remain unchanged.
- Sequential self-review reconciled create-user request/result fields, actor vs new-user password handling, exact-email reconciliation including valid long addresses, duplicate/soft-deleted reservation handling, transaction/lock ordering, rollback and source-backed bcrypt UTF-8 limits. No independent or runtime audit is claimed.

Application tests/builds and real database checks were not run for this documentation-only change. Suggested documentation commit: `docs(courses): plan direct admin learner creation`.

## Implementation and local acceptance — 2026-11-02

The user authorized execution after selecting direct administrative account creation. Tasks1–6 are implemented; Task7's local integration/recovery verification and runbook are delivered. The original fine-grained checklist is retained as the planning baseline; this dated summary and [execution ledger](execution.md) own actual results. Target deployment/enablement remains an operator release gate rather than a completed action.

| Area | Actual evidence |
| --- | --- |
| Contracts/identity/privacy/policy | Contract RED11→GREEN11; final scoped API run10 suites/105 tests passed across new contracts/writer/admin/HTTP and adjacent course/product/directory/env suites. |
| Real database and distributed limits | `ENROLLMENTS_TEST_DATABASE_URL` and `ENROLLMENTS_TEST_REDIS_URL` opt-in run:2 suites/8 tests passed on disposable PostgreSQL16.6 and Redis8.0.5, including user-before-membership creation, normal login/no creation session, audit rollback, public-signup race, revocation/self-enroll/restore,105-row pagination/deleted identities, shared limits and unavailable Redis. A transient delayed-exit warning is retained in the log; the scoped command completed. |
| Existing persistence regressions | Existing learner/curriculum PostgreSQL suites:2 suites/12 tests passed after seeding their required historical product fixture in a separate disposable adm3_test database. |
| Migration | `apps/api/scripts/check-course-enrollments-migrations.mjs`:PASS populated legacy preservation/defaults/check constraints. `prisma validate`:PASS. Target/live migration was not executed. |
| Backup/restore | `apps/api/scripts/check-course-enrollments-restore.mjs`:PASS with PostgreSQL16 clients and16.6 server. A fresh restore reproduced stale ACTIVE access, then independently retained revocation evidence was reconciled through an audited current action while HTTP access remained closed. The helper rejects mismatched-major client tools. |
| Real HTTP/BFF integration | `apps/web/scripts/check-admin-course-enrollments-integration.mjs`:PASS actual Next BFF handler→Nest guards/controller/service→PostgreSQL/Redis creation, duplicate conflict, revoke/restore, user directory and cookie/privacy checks. JWT parsing and auth/me transport use controlled synthetic identity; current-primary resolution and mutation checks use real user persistence. |
| Web regressions | `node --test` over auth/workspace/navigation/protected routes/courses/new enrollment BFF/styles/Tailwind:71 tests passed. Response binding and Retry-After tests each observed RED→GREEN. |
| New browser flow | `WORKSPACE_BROWSER_FOCUS=admin-enrollments`:72 checks passed for ADMIN/SUPER_ADMIN, bn/en,320/768/1440px, existing add/remove/restore, direct create and user-centric course reads. Latest screenshots before final copy-only text refinement: `/tmp/khamar-workspace-qa-yUsyVA`; mobile Bangla and desktop English renders were visually inspected. |
| Adjacent browser flows | `admin-courses`:470 checks passed; `directory`:171 checks passed after its fixture gained the new course-list endpoint. No existing assertions were removed. |
| Revalidation/count regression | `course-revalidation`:6 checks passed; window-focus player restart reproduced RED2 instances vs1, then GREEN preserving the player and closing it only on definitive revoked state. `admin-enrollment-counts`:2 checks passed after RED missing focus refresh; focus and mutation events now refresh course counts. |
| Builds/styles | Shared types build, API production build, web TypeScript check and isolated Next15.5.28 production build passed. Tailwind policy and style tests passed. Final source/copy checks are recorded in the execution ledger. |
| Documentation | Context validator:49 Markdown documents,405 local links,100 source entries passed after feature/testing guide links were added. `git diff --check` passed. |

### Existing failures and limits

The full API command `pnpm --filter @vetralink/api test --runInBand --forceExit` ran266 suites (13 skipped):251 passed,2 failed;2306 tests passed,4 failed,203 skipped. The failures are the already documented Redis-free queue construction suite and idempotency store-selection suite; this feature does not alter those bindings. `--forceExit` prevents the existing suite's lingering handles from holding the process; it does not change failure results.

The full controlled learner `courses` browser focus reproduces the pre-existing “Language switch does not recreate active video” failure (2 instances vs1). The new focus/revocation check is separately green. Do not treat the full API or learner browser suites as all-green. A fresh reviewer reported actionable focus/count regressions which were fixed; its session did not complete a full verdict, so final review also relies on explicit sequential self-review and boundary tests.

Live migration, hosted Redis capacity, default-disabled feature enablement, target deployment smoke tests and alternate-browser/full assistive-technology acceptance are not claimed. No emails, live users, hosted configuration, staging, commits, merges or pushes were performed.

### Actual execution commands

Run shared build before dependent tests. From repository root:

- `pnpm --filter @vetralink/shared-types build`
- `pnpm --filter @vetralink/api exec jest --runInBand admin-course-enrollment-contracts admin-course-enrollments.http admin-course-enrollments.spec course-enrollment-writer courses.spec admin-products.spec directory.spec env.schema.spec env.service.spec global-exception`
- With explicitly disposable URLs, `pnpm --filter @vetralink/api exec jest --runInBand admin-course-enrollments.database admin-course-enrollments.redis`
- With explicitly disposable DB, `pnpm --filter @vetralink/api exec node scripts/check-course-enrollments-migrations.mjs` on a fresh database; restore helper additionally requires matching-major `ENROLLMENTS_TEST_PG_BIN`.
- With explicitly disposable DB/Redis, `pnpm --filter @vetralink/web exec node scripts/check-admin-course-enrollments-integration.mjs`
- `pnpm --filter @vetralink/web exec node --test scripts/check-auth.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-youtube-courses.mjs scripts/check-admin-course-enrollments.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`
- `WORKSPACE_BROWSER_FOCUS=<focus> WEB_TEST_BUILD_DIR=<isolated-built-web-app> pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs`; focuses and limits are listed above. CHROME_NO_SANDBOX was used only for this isolated Linux test harness.

Suggested implementation commit for the human maintainer: `feat(courses): add admin enrollment management and learner creation`.
