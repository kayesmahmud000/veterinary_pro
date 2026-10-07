# Backend implementation plan

Status: **Implemented and locally verified, 2026-10-07.** Production migration, rollout and real mail-provider acceptance remain release work.

Contract: [specification](spec.md). Historical investigation: [current state](current-state.md). Verification and operation: [runbook](operations.md). Inventory: [file impact](file-impact.md).

## Architecture

AuthModule retains authentication and exports CurrentIdentityService. New RoleRequestsModule owns questionnaires, applications and review; AdministrationModule owns privileged changes. Controllers validate and delegate; services enforce live actor/object permissions; repositories share Prisma transaction clients. RoleEventsModule supplies lightweight transactional outbox/audit dependencies. MailProviderModule binds the existing mock/Resend/SES providers; the separate RoleNotificationsWorkerModule runs dispatch/processing without the order-mail processor.

FarmsModule now owns onboarding and authorized discovery. Platform UserRole and tenant FarmRole remain separate. RolesGuard has exact allowlists; SUPER_ADMIN is explicitly present on supported legacy routes, while LEARNER-only application submission and FARMER-only onboarding have no implicit bypass.

## Persistence changes

Only apps/api/prisma/schema.prisma and its migration history are active. The divergent root schema is untouched.

| Storage | Implemented change |
| --- | --- |
| UserRole / User | Add LEARNER and omitted-role default; roleVersion, authorizationVersion, previousNonAdministrativeRole, farmerOnboardingRequired |
| FarmerOnboarding | Durable submission key/hash, resulting farm and completion metadata |
| RoleUpgradeRequest | Immutable versioned answers, target, locale, decision/version/reviewer, separate public reason/private notes |
| RoleNotificationOutbox / Delivery | Unique event and recipient ledger, leases, retries, accepted/skipped/failed states |
| VetProfile | Reviewed VET approval initializes an unavailable profile in the approval transaction |

Three additive migrations add the enum separately before using it, expand models/defaults, and strengthen terminal-state checks. Constraints include one PENDING request per applicant, unique submission key, valid non-administrative fallback, nonnegative versions, bounded JSON, supported locale, no self review, required rejection reason and required VET verification note.

Existing users retain their roles and initial version zero. The new database onboarding default is false, preserving legacy FARMER access; new FARMER creation and LEARNER→FARMER approval explicitly set true. No legacy roles are reassigned and no historical approvals are invented.

## Auth/session changes

Public signup accepts LEARNER/FARMER/VET/BUYER, defaults LEARNER, and validates independently through DTO/service/shared Zod. Login accepts all six stored canonical roles. Safe responses include roleVersion and farmerOnboardingRequired, excluding security versions, password hashes and tokens from browser JSON.

Every protected HTTP request resolves status, role and authorizationVersion from the primary database. Old access tokens fail with AUTHORIZATION_CHANGED after a role change. Approval retains refresh sessions so clients can rotate into the new role; privileged changes and logout-all revoke refresh sessions and increment authorizationVersion. Login writes lastLogin narrowly under a live user lock; refresh locks user then token, consumes atomically, and commits reuse invalidation before returning 401.

Versionless legacy access tokens are accepted only until an explicitly configured absolute AUTH_LEGACY_CLAIMS_UNTIL deadline, with stored version zero and matching role. Unset means deny. Set the deadline within the previously issued access-token lifetime at cutover.

Socket connection and each incoming event resolve the live primary identity and consultation membership. Before each room broadcast, every receiving socket is checked again; stale sockets receive no protected payload. A five-second check disconnects idle expired/revoked sockets across adapter-visible instances. No Redis security-event/pubsub invalidation consumer is required by this implementation.

## API contract

All paths are below /api/v1. Authentication uses existing auth/register, auth/login, auth/me, auth/refresh and logout endpoints.

