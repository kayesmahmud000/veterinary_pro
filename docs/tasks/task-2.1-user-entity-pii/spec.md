# SPEC-201: User Entity Schema, Migration & PII Encryption Engine
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.1: User entity schema, migration, and PII encryption engine (AES-256-GCM + HMAC-SHA256 phone_hash)
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish the foundational data domain and cryptographic security layer for user identities in VETRALINK PRO. This task implements:
1. **User Domain Entity (`UserEntity`)**: A pure Domain-Driven Design (DDD) domain entity decoupled from ORM/database concerns, encapsulating user identity invariants, status transitions, role checks, and data masking.
2. **PII Encryption Engine (`PiiCryptoService`)**: An enterprise-grade cryptographic engine implementing authenticated symmetric encryption (**AES-256-GCM**) for Personally Identifiable Information (PII) like phone numbers, coupled with a deterministic blind index (**HMAC-SHA256**) with secret salting/peppering to enable secure $O(1)$ indexed database lookups without compromising plaintext privacy.
3. **Database Schema & Index Verification**: Verifying the existing Prisma schema and baseline PostgreSQL DDL migration (`0_init`) to ensure strict column constraints, partial/unique indexes on `phone_hash`, and soft-delete index alignment.

### 1.2 Target Deliverables for Task 2.1
- **`apps/api/src/common/crypto/pii-crypto.service.ts`**: Standalone, injectable encryption service powered by Node.js native `crypto` module, utilizing `AES_PII_ENCRYPTION_KEY` (32 bytes / 256 bits) and `HASH_PEPPER` from validated `EnvService`.
- **`apps/api/src/common/crypto/crypto.module.ts`**: Shared NestJS module exporting `PiiCryptoService`.
- **`apps/api/src/modules/users/entities/user.entity.ts`**: Pure TypeScript domain entity containing business rules, encapsulation, and phone number masking helpers.
- **Unit Test Suites**:
  - `apps/api/src/common/crypto/pii-crypto.service.spec.ts`: Comprehensive test suite testing AES-256-GCM roundtrips, random IV generation, tampering/corruption rejection via authentication tags, E.164 phone normalization, and HMAC-SHA256 deterministic hashing.
  - `apps/api/src/modules/users/entities/user.entity.spec.ts`: Test suite verifying domain entity validation, factory instantiation, state transitions, role queries, and masking behaviors.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.1) |
| :--- | :--- | :--- |
| **User Entity** | No domain entity; only raw Prisma-generated client interface `User`. | Pure `UserEntity` class adhering to Clean Architecture with encapsulated state, factory methods, and business invariants. |
| **Phone Privacy (PII)** | Database column `phone` exists as `TEXT`, but no cryptographic engine encrypts or decrypts it. | End-to-end authenticated encryption (**AES-256-GCM**) encrypts phone numbers before persistence and decrypts on retrieval. |
| **Indexed Search on PII** | Database column `phone_hash VARCHAR(64)` exists with unique index, but no blind index engine calculates deterministic hashes. | **HMAC-SHA256** blind indexing with secret pepper produces uniform 64-char hex digests for $O(1)$ index lookups in PostgreSQL. |
| **Tamper Resistance** | None. | GCM 128-bit authentication tag guarantees ciphertext integrity; any byte-level tampering immediately aborts with `PiiDecryptionException`. |
| **Domain Decoupling** | High risk of leaking Prisma types into API controllers and services. | Repositories map between raw database rows and rich `UserEntity` domain models. |

---

## 3. Architectural & Design Trade-offs

### 3.1 PII Storage Strategy: Plaintext vs. Reversible Encryption vs. Blind Indexing
- **Option A: Plaintext Phone Numbers with DB Access Controls**
  - *Risk*: Database dumps, SQL injection, accidental log leaks, or unauthorized internal access expose sensitive farm owner and vet contact information.
- **Option B: One-way Hashing only (Bcrypt/Argon2)**
  - *Flaw*: Phone numbers cannot be recovered to send transactional SMS, OTP verification codes, or prescription alerts.
