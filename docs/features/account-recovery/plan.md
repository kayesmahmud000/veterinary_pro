# UXR-4 account recovery implementation plan

**Spec:** [shared contract](spec.md). **Goal:** implement the reviewed email recovery lifecycle without account disclosure or surviving old sessions. **Architecture:** public durable intake, hashed credentials, encrypted SQL outbox, separate recovery worker and scoped real/test mail transport; fixed BFF mapping and modal request/public reset UI. **Stack:** existing Nest/Prisma/PostgreSQL, Redis limiter, bcryptjs/Crypto, Next/React/Tailwind/shared Zod.

## Global constraints and current stage

The user's 2026-10-22 “go next” resumes the previous handoff's **contract preparation**. This stage creates/reviews spec and plan; it does not implement endpoints or enable recovery. Repository spec/plan locations and human-managed Git take precedence over generic skill path/commit/approval defaults. No staging, commit, merge, push, live migration, external mail or deployment. Preserve existing ADM-9/audit/planning and UXR-1–3 work.

All tasks consume the spec's exact TTL/budget/eligibility/session/privacy rules. No OTP, authenticated change-password, verification-status/role changes, automatic login, password persistence, generic mail refactor or new global forwarding trust. A separate signup bcrypt-byte-limit gap is observed; do not change old login credentials or claim it fixed here.

- [x] Inspect auth/controller/repositories/identity, dormant shared DTOs, modal/BFF/session locks, crypto, limiter, mail providers and durable-worker patterns.
- [x] Define shared contract, explicit defaults/compatibility, migration/recovery and staged acceptance.
- [x] Complete fresh-context design review, resolve material findings and record documentation validation.
- [ ] Tasks 1–6 implementation and local acceptance below.
- [ ] Target migration/configured-provider/durable-host/browser acceptance; only then integrated UXR-4 closure.

**Review focus:** asynchronous intake must stay account independent; job encryption/fencing must survive crashes without minting new grants; request spam cannot revoke usable links/sessions; reset must serialize with existing login/refresh and revoke all target sessions; browser language/session restoration must not leak/restore reset credentials. Each input class has tests in its owning task below.

## Implementation prerequisites

Use pinned pnpm 10.18.3 and supported Node (local checks currently use Node 22); Chrome for production browser checks. Provision explicitly disposable loopback PostgreSQL/Redis, preferably the documented Compose PostgreSQL 16/Redis 7; record any version difference rather than claiming target parity. No configured/live database is a test default. Build shared types before consumers, generate Prisma through the API package, and use isolated web output. Target origin/proxy/sender/worker hosting and authorized external test inboxes remain release inputs.

## Task 1 — Validated shared and transport boundaries

Files: extend existing `packages/shared-types/src/dto/auth/password-reset.dto.ts` compatibly; add `packages/shared-types/src/validation/account-recovery.ts` and export through validation/index; create `apps/api/src/modules/auth/recovery/` DTO/controller/module/service/repository interface files. Register `AccountRecoveryModule` alongside AuthModule in AppModule, importing exported password-hasher/user/session/audit/crypto/limiter dependencies without an AuthModule import cycle. Extend environment schema/service/examples for feature enablement, explicit test transport and trusted proxy CIDRs; production validation rejects test mode, untrusted origin and unsupported transport.

Interfaces: `PasswordResetRequestInput { email: string; locale: 'bn'|'en' }`; `PasswordResetCompleteInput { token: string; newPassword: string }`; strict acknowledgement `{ accepted: true }`, completion `{ reset: true }`; `IAccountRecoveryService.request(input, addressContext): Promise<{accepted:true}>`, `.complete(input, addressContext): Promise<{reset:true}>`. Keep the old unused response DTO export. Add no session token to these results. Wire explicit public metadata/guards; no generic proxy/refresh fallback.

