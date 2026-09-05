# PLAN-205: Role-Based Access Control Implementation Plan
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.5: Role-based access control: `@Roles()` decorator and `RolesGuard`
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 2.1: User entity schema and encryption.
- [x] Task 2.2: Auth DTOs and contracts in `@vetralink/shared-types`.
- [x] Task 2.3: `UserRepository` and `RefreshTokenRepository`.
- [x] Task 2.4: `AuthService` and `TokenService` with JWT issuance and verification.

---

## 2. Granular Implementation Steps

### Step 1: Decorators & Tests
- [x] Create `apps/api/src/common/decorators/roles.decorator.ts`:
  - `ROLES_KEY = "roles"`.
  - `@Roles(...roles: UserRole[])`.
- [x] Create `apps/api/src/common/decorators/public.decorator.ts`:
  - `IS_PUBLIC_KEY = "isPublic"`.
  - `@Public()`.
- [x] Create `apps/api/src/common/decorators/current-user.decorator.ts`:
  - `@CurrentUser(key?: keyof JwtPayload)`.
- [x] Create unit tests for decorators (`roles.decorator.spec.ts`, `current-user.decorator.spec.ts`).

### Step 2: `JwtAuthGuard` & Unit Tests
- [x] Create `apps/api/src/common/guards/jwt-auth.guard.ts`:
  - Injects `Reflector` and `ITokenService` (`@Inject(TOKEN_SERVICE)`).
  - Skips validation if `@Public()` is set.
  - Extracts and validates `Bearer` header.
  - Calls `tokenService.verifyAccessToken(token)`.
  - Sets `request.user = decodedPayload`.
- [x] Create `apps/api/src/common/guards/jwt-auth.guard.spec.ts`:
  - Test public route bypass.
  - Test missing header throws `UnauthorizedDomainException`.
  - Test invalid token format throws `UnauthorizedDomainException`.
  - Test valid token sets `request.user`.

### Step 3: `RolesGuard` & Unit Tests
- [x] Create `apps/api/src/common/guards/roles.guard.ts`:
  - Injects `Reflector`.
  - Reads `ROLES_KEY` from handler and class.
  - Bypasses if route is `@Public()` or has no roles defined.
  - Validates `request.user` exists (throws `UnauthorizedDomainException` if missing).
  - Validates `user.status !== SUSPENDED` (throws `ForbiddenOperationException` if suspended).
  - Grants bypass to `SUPER_ADMIN`.
  - Verifies `user.role` matches `requiredRoles` (throws `ForbiddenOperationException` if mismatched).
- [x] Create `apps/api/src/common/guards/roles.guard.spec.ts`:
  - Test allowed role succeeds.
  - Test missing role throws `ForbiddenOperationException`.
  - Test `SUPER_ADMIN` succeeds for any role.
  - Test suspended user throws `ForbiddenOperationException`.
  - Test unauthenticated user throws `UnauthorizedDomainException`.
  - Test no roles required succeeds.

### Step 4: Barrel Exports
- [x] Update `apps/api/src/common/decorators/index.ts`:
  - Export `roles.decorator.ts`, `public.decorator.ts`, `current-user.decorator.ts`.
- [x] Create `apps/api/src/common/guards/index.ts`:
  - Export `jwt-auth.guard.ts`, `roles.guard.ts`.

### Step 5: Verification & Acceptance Testing
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 2.5.

---

## 3. Acceptance Criteria

1. **Declarative RBAC**: Controllers and routes can be decorated with `@Roles(UserRole.VET, UserRole.ADMIN)`.
2. **Public Bypass**: Endpoints decorated with `@Public()` bypass JWT authentication and RBAC checks cleanly.
3. **Decoupled Guards**: `JwtAuthGuard` verifies access tokens and populates `request.user`; `RolesGuard` verifies permissions and account status.
4. **Superuser Bypass**: `SUPER_ADMIN` users bypass specific role restrictions.
5. **Suspension Defense**: Users with status `SUSPENDED` are rejected even if token signature is valid.
6. **100% Test Pass Rate**: All unit tests pass with zero regressions.
