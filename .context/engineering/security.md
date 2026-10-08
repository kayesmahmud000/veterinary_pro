# Security requirements and evidence

The [Senior Application Security Engineer](../roles/security.md) perspective is required for the sensitive boundaries described here. Pair with the owning implementer and [QA/Code Reviewer](../roles/quality.md), classify findings using [evidence labels](evidence.md), and verify mitigations through [self-review](../workflows/self-review.md).

## Existing mechanisms

- `modules/auth/services/auth.service.ts` and `token.service.ts`: JWT access tokens, opaque random refresh tokens stored as SHA-256 hashes, refresh rotation logic. Defaults are 15 minutes access / 7 days refresh; configuration can change them. Refresh tokens are not JWTs despite the presence of `JWT_REFRESH_SECRET` in config.
- `BcryptPasswordHasher` uses bcryptjs; retain the repository's minimum 12 rounds requirement.
- `common/crypto/pii-crypto.service.ts`: AES-256-GCM PII encryption and keyed phone lookup hashing. Keep encryption, blind index and normalization coherent; do not expose decrypted fields except through authorized contracts.
- `JwtAuthGuard`, `RolesGuard`, `TenantGuard`: authentication, platform roles, farm membership/roles. RolesGuard uses exact allowlists; SUPER_ADMIN is explicitly admitted on supported handlers. Its existing TenantGuard inspection bypass is retained separately.
- Helmet, validation, domain error mapping, audit repositories and idempotency infrastructure are present. Their presence does not establish blanket coverage.

## Required review for changed boundaries

Test missing/expired tokens, refresh replay/concurrent refresh, suspended users, role mismatch, cross-farm reads and writes, foreign IDs and deleted records. Check endpoint metadata and module imports. `RolesGuard` allows handlers with no required-role metadata; never infer deny-by-default role enforcement. Do not trust a farm ID, user ID or vet ID supplied by a client solely because authentication passed.

Preserve signed webhook verification over raw bytes, replay handling and exact amount/currency/order matching. Authorize object storage key ownership, content type/size, multipart completion and signed URL TTL. Restrict verification/download endpoints to the minimum public fields. Test WebSocket handshake and room/message access independently.

Do not commit or print credentials, real `.env` contents, tokens, private keys, signed URLs or patient/farm data. Use synthetic test data. Never copy development defaults into production. Keep logs actionable with trace/job IDs and redacted context; inspect audit payloads and non-production query logging for PII too.

PII keys, hash peppers and prescription signing keys need persistent secure storage, rotation/recovery plans and historical verification compatibility. Changing a pepper or encryption key without data migration breaks lookups/decryption. `PkiCryptoService` currently generates ephemeral keys if RSA environment variables are absent; do not rely on that fallback in production.

Public/auth/download/webhook routes require abuse limits with tested enforcement. The legacy `@Throttle`/100-requests rule is an intent, not an installed rate limiter here. Do not claim regulatory compliance, clinical certification or dependency vulnerability status from old documentation. Re-evaluate the actual release and environment.

First-super-admin recovery is an explicit offline operator action. Bootstrap accepts
either an existing active UUID or new email/name/password when no active SUPER_ADMIN
exists, retaining one transaction for account/role/audit/outbox. It never runs at
HTTP startup and never replaces an existing account password. See the
[bootstrap runbook](../../docs/features/role-request-approval/operations.md#first-super_admin-bootstrap)
and [owner-login evidence](../../docs/tasks/first-super-admin-login/plan.md).

[Known gaps](../known-gaps.md) records concrete differences including serverless diagnostic disclosure and permissive configuration. Those observations require scoped fixes and verification; this documentation task does not fix them.

Updated 2026-10-07: current-primary identity/authorizationVersion checks apply to HTTP and chat events/receiving sockets; revoked idle sockets are checked every five seconds. Public roles are LEARNER/FARMER/VET/BUYER with default LEARNER. New FARMER farm access requires completed onboarding. Role review and SUPER-only fresh-password management lock/version/audit/outbox atomically; applications and privileged mutations have tested Redis limits. [Verification and migration/recovery limits](../../docs/features/role-request-approval/operations.md) distinguish local synthetic acceptance from release readiness.
