# PLAN-203: User & Refresh Token Repositories Implementation Plan
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.3: UserRepository and RefreshTokenRepository with interface contracts
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 2.1: User schema, migration, PII encryption service (`PiiCryptoService`), and `UserEntity`.
- [x] Task 2.2: Auth DTOs and contracts in `@vetralink/shared-types`.
- [x] Local testing environment passing all suites (`pnpm --filter @vetralink/api test`).

---

## 2. Granular Implementation Steps

### Step 1: `RefreshTokenEntity` Domain Entity & Unit Tests
- [x] Create `apps/api/src/modules/auth/entities/refresh-token.entity.ts`:
  - Properties: `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `ipAddress`, `userAgent`, `createdAt`.
  - Methods: `isValid(now?: Date)`, `isExpired(now?: Date)`, `isRevoked()`, `revoke(revokedAt?: Date)`.
  - Factory methods: `create(props)` and `reconstitute(props)`.
- [x] Create `apps/api/src/modules/auth/entities/refresh-token.entity.spec.ts`:
  - Test valid tokens, expired tokens, revoked tokens, and `revoke()` state transition.

### Step 2: `IUserRepository` Interface Contract
- [x] Create `apps/api/src/modules/users/repositories/user.repository.interface.ts`:
  - Define `FindUserOptions` (`includeDeleted?: boolean`).
  - Define `FindUsersFilter` (`role`, `status`, `search`, `page`, `pageSize`, `includeDeleted`).
  - Define `IUserRepository` interface with ACID transaction support (`tx?: Prisma.TransactionClient`).
  - Export injection symbol `USER_REPOSITORY = "USER_REPOSITORY"`.

### Step 3: `UserRepository` Implementation
- [x] Create `apps/api/src/modules/users/repositories/user.repository.ts`:
  - Injects `PrismaService` and `PiiCryptoService`.
  - Implements `IUserRepository`.
  - In `create()`: converts entity to Prisma create input, encrypting `phone` via `PiiCryptoService` if present.
  - In `update()`: updates fields and re-encrypts `phone` if altered.
  - In `findById()`, `findByEmail()`, `findByPhoneHash()`: queries Prisma with soft-delete filter by default; reconstitutes `UserEntity`, decrypting `phone` ciphertext transparently.
  - In `softDelete()`: updates `deletedAt = new Date()`.
  - In `existsByEmail()`, `existsByPhoneHash()`: low-overhead `count()` or `findFirst({ select: { id: true } })`.
- [x] Create `apps/api/src/modules/users/repositories/user.repository.spec.ts`:
  - Unit tests covering all methods, soft-delete filtering, PII encryption/decryption on read/write, and transaction client delegation.

### Step 4: `IRefreshTokenRepository` Interface Contract
- [x] Create `apps/api/src/modules/auth/repositories/refresh-token.repository.interface.ts`:
  - Define `IRefreshTokenRepository` methods: `create`, `findById`, `findByTokenHash`, `findActiveByUserId`, `revoke`, `revokeByTokenHash`, `revokeAllForUser`, `deleteExpiredTokens`.
  - Export injection symbol `REFRESH_TOKEN_REPOSITORY = "REFRESH_TOKEN_REPOSITORY"`.

### Step 5: `RefreshTokenRepository` Implementation
- [x] Create `apps/api/src/modules/auth/repositories/refresh-token.repository.ts`:
  - Injects `PrismaService`.
  - Implements `IRefreshTokenRepository`.
  - Reconstitutes `RefreshTokenEntity`.
  - Accepts optional `tx?: Prisma.TransactionClient`.
- [x] Create `apps/api/src/modules/auth/repositories/refresh-token.repository.spec.ts`:
  - Unit tests covering token persistence, lookup by hash, single revocation, batch user revocation, and transaction client delegation.

### Step 6: Module Wiring & Registration
- [x] Create `apps/api/src/modules/users/users.module.ts`:
  - Provides `USER_REPOSITORY` via `useClass: UserRepository`.
  - Exports `USER_REPOSITORY` and `UserRepository`.
- [x] Create `apps/api/src/modules/auth/auth.module.ts`:
  - Provides `REFRESH_TOKEN_REPOSITORY` via `useClass: RefreshTokenRepository`.
  - Exports `REFRESH_TOKEN_REPOSITORY` and `RefreshTokenRepository`.
- [x] Wire `UsersModule` and `AuthModule` into `apps/api/src/app.module.ts`.

### Step 7: Verification & Acceptance Testing
- [x] Run Jest unit tests across the entire monorepo (`pnpm --filter @vetralink/api test`).
- [x] Verify zero TypeScript errors (`pnpm --filter @vetralink/api build`).
- [x] Update `ROADMAP.md` marking Task 2.3 as complete (`[x]`).

---

## 3. Acceptance Criteria

1. **Strict Clean Architecture**: Neither `UserEntity` nor `RefreshTokenEntity` import Prisma types or ORM decorators.
2. **Interface Contracts**: Repositories adhere to `IUserRepository` and `IRefreshTokenRepository`, registered via symbols `USER_REPOSITORY` and `REFRESH_TOKEN_REPOSITORY`.
3. **PII Isolation**: `UserRepository` automatically encrypts phone to AES-256-GCM ciphertext on persist and decrypts on reconstitution.
4. **Soft Delete Safety**: Queries exclude records where `deletedAt != null` unless `includeDeleted: true` is explicitly passed.
5. **ACID Transactions**: All repository methods accept an optional `tx?: Prisma.TransactionClient` and execute within it when supplied.
6. **100% Test Pass Rate**: All unit tests in `user.repository.spec.ts`, `refresh-token.repository.spec.ts`, and `refresh-token.entity.spec.ts` pass with zero regressions.
