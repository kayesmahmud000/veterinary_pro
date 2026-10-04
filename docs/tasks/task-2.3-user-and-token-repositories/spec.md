# SPEC-203: User & Refresh Token Repositories with Interface Contracts
# Status: PROPOSED (Pending Approval)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.3: UserRepository and RefreshTokenRepository with interface contracts
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem & Context
In the previous tasks of Sprint 2, we:
- Established the `User` and `RefreshToken` database schema with AES-256-GCM PII encryption and HMAC-SHA256 blind indexing for phone numbers (Task 2.1).
- Modeled the core domain entity `UserEntity` with business rules, lifecycle invariants, and safe serialization.
- Created canonical DTO contracts (`RegisterRequestDto`, `LoginRequestDto`, `AuthTokensDto`, etc.) in `@vetralink/shared-types` (Task 2.2).

Before developing the `AuthService` (Task 2.4) and implementing password verification, JWT issuance, and Refresh Token Rotation (RTR), the application requires a robust, decoupled **Data Access Layer (Repository Layer)** conforming to **Clean Architecture** and the **Dependency Inversion Principle (DIP)**.

Directly coupling services to Prisma ORM (`PrismaService`) violates Clean Architecture, leaks persistence details into business logic, hinders mockability during unit testing, and risks leaking database ORM records into presentation boundaries.

### 1.2 Objective & Deliverables
Task 2.3 delivers:
1. **`RefreshTokenEntity` Domain Model** (`apps/api/src/modules/auth/entities/refresh-token.entity.ts`):
   - Encapsulates refresh token state, expiration rules, revocation logic, and token validation invariants.
2. **`IUserRepository` Contract & `USER_REPOSITORY` Injection Token** (`apps/api/src/modules/users/repositories/user.repository.interface.ts`):
   - Strict interface defining all persistence use cases for `User` domain entities, including soft-delete awareness, blind index lookups (`findByPhoneHash`), transaction participation (`tx?: Prisma.TransactionClient`), and uniqueness checks.
3. **`UserRepository` Implementation** (`apps/api/src/modules/users/repositories/user.repository.ts`):
   - Implements `IUserRepository`.
   - Bridges Prisma ORM records and pure `UserEntity` domain models.
   - Integrates seamlessly with `PiiCryptoService` to transparently encrypt phone numbers on persistence and decrypt them during hydration into `UserEntity`.
4. **`IRefreshTokenRepository` Contract & `REFRESH_TOKEN_REPOSITORY` Token** (`apps/api/src/modules/auth/repositories/refresh-token.repository.interface.ts`):
   - Interface defining atomic creation, lookup by SHA-256 hash (`findByTokenHash`), single revocation, batch revocation per user (`revokeAllForUser`), and expired token garbage collection.
5. **`RefreshTokenRepository` Implementation** (`apps/api/src/modules/auth/repositories/refresh-token.repository.ts`):
   - Implements `IRefreshTokenRepository` using `PrismaService` with transaction support.
6. **Module Composition Root Updates**:
   - `UsersModule` updated to provide `USER_REPOSITORY` using class provider syntax.
   - `AuthModule` created to provide `REFRESH_TOKEN_REPOSITORY` and wire into `AppModule`.
7. **Comprehensive Unit Test Suites**:
   - `refresh-token.entity.spec.ts`: Unit tests validating token validation, expiration calculation, and revocation states.
   - `user.repository.spec.ts`: Unit tests verifying `UserRepository` operations, soft-delete filtering, PII encryption/decryption handling, and transaction client propagation.
   - `refresh-token.repository.spec.ts`: Unit tests verifying `RefreshTokenRepository` token creation, hash lookups, user batch revocation, and transaction propagation.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.3) |
