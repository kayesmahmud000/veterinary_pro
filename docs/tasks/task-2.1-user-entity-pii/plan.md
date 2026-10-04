# PLAN-201: User Entity Schema, Migration & PII Encryption Engine Execution Plan
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.1: User entity schema, migration, and PII encryption engine (AES-256-GCM + HMAC-SHA256 phone_hash)
# Author: Elite Software Architect & Tech Lead

---

## 1. Prerequisites

- Sprint 1 completed with all 55 tests passing.
- Database baseline migration `0_init/migration.sql` established.
- `AES_PII_ENCRYPTION_KEY` and `HASH_PEPPER` validated via `EnvSchema` in `EnvService`.
- Node.js built-in `crypto` module (no third-party unvetted cryptographic dependencies).

---

## 2. Granular Implementation Steps

### Step 1: Domain Exception Definition
- [x] Create `apps/api/src/common/crypto/exceptions/pii-crypto.exception.ts` extending `AppException` (or `InternalServerErrorException`) for decryption failures, tamper detection, and key errors without leaking internal key details.

### Step 2: PII Cryptographic Engine Implementation
- [x] Create `apps/api/src/common/crypto/pii-crypto.service.ts`:
  - Inject `EnvService`.
  - Validate 32-byte key (`AES_PII_ENCRYPTION_KEY`) and `HASH_PEPPER`.
  - Implement `encrypt(plaintext: string): string` using `aes-256-gcm` with 16-byte random IV, returning `iv:authTag:ciphertext` in hexadecimal.
  - Implement `decrypt(ciphertext: string): string` extracting IV, auth tag, and payload; throwing `PiiCryptoException` if authentication fails or format is corrupted.
  - Implement `normalizePhone(rawPhone: string): string` stripping non-digit characters except leading `+` and trimming whitespace.
  - Implement `hashPhone(rawPhone: string): string` returning HMAC-SHA256 hex digest using `HASH_PEPPER`.
- [x] Create `apps/api/src/common/crypto/crypto.module.ts` exporting `PiiCryptoService`.
- [x] Export from `apps/api/src/common/crypto/index.ts`.

### Step 3: Pure User Domain Entity
- [x] Create `apps/api/src/modules/users/entities/user.entity.ts`:
  - Encapsulate properties (`id`, `email`, `phone`, `phoneHash`, `passwordHash`, `name`, `role`, `status`, `avatarUrl`, `isEmailVerified`, `lastLoginAt`, `createdAt`, `updatedAt`, `deletedAt`).
  - Implement factory `UserEntity.create(...)` for new registrations.
  - Implement factory `UserEntity.reconstitute(...)` for repository reconstitution from database rows.
  - Implement business methods:
    - `updateProfile(name?: string, avatarUrl?: string)`
    - `changePhone(newPhone: string, newPhoneHash: string)`
    - `verifyEmail()`
    - `updatePassword(newPasswordHash: string)`
    - `recordLogin()`
    - `suspend()`
    - `reactivate()`
    - `softDelete()`
    - `maskPhone(): string | null` (returns e.g. `+880 •••• ••00`)
    - Invariant checkers: `isActive()`, `isSuspended()`, `hasRole(role)`, `isDeleted()`.

### Step 4: Unit Test Suite
- [x] Create `apps/api/src/common/crypto/pii-crypto.service.spec.ts`:
  - Test AES-256-GCM encryption produces format `<iv>:<authTag>:<ciphertext>`.
  - Test encrypt/decrypt roundtrip with varied phone formats and UTF-8 strings.
  - Test semantic security: Encrypting the same plaintext twice produces different ciphertexts.
  - Test tampering detection: Altering IV, AuthTag, or Ciphertext bytes throws `PiiCryptoException`.
  - Test phone normalization: Strip parentheses, dashes, spaces, retain leading `+`.
  - Test blind index determinism: Same normalized input produces identical HMAC-SHA256 hex digests.
  - Test blind index variance: Different inputs produce completely different hashes.
- [x] Create `apps/api/src/modules/users/entities/user.entity.spec.ts`:
  - Test creation via `create()` and `reconstitute()`.
  - Test state mutations (`verifyEmail`, `recordLogin`, `suspend`, `reactivate`, `softDelete`).
  - Test phone masking logic for standard international numbers and edge cases.
  - Test role checking methods (`hasRole`).

### Step 5: Verification & Compilation
- [x] Run full test suite: `pnpm --filter @vetralink/api test`
- [x] Verify build compilation: `pnpm --filter @vetralink/api build`

---

## 3. Verification & Acceptance Criteria

1. **Test Execution**:
   ```bash
   pnpm --filter @vetralink/api test -- src/common/crypto src/modules/users
   ```
   All tests must pass with 0 failures.
2. **Deterministic Blind Index Verification**:
   - `hashPhone("+1 (202) 555-0100")` equals `hashPhone("+12025550100")`.
   - Length of resulting hash is exactly 64 hex characters.
3. **Tamper Resistance Verification**:
   - Manually modified byte in ciphertext or auth tag must throw `PiiCryptoException`.
4. **TypeScript Strictness**:
   - `pnpm --filter @vetralink/api build` completes with 0 type errors.