| Method / path | Access and result |
| --- | --- |
| GET farms/onboarding; POST farms/onboarding | FARMER; status or idempotent create/confirm existing membership |
| GET farms/my | Authorized professional/admin farm summaries; incomplete farmers may discover their existing memberships |
| GET/POST farms/:farmId/members | Live tenant membership; OWNER/MANAGER may add existing account by email or UUID; only OWNER may assign OWNER |
| GET role-requests/questionnaires/:targetRole | Authenticated catalogue, FARMER/VET/BUYER version 1 |
| POST users/me/role-requests | Active LEARNER, strict target answers, locale and durable submission key |
| GET users/me/role-requests; GET users/me/role-requests/:id | Own history/detail, all roles, no private reviewer fields |
| GET admin/role-requests; GET admin/role-requests/:id | Active ADMIN/SUPER_ADMIN bounded queue and review detail |
| POST admin/role-requests/:id/decision | Active ADMIN/SUPER_ADMIN, expected request/applicant versions; rejection reason / VET verification mandatory |
| GET admin/users/administrative-access | SUPER_ADMIN-only bounded administrative list |
| GET admin/users/role-access?email=...; GET admin/users/:id/role-access | SUPER_ADMIN-only existing-account target lookup and truthful fallback preview |
| PATCH admin/users/:id/privileged-role | SUPER_ADMIN-only action, expected roleVersion, reason and fresh actor password |

Member input selects exactly one email/userId plus FarmRole. Email is normalized, target/current actor eligibility is rechecked under ordered user/farm locks, and member creation plus audit is atomic. Staff quota excludes the primary owner only; extra co-owners count. Member lists expose display names, not account email/password.

Inputs are bounded to 32 KiB and strict Zod objects. Services repeat schema/permission checks; the existing success and errorDetails envelopes remain intact.

## Transaction and concurrency protocol

Submission locks applicant, checks replay key/hash before current role eligibility, then inserts request/audit/outbox atomically. Same-key replay on LEARNER POST is idempotent; after approval, all-role own-history GET recovers the committed request. Changed content conflicts. A partial unique index prevents different concurrent PENDING submissions.

Review locks actor/applicant in UUID order then request, rechecks active role/self-review/version/state, and writes decision/role/profile/audit/outbox in one transaction. Privileged changes first acquire a global PostgreSQL advisory lock, then actor/target locks, recheck fresh-password session/version and last-active-super-admin policy, preserve or restore the previous non-admin role, reject obsolete pending applications, revoke target sessions and audit atomically.

Onboarding locks the user, derives ownerId/OWNER, and writes farm/membership/completion/flag/audit in one transaction. Existing-farm confirmation cannot create or upgrade a membership. TenantGuard, sync and sockets reject incomplete FARMER access.

## Email and durable processing

Persistent dispatcher claims outbox rows using SKIP LOCKED and leases, creates unique per-recipient deliveries, and enqueues stable BullMQ IDs. Worker rechecks recipient eligibility/request state and sends escaped bn/en templates with protected links and optional public reason. Q&A, private notes and tokens never enter templates.

No active reviewers or Redis/provider failure retains durable work. Five bounded provider attempts use exponential backoff; failed jobs/ledger remain for operator repair. Accepted delivery and its audit commit together. Delivery is at least once: a provider acceptance followed by a database/worker crash can cause a duplicate. Mock acceptance is locally verified; real Resend/SES acceptance and mailbox delivery are unverified.

Run the standalone worker with the same reviewed database/Redis/provider configuration as HTTP. A Vercel HTTP function does not run the durable worker. Detailed restart/retry/bootstrap and release checks are in [operations](operations.md).

## Migration and backward compatibility

Rehearsed all migrations on an isolated empty PostgreSQL database; no production database was modified. Deployment must inventory live role counts, existing active SUPER_ADMIN accounts, migration lineage, clients, previous access TTL, trusted website origin and persistent worker hosting.

Deploy six-role readers and shared contracts before enabling LEARNER signup; migrate enum then expansion/checks in order; deploy compatible API/web/worker together. Old explicit professional signup remains valid. Use bounded legacy-token grace only if required. There are no new feature-toggle environment flags; stopping/gating signup or mutations during cutover is an operator routing/deployment decision.

Recovery rolls forward compatible code and repairs durable work. Once LEARNER accounts/versioned sessions exist, reverting to five-role readers or dropping the new history is unsafe. First-super-admin recovery uses the explicit offline bootstrap script only when none is active, never public signup. See [runbook](operations.md).

## Edge cases and verification

Local verification covers six-role login, forbidden public administrative signup, request/decision races, idempotency, audit rollback, private projection, reviewed VET initialization, farmer onboarding and quota races, refresh replay, session revocation, fallback preservation, concurrent mutual SUPER_ADMIN demotion, Redis rate limits and durable mock mail.

Applications allow three new accepted attempts per day; privileged mutations allow five attempts per 15 minutes per actor. Redis failure closes these mutations with a retryable error. These feature limits do not claim blanket signup/login/decision abuse protection.

Evidence, exact commands and remaining release limits are recorded in [operations](operations.md) and [execution plan](plan.md).