- [ ] Write shared-contract and Nest HTTP tests: exact paths/statuses, keys/types, normalization/locales, UTF-8/body limits including chunked input, token syntax, 8–128/72-byte password boundaries, non-Latin strings, no reflected secret values. Observe RED for absent routes/schema.
- [ ] Implement strict schemas/DTOs/transport only with injected use cases, bounded request parsing and stable errors from the spec. Feature off returns account-independent 503.
- [ ] Run shared build, `pnpm --filter @vetralink/api test --runInBand --testPathPattern=auth/recovery`, and API build. Expected: contract/HTTP tests pass with controlled service dependencies; this task alone does not prove persistence or delivery.

## Task 2 — Atomic intake, credentials and reset persistence

Files: active `apps/api/prisma/schema.prisma`, one new additive timestamped migration, user password repository method if needed, `auth/recovery/account-recovery.repository.ts` / service and `account-recovery.database.spec.ts`. Do not touch root Prisma tree or applied migrations. Reuse existing user/refresh repositories/transaction manager/audit.

Interfaces: repository `acceptRequest(input, encryptedPayload, deadline, tx)`, `findCredentialByHash(hash)`, `issueForRequest(jobId, leaseId, generatedCredential, tx)`, `consumeAndRevoke(credentialId, expectedUserSnapshot, passwordHash, tx)`. Service computes password hash outside locks; repository provides user-first locks, database expiry checks and atomic mutation/audit/notification intent. Worker-facing records expose IDs/version/deadline and encrypted payload only, never raw credentials outside the service/transport boundary.

- [ ] Write failing real-PostgreSQL tests guarded by an explicit disposable loopback `RECOVERY_TEST_DATABASE_URL` ending `/recovery_test`. Cover all six roles/eligible statuses, absent/suspended/deleted/address/version changes, multiple links and the six-usable-link cap across Redis resets/concurrent issuance, issuance crash replay, exact expiry, same/different-link races and no request-induced session/grant revocation.
- [ ] Add rollback/fault tests for password/session/credential/audit/notification-intent atomicity. Race completion with login's password snapshot, refresh rotation and administrative revocation; assert one reset winner, old password rejection and old access/refresh/legacy-claim denial. Exercise current/passive socket recipient checks with old claims.
- [ ] Implement the two models/constraints/indexes and repository operations; preserve all role/email/verification/farm fields. Ensure terminal job constraints match ciphertext erasure and foreign-key recovery.
- [ ] On populated disposable infrastructure rehearse migrate → backup → restore → migrate/schema parity. Verify existing synthetic user/order/refresh/audit rows remain. Test the explicit offline restore fence (invalidate restored grants/erase job ciphertext/revoke refresh/rotate access-signing key) before reopening; a pre-consumption database snapshot cannot itself prove later consumption remains effective. Run migration diff against the API schema. No production migration.
- [ ] Run shared/API builds and focused suite with explicit DB URL; record real DB cases separately from controlled transport tests.

## Task 3 — Account-independent intake and abuse controls

Files: `auth/recovery/account-recovery.service.ts`, `recovery-client-address.ts`, limiter integration/tests; web ingress address integration is finalized jointly with Task 5. Never reuse arbitrary forwarded ClientMeta as proof of source.

Interfaces: `RecoveryClientAddressResolver.resolve(request, trustedProxyConfig)` yields a canonical verified address or a safe failure; limiter uses spec HMAC domains and exact budgets. Request service performs syntax/config/abuse checks and the same encrypted durable intake path without account lookup; hidden address suppression always acknowledges 202.

