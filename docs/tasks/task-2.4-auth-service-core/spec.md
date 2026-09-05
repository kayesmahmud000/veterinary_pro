# SPEC-204: AuthService Core — Password Hashing, JWT Issuance & Refresh Token Rotation (RTR)
# Status: PROPOSED (Pending Approval)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.4: AuthService core: Password hashing (bcrypt 12 rounds), JWT issuance, and Refresh Token Rotation (RTR)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem & Context
With the database schema, PII encryption, DTO contracts (`@vetralink/shared-types`), and repository interfaces (`IUserRepository`, `IRefreshTokenRepository`) in place, the application requires the domain service orchestrating authentication and session lifecycle: `AuthService`.

Authentication is the primary security boundary of the VETRALINK PRO platform. A production-grade enterprise auth service must guarantee:
1. **Strong Password Hashing**: Passwords hashed with `bcrypt` using 12 salt rounds (as enforced by `.antigravityrules`), immune to brute-force dictionary attacks.
2. **Secure JWT Issuance**: Short-lived (15 min default) access tokens signed with `JWT_ACCESS_SECRET`, carrying claims (`sub`, `email`, `role`, `status`, `activeFarmId`, `jti`).
3. **Single-Use Refresh Token Rotation (RTR)**: Long-lived (7 days default) refresh tokens stored as deterministic SHA-256 hashes in the database. Every refresh operation revokes the current token and issues an atomic new pair.
4. **Token Reuse & Hijacking Detection**: If an already-revoked refresh token is presented, the system immediately recognizes a replay attack / token theft, instantly invalidates **all active sessions** for that user, and aborts.
5. **Role Escalation Defense**: Public signups are strictly confined to `FARMER`, `VET`, or `BUYER`. `SUPER_ADMIN` and `ADMIN` registrations are rejected.

### 1.2 Objective & Deliverables
Task 2.4 delivers:
1. **Dependencies**: Adding `bcryptjs` + `@types/bcryptjs` and `@nestjs/jwt` to `@vetralink/api`.
2. **Password Hashing Module**:
   - `IPasswordHasher` interface contract.
   - `BcryptPasswordHasher` implementation (12 salt rounds).
3. **Token Service (`ITokenService` / `TokenService`)**:
   - Manages signing and verification of JWT access tokens.
   - Generates cryptographically secure random refresh tokens.
   - Computes deterministic SHA-256 hashes for database persistence.
4. **`IAuthService` Contract & `AUTH_SERVICE` Injection Token**:
   - Defines methods: `register`, `login`, `refreshToken`, `logout`, `logoutAll`.
5. **`AuthService` Implementation**:
   - Implements `IAuthService` orchestrating `IUserRepository`, `IRefreshTokenRepository`, `IPasswordHasher`, and `ITokenService`.
   - Atomically rotates refresh tokens inside a transaction.
   - Enforces token reuse detection and bulk session revocation.
6. **Module Wiring**:
   - `AuthModule` updated with `AuthService`, `TokenService`, `BcryptPasswordHasher`, and `@nestjs/jwt`.
7. **Comprehensive Unit Tests**:
   - `password-hasher.spec.ts`
   - `token.service.spec.ts`
   - `auth.service.spec.ts` (mocked repositories and token services, testing registration, login, rotation, reuse attacks, and session revocation).

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.4) |
| :--- | :--- | :--- |
| **Password Security** | No password hashing service exists. | `BcryptPasswordHasher` enforcing 12 rounds of bcrypt salt. |
| **Token Issuance** | No JWT signing or verification engine. | `@nestjs/jwt`-backed `TokenService` creating RFC-7519 compliant JWTs with 15m expiration and custom claims. |
| **Session Lifecycle** | Repositories exist, but no use cases coordinate them. | Full lifecycle orchestration: Register, Login, RTR, Logout, LogoutAll. |
| **Replay / Theft Protection**| None. | Automatic Refresh Token Reuse Detection revoking all family tokens on replay attempts. |
| **Role Escalation Defense** | DTO comments only. | Enforced in `AuthService.register()` throwing `ForbiddenOperationException` if elevated roles are submitted. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Password Hashing: `bcrypt` (C++ native) vs. `bcryptjs` (Pure JS)
- **Option A: `bcrypt`**
  - *Cons*: Relies on native node-gyp C++ compilation. On Windows developer environments and cross-platform CI containers, native rebuild failures and visual studio build tools mismatches are common points of failure.
