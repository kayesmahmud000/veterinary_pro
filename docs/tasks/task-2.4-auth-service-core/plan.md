# PLAN-204: AuthService Core Implementation Plan
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.4: AuthService core: Password hashing (bcrypt 12 rounds), JWT issuance, and Refresh Token Rotation (RTR)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 2.1: User entity schema, migration, PII encryption engine, and `UserEntity`.
- [x] Task 2.2: Auth DTOs (Register, Login, Refresh, OTP) in `@vetralink/shared-types`.
- [x] Task 2.3: `UserRepository` and `RefreshTokenRepository` with interface contracts.
- [x] Dependencies installed: `bcryptjs`, `@types/bcryptjs`, `@nestjs/jwt`.

---

## 2. Granular Implementation Steps

### Step 1: Install Dependencies
- [x] Install `bcryptjs` and `@nestjs/jwt` in `apps/api`:
  `pnpm --filter @vetralink/api add bcryptjs @nestjs/jwt`
- [x] Install `@types/bcryptjs` in devDependencies:
  `pnpm --filter @vetralink/api add -D @types/bcryptjs`

### Step 2: Password Hashing Service & Unit Tests
- [x] Create `apps/api/src/modules/auth/services/password-hasher.interface.ts`:
  - `IPasswordHasher` interface (`hash`, `compare`).
  - Injection token `PASSWORD_HASHER = "PASSWORD_HASHER"`.
- [x] Create `apps/api/src/modules/auth/services/bcrypt-password-hasher.service.ts`:
  - Enforce `saltRounds: 12`.
  - Implement `hash()` and `compare()`.
- [x] Create `apps/api/src/modules/auth/services/bcrypt-password-hasher.service.spec.ts`:
  - Test hashing format (`$2a$` or `$2b$`), comparison with matching and mismatched passwords.

### Step 3: Token Service (JWT & RTR) & Unit Tests
- [x] Create `apps/api/src/modules/auth/services/token.service.interface.ts`:
  - `ITokenService` contract and `TOKEN_SERVICE` token.
- [x] Create `apps/api/src/modules/auth/services/token.service.ts`:
  - Injects `JwtService` and `EnvService`.
  - Generates signed JWT access tokens with 15-minute expiration and standard claims.
  - Generates 320-bit cryptographically secure random refresh tokens.
  - Generates SHA-256 hash of refresh tokens.
  - Verifies access tokens.
- [x] Create `apps/api/src/modules/auth/services/token.service.spec.ts`:
  - Test token generation, claims extraction, refresh token hashing, and expiration handling.

### Step 4: `IAuthService` Contract
- [x] Create `apps/api/src/modules/auth/services/auth.service.interface.ts`:
  - Define `IAuthService` methods: `register`, `login`, `refreshToken`, `logout`, `logoutAll`.
  - Define injection token `AUTH_SERVICE = "AUTH_SERVICE"`.

### Step 5: `AuthService` Implementation
- [x] Create `apps/api/src/modules/auth/services/auth.service.ts`:
  - Injects `IUserRepository`, `IRefreshTokenRepository`, `IPasswordHasher`, `ITokenService`, `TransactionManager`, and `EnvService`.
  - Implements `register()`: rejects `ADMIN`/`SUPER_ADMIN`, checks uniqueness, hashes password, saves user and initial refresh token.
  - Implements `login()`: validates user exists, not suspended/deleted, validates password, records login, issues token pair.
  - Implements `refreshToken()`: verifies token exists, detects reuse/replay attack and revokes all tokens on breach, rotates token inside transaction.
  - Implements `logout()` and `logoutAll()`.
- [x] Create `apps/api/src/modules/auth/services/auth.service.spec.ts`:
  - Comprehensive unit tests with mocked repositories:
    - Successful registration and role restriction defense.
    - Successful login, bad password, suspended user error.
    - Successful token rotation.
    - Refresh token reuse attack detection triggers `revokeAllForUser`.
    - Logout single and bulk.

### Step 6: Module Wiring
- [x] Update `apps/api/src/modules/auth/auth.module.ts`:
  - Import `JwtModule.registerAsync()` with `EnvService`.
  - Provide and export `PASSWORD_HASHER`, `TOKEN_SERVICE`, `AUTH_SERVICE`.
- [x] Update `apps/api/src/modules/auth/index.ts` with barrel exports.

### Step 7: Verification & Acceptance Testing
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 2.4.

---

## 3. Acceptance Criteria

1. **Password Invariants**: Passwords hashed with bcrypt (12 rounds); plaintext passwords never logged or saved.
2. **JWT Standards**: Access tokens are signed JWTs with expiration matching `JWT_ACCESS_EXPIRATION` (15m default).
3. **Cryptographic RTR**: Refresh tokens are 320-bit random strings; database stores only SHA-256 hashes.
4. **Theft Containment**: Presentation of an already revoked token revokes ALL active tokens for that user account immediately.
5. **Role Escalation Defense**: Attempts to register `ADMIN` or `SUPER_ADMIN` via public signup fail with `ForbiddenOperationException`.
6. **100% Passing Tests**: All unit tests pass with zero regressions.