- **Option C: Dual-Layer Cryptography: AES-256-GCM + HMAC-SHA256 Blind Index (CHOSEN)**
  - *Pros*:
    1. **AES-256-GCM**: Provides authenticated encryption with associated data (AEAD). Uses a cryptographically secure random 96-bit/128-bit IV per encryption, ensuring identical phone numbers produce completely different ciphertexts (semantically secure against frequency analysis).
    2. **HMAC-SHA256 (`phone_hash`)**: A deterministic keyed-hash message authentication code using a private server-side pepper (`HASH_PEPPER`). Allows the backend to run `WHERE phone_hash = :hash` for $O(1)$ B-Tree index lookups without ever searching plaintext or decrypting entire tables.
  - *Justification*: Complies with GDPR/HIPAA/ag-data sovereignty requirements and prevents data exposure in the event of database snapshot leaks.

### 3.2 Ciphertext Serialization Format
- **Option A: JSON stringified payload `{"iv":"...","tag":"...","data":"..."}`**
  - *Cons*: High storage overhead, slow parsing, excessive string allocation.
- **Option B: Colon-delimited Hex string `iv:authTag:ciphertext` (CHOSEN)**
  - *Format*: `<hex_iv>:<hex_auth_tag>:<hex_ciphertext>`
  - *Pros*: Compact, fast single-pass string splitting (`split(':')`), easily readable in database logs, zero JSON serialization overhead.
  - *Justification*: Minimal storage footprint in PostgreSQL `TEXT` column while maintaining clear separation of cryptographic components.

### 3.3 Domain Entity Design: Anemic Data Class vs. Rich Domain Model
- **Option A: Anemic TypeScript interface / public field class**
  - *Cons*: Business logic, validation, and state mutation logic leak into controllers and services; invariants cannot be enforced.
- **Option B: Rich DDD Domain Entity (CHOSEN)**
  - *Pros*: Private/readonly properties with explicit getters; domain methods (`activate()`, `suspend()`, `verifyEmail()`, `maskPhone()`); factory methods (`create()`, `reconstitute()`) that ensure only valid user instances exist in memory.
  - *Justification*: Directly aligns with Section 2 of `.antigravityrules` and hexagonal architecture.

---

## 4. Data Models & Cryptographic Contracts

### 4.1 Ciphertext Storage Format
```text
Format: <IV_HEX>:<AUTH_TAG_HEX>:<CIPHERTEXT_HEX>
Example: 3f8a9e...12b:7c2b5d...8e4:e9a0f1...44a
- IV: 16 bytes (32 hex characters) or 12 bytes (24 hex characters) cryptographically random bytes via crypto.randomBytes()
- AuthTag: 16 bytes (32 hex characters) via cipher.getAuthTag()
- Ciphertext: Variable-length encrypted payload via cipher.update() + cipher.final()
```

### 4.2 Blind Index Format
```text
Format: HMAC-SHA256(normalizedPhone, HASH_PEPPER)
Output: 64-character lowercase hex string
Indexing: Stored in users.phone_hash (VARCHAR(64)) with UNIQUE INDEX
```

### 4.3 Phone Normalization Contract
Before hashing or encrypting, phone numbers must be sanitized:
- Strip all non-digit characters except leading `+`.
- Trim leading/trailing whitespace.
- E.164 standardization format check (e.g., `+8801700000000` or `+12025550100`).

### 4.4 User Domain Entity Interface Contract
```typescript
export interface UserEntityProps {
  id: string;
  email: string;
  phone: string | null;            // Plaintext in domain memory (never persisted unencrypted)
  phoneHash: string | null;        // Deterministic blind index
  passwordHash: string;            // Bcrypt 12 rounds
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
```

---

## 5. Security & Edge Cases

1. **Tampered Ciphertext**: If an attacker or corrupted disk sector modifies a single bit of the ciphertext or IV, `decipher.final()` in GCM mode throws an authentication tag mismatch. The service wraps this in a custom `PiiDecryptionException` to prevent leaking cryptographic details.
2. **Missing or Incomplete Format**: Ciphertext missing the delimiter `:` or having invalid lengths throws a descriptive domain exception.
3. **Key Safety**: `AES_PII_ENCRYPTION_KEY` and `HASH_PEPPER` are injected strictly via `EnvService` with runtime Zod hex-length validation. Keys are never logged or exposed in stack traces.
4. **Soft-Deleted Users**: The entity tracks `deletedAt`. Lookups and operations on deleted users are blocked or flagged according to business logic.
5. **Phone Number Masking**: The entity provides `getMaskedPhone()` returning e.g. `+880 •••• ••00` or `+1 ••• ••• 0100` for secure display in non-privileged UI contexts.