- [ ] RED tests compare eligible/unknown/ineligible HTTP bodies/status/headers and instrument repository calls to prove no account lookup in request handling; measure controlled timing distributions, without claiming network constant time. Assert zero synchronous provider sends and no state mutation beyond intake/counters.
- [ ] RED Redis/concurrency tests: exact IP/global/address/token thresholds, cooldown coalescing, address normalization, spoofed/malformed forwarded chains, trusted/untrusted peers, socket fallback and production web-ingress failure. Test atomic 100-job/60-second backpressure without account lookup, including concurrent admission and address-suppressed requests. Counter outage must prevent issuance/consumption; suppressions must not expose account state or lock accounts.
- [ ] Implement purpose-scoped hashed budgets and trusted-chain resolution. An ingress adapter may require an explicit direct dependency/configuration decision; record it rather than trusting undocumented platform headers or importing undeclared transitive packages.
- [ ] Run focused unit/Nest tests and opt-in real Redis against a task-owned `RECOVERY_TEST_REDIS_URL`; verify no raw identifier/token appears in Redis keys/values or diagnostic fixtures. Do not share Redis with workers from another disposable database.

## Task 4 — Durable worker and sensitive mail transport

Files: `apps/api/src/account-recovery.worker.ts`; recovery worker module/processor/repository/template/tests under `auth/recovery/`; scoped `RecoveryMailTransport` interface/Resend and explicit local test adapter under mail. Existing generic mail success/logging remains outside the sensitive sender path.

Interfaces: `claimAvailable(limit:2, leaseSeconds:60)`, `finish(jobId, leaseId, outcome)` and `retry(jobId, leaseId, fixedCode, availableAt)` are fenced; `IRecoveryMailTransport.send({ idempotencyKey, immutableMessage }): Promise<{mode:'REAL'|'TEST'; accepted:boolean; code?:SafeCode}>`. No token/email payload in Redis; immediately refill up to two sending slots, reserving one for each due kind; five seconds is idle backoff only. Follow the spec's expiry, five-attempt delays, encryption/context checks, ten-second provider timeout and terminal erasure.

- [ ] RED worker tests: every crash boundary, expired lease/stale completion, duplicate claim, immediate refill/fairness across instances and backpressure/deadline behavior under overload, issuance idempotency, ciphertext tampering/swapping, key failure, account/email/version changes and expiry before/retrying send. Replayed work cannot create a second grant or mark TEST as REAL.
- [ ] RED transport tests with a controlled HTTP provider: retry/idempotency header and exact request-body stability, malformed success, rate/timeout/network/permanent errors, no token/recipient/provider-body logging, canonical origin and disabled tracking prerequisites. Production misconfiguration must never fall back to mock/SES simulation.
- [ ] Implement SQL polling/lease fencing, encrypted payload lifecycle, stable templates/origin versions, cleanup and password-changed notice. An uncertain provider result can lead to retry of the same message; do not claim recipient delivery or universal exactly-once sending.
- [ ] Verify an actual separate worker process against task-owned PostgreSQL/Redis plus controlled mail: kill/restart around commit/send/acknowledgement, reclaim leases, avoid stale completion and erase secrets. Notification delivery failure must not roll back a committed password reset.
- [ ] Record transport/local evidence separately from external configured-provider tests; no real external mail in this task unless independently authorized.

## Task 5 — Strict web boundary and bilingual recovery flow

Files: add `apps/web/src/lib/auth/recovery-contracts.ts`, `recovery-server.ts`, `recovery-client.ts`; fixed dispatch from existing `app/api/auth/[action]/route.ts`; extend AuthDialog with an internal request panel and existing auth messages/styles; add the explicit new `app/(recovery)/layout.tsx` and `app/(recovery)/reset-password/page.tsx` group with a small reset client component and route-specific headers. Existing public navigation is under `(marketing)`; the new minimal recovery shell avoids its server-redirect language control and optional public content. Preserve AuthMode/login/register/protected-entry contracts; do not manufacture a separate login page or enable a dead link.

Interfaces: `recoveryRequest('request-password-reset'|'reset-password', payload)` validates dedicated result schemas and never delegates to normal refresh logic. Reset completion uses the existing session lock and auth-event channel to prevent refresh responses from restoring old browser state. Missing acknowledgements are uncertain outcomes, not automatic completion retries.