| :--- | :--- | :--- |
| **User Data Access** | No repository exists. Direct Prisma queries would be required. | `IUserRepository` contract with concrete `UserRepository`, returning domain `UserEntity` instances. |
| **PII Boundary** | `PiiCryptoService` exists, but must be called manually by caller. | `UserRepository` handles transparent PII encryption/decryption at the persistence boundary. Domain entity holds plaintext phone in memory; DB stores ciphertext and blind index. |
| **Token Domain Model** | None. Refresh token only exists as a raw Prisma schema model. | Rich domain entity `RefreshTokenEntity` with state methods (`isValid()`, `isRevoked()`, `isExpired()`, `revoke()`). |
| **Token Data Access** | None. | `IRefreshTokenRepository` and `RefreshTokenRepository` supporting RTR, hash lookups, and batch user revocations. |
| **Transaction Participation** | Supported by `TransactionManager` and `PrismaService`, but no repo contracts accept `tx`. | All repository mutation methods accept optional `tx?: Prisma.TransactionClient`, enabling multi-operation ACID transactions. |
| **Dependency Inversion** | Not wired. | Services will inject `@Inject(USER_REPOSITORY)` and `@Inject(REFRESH_TOKEN_REPOSITORY)`, decoupling business logic from Prisma. |

---

## 3. Architectural & Design Trade-offs

### 3.1 PII Crypto Integration: Service Layer vs. Repository Layer
- **Option A: Service Layer performs encryption/decryption before passing to/from repository.**
  - *Cons*: Every service interacting with users (AuthService, ProfileService, FarmService, TeleVetService) would need to inject `PiiCryptoService`, duplicate encryption/decryption logic, and manually compute blind indices (`phoneHash`). Missing an encryption call could leak plaintext PII to the database.
- **Option B: Repository Layer encapsulates PII encryption and decryption (CHOSEN).**
  - *Pros*:
    1. **Encapsulation**: The repository is solely responsible for translating between in-memory domain concepts and database storage formats.
    2. **Guaranteed Security**: The database *never* receives plaintext phone numbers, and domain services *never* have to parse ciphertexts.
    3. **Clean Domain Model**: `UserEntity` operates with clean, validated phone numbers in memory (e.g. for SMS formatting or UI masking), while the database layer guarantees at-rest encryption and blind-index lookups.
  - *Justification*: Aligns strictly with Domain-Driven Design (DDD) and Clean Architecture. Persistence representations (AES ciphertexts, blind HMAC hashes) belong in the data mapping layer.

### 3.2 Refresh Token Security: Raw Token Storage vs. SHA-256 Hash Storage
- **Option A: Store raw JWT or opaque refresh token strings directly in `refresh_tokens.token_hash`.**
  - *Cons*: If the database is compromised via SQL injection or unauthorized dump, attackers obtain valid refresh tokens and can hijack all user sessions.
- **Option B: Store deterministic SHA-256 hash of refresh tokens in the database (CHOSEN & ALIGNED WITH SCHEMA).**
  - *Pros*:
    1. The client holds the secret refresh token.
    2. The database stores only `token_hash = SHA256(token)`.
    3. An attacker with read access to the database cannot generate valid refresh requests.
    4. Fast, indexed exact-match lookup on `token_hash` (`@@unique([token_hash])`).

### 3.3 Soft-Delete Handling: Default Exclusion vs. Explicit Method Calls
- **Option A: Default query excludes soft-deleted rows; provide `{ includeDeleted?: boolean }` options.**
  - *Pros*: Prevents accidental data resurrection or unauthorized access to deleted users.
  - *Pros*: Retains audit integrity by preserving records with `deletedAt` timestamps.
  - *Decision*: Adopt Option A for `findById`, `findByEmail`, and `findByPhoneHash`.

---

## 4. Data Models & Interface Contracts

### 4.1 `RefreshTokenEntity` (`apps/api/src/modules/auth/entities/refresh-token.entity.ts`)

```typescript
export interface RefreshTokenEntityProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateRefreshTokenProps {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class RefreshTokenEntity {
  public static create(props: CreateRefreshTokenProps): RefreshTokenEntity;
  public static reconstitute(props: RefreshTokenEntityProps): RefreshTokenEntity;

  public get id(): string;
  public get userId(): string;
  public get tokenHash(): string;
  public get expiresAt(): Date;
  public get revokedAt(): Date | null;
  public get ipAddress(): string | null;
  public get userAgent(): string | null;
  public get createdAt(): Date;

  public isValid(now?: Date): boolean;
  public isExpired(now?: Date): boolean;
  public isRevoked(): boolean;
  public revoke(revokedAt?: Date): void;
}
```