- **Option B: `bcryptjs` (CHOSEN)**
  - *Pros*:
    1. 100% pure JavaScript, zero native build dependencies.
    2. Completely compatible with the standard bcrypt algorithm (`$2a$`, `$2b$`) and identical salt rounds (12).
    3. Flawless cross-platform portability between Windows, Linux, and macOS.
  - *Justification*: Provides identical cryptographic security guarantees without environment-dependent native compilation friction.

### 3.2 Refresh Token Format: Signed JWT vs. Opaque Cryptographic Hex Strings
- **Option A: Signed JWT for refresh tokens.**
  - *Cons*: Large payload (several hundred bytes); stateful revocation still requires database lookup anyway, negating the stateless advantage of JWTs.
- **Option B: Opaque High-Entropy Cryptographic String (`crypto.randomBytes(40).toString('hex')`) (CHOSEN)**
  - *Pros*:
    1. 320 bits of true cryptographic entropy.
    2. Compact size for mobile/web cookies and storage.
    3. Hashed with SHA-256 before database insertion (`token_hash`), ensuring that a database breach reveals zero usable tokens.
  - *Justification*: Industry standard for OAuth2/OIDC refresh tokens and RTR.

### 3.3 Refresh Token Rotation (RTR) & Reuse Detection Strategy
- When a refresh token is presented:
  - If valid and active: revoke current token and issue a new pair in an atomic transaction.
  - If the token was **already revoked**: an attacker or legitimate user is attempting to reuse an invalidated token (indicating that the token was leaked or intercepted).
  - **Action**: Immediately revoke **all active refresh tokens** belonging to the user (`revokeAllForUser`), terminate all sessions, and log a critical security event.

---

## 4. Data Models & Interface Contracts

### 4.1 `IPasswordHasher` (`apps/api/src/modules/auth/services/password-hasher.interface.ts`)

```typescript
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, passwordHash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = "PASSWORD_HASHER";
```

### 4.2 `ITokenService` (`apps/api/src/modules/auth/services/token.service.interface.ts`)

```typescript
export interface GenerateTokensParams {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  activeFarmId?: string;
}

export interface ITokenService {
  generateTokens(params: GenerateTokensParams): Promise<AuthTokensDto>;
  generateAccessToken(payload: JwtPayload): Promise<string>;
  generateRefreshToken(): string;
  hashRefreshToken(refreshToken: string): string;
  verifyAccessToken(token: string): Promise<JwtPayload>;
}

export const TOKEN_SERVICE = "TOKEN_SERVICE";
```

### 4.3 `IAuthService` (`apps/api/src/modules/auth/services/auth.service.interface.ts`)

```typescript
export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuthService {
  register(dto: RegisterRequestDto, meta?: ClientMetadata): Promise<RegisterResponseDto>;
  login(dto: LoginRequestDto, meta?: ClientMetadata): Promise<LoginResponseDto>;
  refreshToken(refreshToken: string, meta?: ClientMetadata): Promise<RefreshTokenResponseDto>;
  logout(refreshToken: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
}

export const AUTH_SERVICE = "AUTH_SERVICE";
```

---

## 5. Security & Edge Cases

1. **Timing Attack Protection**: Login verification returns generic `Invalid credentials.` whether the email was not found or the password was incorrect. If a user is not found, a dummy bcrypt comparison can be run or a constant-time path taken to prevent email enumeration via response timing.
2. **Elevated Role Injection**: Direct registration requests containing `SUPER_ADMIN` or `ADMIN` throw `ForbiddenOperationException`.
3. **Suspended Account Defense**: Suspended or deleted users cannot obtain tokens or rotate existing tokens.
4. **Token Hijacking Containment**: Single-use rotation paired with reuse detection invalidates the entire session family upon replay.
5. **ACID Transaction Bound**: Token revocation and new token creation occur in a database transaction (`TransactionManager` or `tx`), guaranteeing no orphaned or half-rotated states.
