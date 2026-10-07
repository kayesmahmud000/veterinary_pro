# Local verification and role workflow operations

Date: 2026-10-07. This record distinguishes local observed behavior from deployment requirements.

## Verification evidence

| Check | Local result |
| --- | --- |
| Shared-types build and Prisma validation | Passed |
| Additive migration rehearsal | All 23 migrations, including three new migrations, applied to an isolated empty PostgreSQL 16 database |
| API regression | 210 suites / 1,854 tests passed; the opt-in database suite was skipped in that default run and executed separately |
| Real PostgreSQL/Redis workflow tests | 26 passed: role defaults/auth, requests/decisions/replay/rollback, onboarding/quota, privilege fallback/revocation/mutual demotion and Redis limits |
| API production compilation / web production build | Passed; API output includes dist/main.js and dist/role-notifications.worker.js |
| Web auth / workspace boundary tests | 8 auth + 11 workspace tests passed |
| Auth modal browser regression | bn/en, 1440/768/375/320px: validation/focus/Escape/overflow, cookies/reload/cross-tab refresh/logout/expiry/retry; controlled mock upstream |
| Existing public regression | 36 GET checks, 27 language submissions, 5 unsafe URLs, 12 catalogue filters, 4 CSV downloads and 2 missing-template checks passed |
| Real local workspace browser | Default LEARNER signup/application/approval/session refresh; immediate FARMER setup/dashboard gate; atomic OWNER; email members/quota; membership confirmation; manager OWNER restriction; reviewer private notes/ADMIN denial; SUPER grant/removal/fallback; durable mock decision mail |
| Responsive/visual review | bn/en onboarding at 1440/320 and farm at 1440/375/320; no horizontal overflow or browser runtime exceptions; screenshots visually inspected |
| Documentation and final diff | 13 feature/roadmap documents with 231 local links/anchors passed; context validator passed 48 documents / 287 links / 74 source entries; git diff --check passed |

The isolated database is role_test at localhost:55432 and Redis at localhost:56379. Every fixture uses synthetic example.test accounts. No deployed service or real provider was contacted. Browser screenshots/logs are local test artifacts, not production evidence.

Production migration/legacy populated-data rehearsal, real Resend/SES acceptance, inbox delivery, worker restart under actual hosting, and cross-browser/multi-device acceptance remain unverified. At-least-once mail can duplicate after external acceptance followed by a crash. Existing global signup/login abuse protection and unsupported OTP/reset flows are outside this change.

## Reproduce checks

Build shared-types before API/web tests. Run normal package checks:

~~~powershell
pnpm --filter @vetralink/shared-types build
pnpm --filter @vetralink/api exec prisma validate
pnpm --filter @vetralink/api build
pnpm --filter @vetralink/api test --runInBand
pnpm --filter @vetralink/web build
pnpm --filter @vetralink/web test:auth
pnpm --filter @vetralink/web test:workspace
pnpm --filter @vetralink/web test:auth:browser
~~~

Real DB tests are opt-in, never load the project .env or reset caller data. Prepare the explicitly isolated role_test PostgreSQL at 127.0.0.1:55432 and Redis at 127.0.0.1:56379, apply the API migration lineage, then set ROLE_TEST_DATABASE_URL to that test URL and run:

~~~powershell
pnpm --filter @vetralink/api exec jest --runInBand common/security/role-workflow.database.spec.ts
~~~

Workspace browser acceptance requires a test-only API on 3311 with /api/v1, migrated isolated test DB/Redis, EMAIL_PROVIDER=mock, plus the separate role worker. Build the web first; the script starts its own Next production server on 3310 and headless Chrome/CDP on 9335. Set ROLE_TEST_DATABASE_URL to the exact synthetic URL required by the script, then run test:workspace:browser. It creates synthetic fixture accounts and cleans only its owned browser profile/processes. Tests do not remove seeded records; discard the test database separately when desired.

On Windows, Prisma generation cannot overwrite its DLL while an API/worker uses it. Stop the owned local processes before generation; compilation alone can use tsc --project tsconfig.build.json. The production tsconfig excludes tests/scripts, ensuring stable executable output paths.

## Deploy and configure

Use only apps/api/prisma/schema.prisma. Inventory the existing production migration lineage, role counts, active SUPER_ADMIN, clients and backup before separately authorized deployment. Rehearse on a populated sanitized copy to confirm unchanged old roles/farms/access. Enum addition commits before the next migration uses LEARNER; no migration rewrites historical roles.

Deploy compatible shared six-role readers, migrate, and release API/web/worker together. Retain old explicit professional signup. A new role-omitting modal must not hit an old FARMER-default API. Legacy JWT grace is optional: set AUTH_LEGACY_CLAIMS_UNTIL to an absolute UTC deadline within the previous maximum access-token TTL; leave unset for immediate versioned-claim enforcement.

API/worker need reviewed DATABASE_URL, REDIS_URL, JWT/PII configuration, EMAIL_PROVIDER, EMAIL_FROM, provider credentials and trusted WEB_BASE_URL. Never reuse example credentials. Start the persistent role worker from the built API:

~~~powershell
pnpm --filter @vetralink/api worker:role-notifications
~~~

The HTTP/serverless process does not start this worker. Monitor oldest due/uncompleted outbox, FAILED delivery count, queue failure count and ROLE_EMAIL_ACCEPTED audits; these are database/queue records, not a shipped metrics dashboard.

## Mail retry and recovery

Outbox claim leases expire after 60 seconds. Dispatcher runs every five seconds and persists retry availability after failure. Redis loss leaves durable events/recipient ledgers, so restarting a compatible worker recreates pending jobs using stable delivery IDs. No active reviewer keeps the application durable and retries discovery.

Provider jobs attempt five times with exponential backoff. Exhausted jobs remain failed in BullMQ and FAILED in the delivery ledger; automatic dispatcher skips FAILED rows. Repair the provider/configuration first. For selected reviewed delivery IDs, stop the worker, verify matching failed queue jobs and ledger state, set only those delivery rows back to PENDING with attempts zero/error cleared/due now, reset only corresponding outbox completedAt/leaseUntil/availableAt, then remove the selected failed BullMQ jobs or explicitly retry them. Restart the worker and confirm provider acceptance plus SENT/ROLE_EMAIL_ACCEPTED. Never rerun the role decision or bulk clear all jobs/outbox history. This is an operator procedure, not a public retry endpoint.

A SENT ledger means the provider accepted the message, not inbox delivery. Correlate providerMessageId with the actual provider. A crash after provider acceptance but before ledger commit can duplicate mail; no exactly-once promise.

## First SUPER_ADMIN bootstrap

There is no public administrative signup or self-promotion. If an active SUPER_ADMIN exists, use protected management with fresh password/reason. If none exists, an authorized operator may run the offline script against a reviewed database and an existing active account:

- Explicit DATABASE_URL.
- ROLE_BOOTSTRAP_USER_ID: existing account UUID.
- ROLE_BOOTSTRAP_REASON: bounded human review reason.
- ROLE_BOOTSTRAP_CONFIRM: BOOTSTRAP_FIRST_SUPER_ADMIN.
- Command: pnpm --filter @vetralink/api admin:bootstrap.

The script shares the advisory lock, refuses existing active SUPER_ADMIN or a pending target application, preserves fallback, increments versions, revokes refresh sessions and writes audit/outbox atomically. It does not create accounts and was not invoked during implementation.

Recovery favors compatible roll-forward and scoped durable-work repair. Do not drop role/history tables or roll back to five-role/FARMER-default readers after new accounts exist. Production recovery/backup restoration requires its own reviewed operation.