### 4.2 `IUserRepository` (`apps/api/src/modules/users/repositories/user.repository.interface.ts`)

```typescript
export interface FindUserOptions {
  includeDeleted?: boolean;
}

export interface FindUsersFilter {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface IUserRepository {
  create(user: UserEntity, tx?: Prisma.TransactionClient): Promise<UserEntity>;
  findById(id: string, options?: FindUserOptions, tx?: Prisma.TransactionClient): Promise<UserEntity | null>;
  findByEmail(email: string, options?: FindUserOptions, tx?: Prisma.TransactionClient): Promise<UserEntity | null>;
  findByPhoneHash(phoneHash: string, options?: FindUserOptions, tx?: Prisma.TransactionClient): Promise<UserEntity | null>;
  update(user: UserEntity, tx?: Prisma.TransactionClient): Promise<UserEntity>;
  softDelete(id: string, deletedAt?: Date, tx?: Prisma.TransactionClient): Promise<void>;
  findMany(filter?: FindUsersFilter, tx?: Prisma.TransactionClient): Promise<{ items: UserEntity[]; total: number }>;
  existsByEmail(email: string, tx?: Prisma.TransactionClient): Promise<boolean>;
  existsByPhoneHash(phoneHash: string, tx?: Prisma.TransactionClient): Promise<boolean>;
}

export const USER_REPOSITORY = "USER_REPOSITORY";
```

### 4.3 `IRefreshTokenRepository` (`apps/api/src/modules/auth/repositories/refresh-token.repository.interface.ts`)

```typescript
export interface IRefreshTokenRepository {
  create(token: RefreshTokenEntity, tx?: Prisma.TransactionClient): Promise<RefreshTokenEntity>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<RefreshTokenEntity | null>;
  findByTokenHash(tokenHash: string, tx?: Prisma.TransactionClient): Promise<RefreshTokenEntity | null>;
  findActiveByUserId(userId: string, tx?: Prisma.TransactionClient): Promise<RefreshTokenEntity[]>;
  revoke(id: string, revokedAt?: Date, tx?: Prisma.TransactionClient): Promise<void>;
  revokeByTokenHash(tokenHash: string, revokedAt?: Date, tx?: Prisma.TransactionClient): Promise<void>;
  revokeAllForUser(userId: string, revokedAt?: Date, tx?: Prisma.TransactionClient): Promise<number>;
  deleteExpiredTokens(beforeDate?: Date, tx?: Prisma.TransactionClient): Promise<number>;
}

export const REFRESH_TOKEN_REPOSITORY = "REFRESH_TOKEN_REPOSITORY";
```

---

## 5. Security & Edge Cases

1. **PII Protection at Rest**:
   - Stored phone numbers are encrypted with AES-256-GCM using IV + AuthTag.
   - If decryption fails (corrupted data or tampered ciphertext), the repository logs an error and safely omits the plaintext phone rather than crashing unhandled, while throwing domain exceptions when strict decryption is mandatory.
2. **Deterministic Lookup via HMAC Blind Index**:
   - Searching by phone queries `phone_hash` with `HMAC-SHA256(normalizedPhone, HASH_PEPPER)`.
   - Case/whitespace variations in phone numbers are eliminated via phone normalization before hashing.
3. **Transaction Safety**:
   - All repository methods accept `tx?: Prisma.TransactionClient`.
   - When passed, operations run within the ambient transaction; otherwise, they execute against `PrismaService`.
4. **Token Revocation Race Conditions**:
   - `revokeByTokenHash` updates `revokedAt` atomically. If the token is already revoked, the method completes idempotently without throwing unhandled exceptions.
5. **Soft-Delete Guardrails**:
   - `deletedAt: null` is enforced across default queries, preventing deactivated or deleted users from authenticating.