- [ ] RED Node boundary tests (`scripts/check-account-recovery.mjs`): fixed mapping/methods/queries, strict body bytes/projections, same-origin/cross-site/unknown headers, API unavailable/malformed/status mapping, generic request acknowledgement, no token/user exposure, cookies only cleared after confirmed completion and no auth token creation. Verify existing auth actions remain unchanged.
- [ ] RED production browser cases in a dedicated recovery harness reusing existing Chrome tooling: request panel/Back/pending/acknowledgement/retry, guarded required-login context, missing/malformed/expired/used link, explicit reset submit, confirmation mismatch, lost acknowledgement, successful normal sign-in, old password denial and multiple tabs/refresh races.
- [ ] Test bn/en at 320/1440px, labels/error associations/focus/keyboard, sensitive input clearing, fragment stripping before optional effects, no automatic GET consumption, no token in requests/history/storage/HTML/diagnostics/referrers and safe in-memory locale switching. Inspect actual screenshots. Existing native server-redirect locale control must not erase a live reset token silently.
- [ ] Implement only after Tasks 1–4 pass local lifecycle acceptance. Run shared/API/web builds, `check:styles`, `test:styles`, new web boundary/browser tests and existing `test:auth`, `test:protected-routes`, `test:workspace-navigation`, auth-browser and UXR-1 regressions as affected. Keep controlled HTTP/provider checks distinct from real persistence.

## Task 6 — Integrated acceptance, migration and release gates

- [ ] Re-run integrated real API/BFF/PostgreSQL/Redis/worker/controlled-mail journey, all eligibility/replay/race/session/logging cases and full API regression with the new database suite explicitly enabled. A skipped opt-in suite is not a pass.
- [ ] Fresh-context security/code review plus UI/QA review; fix material findings and re-run affected checks. Re-review final diff for secrets, unrelated changes, migration compatibility and safe disabled-mode behavior.
- [ ] Write target runbook: revisions/config flags, canonical HTTPS origin, verified ingress/proxy addresses and budget checks, trusted sender with tracking disabled, worker start/health/lag/alert owner, measured sustainable admission/worker capacity and overload responses, additive migration/backup/restore commands, smoke/abort/rollback steps and seven-day cleanup.
- [ ] After separately authorized target changes: verify configured Resend delivery and intact fragment URL in approved inboxes, successful reset/password-changed notice, session revocation, durable worker process restart and target browser acceptance. Provider acceptance is not receipt; record actual inbox observations separately.
- [ ] Only then mark API-AUTH-R ready and integrated UXR-4 complete. Keep ADM-9 release gates independent. Until then report implemented/local/target states separately.

## Preparation evidence and handoff

2026-10-22: read current auth/session/user/schema/BFF/mail/crypto/limiter/worker source and adjacent specs. Confirmed the missing routes and dormant DTOs; identified the bcrypt byte boundary, forwarded-address trust gap and SES simulation as design dependencies. Reviewed current [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and official Resend idempotency/tracking documentation linked in the spec. No recovery code, tests, migration, worker, credential or provider operation was created/run in this preparation stage.

Fresh-context read-only source/design review found one restore-revival gap, resolved with mandatory offline credential invalidation/ciphertext erasure/refresh revocation/access-key rotation before restored auth traffic. Follow-up review found no remaining material gaps. Also made the six-usable-link cap, immediate worker refill/fairness and account-independent SQL admission backpressure explicit; added corresponding implementation acceptance cases.

Documentation validation: `.context/scripts/validate.py` passed 48 Markdown documents, 367 local links and 95 source entries; `git diff --check` passed. A separate check passed 433 local links/anchors across nine feature/roadmap/index/audit documents, new-feature whitespace and final newlines. A whole-file whitespace probe also flagged 25 pre-existing Markdown hard-break lines in the API roadmap; those were preserved, and added-line whitespace passed. These checks do not establish API, migration, browser or delivery behavior; no runtime tests/builds were run for this documentation-only stage. Suggested documentation commit: `docs: specify account recovery contract and implementation plan`. The implementation entry point is Task 1; contract preparation alone does not close UX-03 or API-AUTH-R.
