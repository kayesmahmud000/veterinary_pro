# Administrative course enrollment operations

Feature: [specification](spec.md). Execution/verification: [plan](plan.md), [ledger](execution.md).

## Before enabling

1. Back up the selected environment through the existing operator process; retain redacted enrollment audit evidence independently of that backup. Rehearse restoration and revocation reconciliation against a disposable copy.
2. Review/apply `apps/api/prisma/migrations/20261102090000_admin_course_enrollments/migration.sql` through the API migration lineage. Never use the root Prisma tree, development resets or production `db:migrate`.
3. Build shared types, API and web. Deploy the additive schema before the new code. Complete the rollout to **all** API instances so self-enrollment/detail/library/playback enforce ACTIVE status before any admin can revoke access. Drain older instances.
4. Configure healthy shared Redis and `REDIS_ENABLED=true`; the new endpoints fail closed when distributed limits are disabled/unavailable. Set `ADMIN_COURSE_ENROLLMENTS_ENABLED=true` on the API only after authorized migration/rollout smoke checks. Default is false. No mail provider, new public auth endpoint or invitation worker is needed.
5. As authorized synthetic ADMIN and SUPER_ADMIN identities, inspect `/admin/courses`, open a course's learners, create a synthetic learner and enroll it, use its ordinary login, remove/restore membership, and verify both directories/counts and redacted audit history. Ensure no learner session replaces the administrator session. Remove the synthetic test membership through the normal audited action.

## Operator behavior

Direct creation always creates a LEARNER/ACTIVE account with unverified email and then its selected course membership inside one transaction. The administrator supplies credentials directly; the application never emails or returns a password. Existing-email conflict requires explicit existing-user selection; it never resets credentials or restores revoked access.

After a lost creation response, use the form's submitted exact-email lookup to review the account and enrollment. Do not repeat account creation automatically or infer which request created an existing identity. Passwords must be re-entered for failed attempts; they are never stored in browser storage or audits.

COURSE_NOT_ENROLLABLE means the course is unpublished/deleted/paid/otherwise outside free YouTube enrollment. ENROLLMENT_VERSION_CONFLICT means reload both user/course state before acting. RATE_LIMITED carries Retry-After; RATE_LIMIT_UNAVAILABLE requires Redis restoration. Disabling admin enrollment support leaves existing learner access/revocation checks enabled.

## Rollback and restore

Disable `ADMIN_COURSE_ENROLLMENTS_ENABLED` and roll back the new UI if needed. Keep the additive schema and ACTIVE-aware API. **Do not deploy the earlier existence-only membership authorization after any revocation**, as it would restore access.

If restoring a backup predating membership revocations, hold protected course enrollment/playback unavailable while an operator reconciles post-backup revocations from independently retained audit/incident evidence. Reconcile via current audited support actions, verify both views and only then reopen access. A restored backup alone does not establish current access policy.

## Local disposable verification

`apps/api/scripts/check-course-enrollments-migrations.mjs` accepts only an explicit fresh, task-owned loopback database named `course_enrollments_test`. It applies pre-feature migrations, seeds synthetic legacy rows, applies the new migration and verifies preserved IDs/dates/credentials and revocation checks. Run from apps/api with ENROLLMENTS_TEST_DATABASE_URL set to that disposable database. It must not run on a populated configured database.

`admin-course-enrollments.database.spec.ts` uses the same disposable guard. `admin-course-enrollments.redis.spec.ts` additionally requires explicit ENROLLMENTS_TEST_REDIS_URL at loopback port56479. No script chooses a real deployment target or dispatches email.

Controlled browser focuses in the existing dashboard harness: `admin-enrollments` for ADMIN/SUPER_ADMIN, bn/en and320/768/1440px; `course-revalidation` for preserving authorized playback on focus and removing it after definitive revocation. `admin-courses`, `courses` and `directory` cover adjacent regressions. Use an isolated production WEB_TEST_BUILD_DIR; controlled upstream results are distinct from real PostgreSQL and target-deployment acceptance.

The restore helper `apps/api/scripts/check-course-enrollments-restore.mjs` requires the same explicit source test database plus `ENROLLMENTS_TEST_PG_BIN` pointing to matching-major pg_dump/pg_restore tools. It creates a fresh randomly named `course_enrollments_restore_*` database inside that disposable cluster and never drops an existing database. Keep its HTTP traffic closed during the reconciliation simulation. The original fixed-name copy from an unsuccessful local attempt is not reused.
