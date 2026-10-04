# PLAN-206: Multi-Tenant Protection Implementation Plan
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.6: Multi-tenant protection: `TenantGuard` enforcing farm isolation via `farm_members`
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 2.1: User entity schema and encryption.
- [x] Task 2.2: Auth DTOs and contracts in `@vetralink/shared-types`.
- [x] Task 2.3: `UserRepository` and `RefreshTokenRepository`.
- [x] Task 2.4: `AuthService` and `TokenService`.
- [x] Task 2.5: `@Roles()` decorator and `RolesGuard`.

---

## 2. Granular Implementation Steps

### Step 1: `FarmMemberEntity` Domain Model & Tests
- [x] Create `apps/api/src/modules/farms/entities/farm-member.entity.ts`:
  - Fields: `id`, `farmId`, `userId`, `role: FarmRole`, `createdAt`.
  - Predicates: `isOwner()`, `isManager()`, `canManageLivestock()`, `canManageHealth()`.
  - Factory methods: `create(props)`, `reconstitute(props)`.
- [x] Create `apps/api/src/modules/farms/entities/farm-member.entity.spec.ts`:
  - Test instantiation, validation rules, and role predicate methods.

### Step 2: `IFarmMemberRepository` Contract & `FarmMemberRepository` Implementation
- [x] Create `apps/api/src/modules/farms/repositories/farm-member.repository.interface.ts`:
  - Define `IFarmMemberRepository` interface with `findMembership(farmId, userId, tx?)`, `findUserFarms(userId, tx?)`, `create(member, tx?)`.
  - Export token `FARM_MEMBER_REPOSITORY = "FARM_MEMBER_REPOSITORY"`.
- [x] Create `apps/api/src/modules/farms/repositories/farm-member.repository.ts`:
  - Implements `IFarmMemberRepository` using `PrismaService`.
  - Verifies that associated farm is not soft-deleted (`farm.deletedAt === null`).
- [x] Create `apps/api/src/modules/farms/repositories/farm-member.repository.spec.ts`:
  - Test membership resolution, soft-deleted farm exclusion, and transaction client delegation.

### Step 3: Tenant Decorators & Tests
- [x] Create `apps/api/src/common/decorators/tenant.decorator.ts`:
  - `@Tenant(options?: { optional?: boolean })` (`TENANT_OPTIONS_KEY`).
  - `@FarmRoles(...roles: FarmRole[])` (`FARM_ROLES_KEY`).
  - `@CurrentFarm(prop?: 'id' | 'member')`.
- [x] Create `apps/api/src/common/decorators/tenant.decorator.spec.ts`:
  - Test decorator metadata attachment.

### Step 4: `TenantGuard` & Unit Tests
- [x] Create `apps/api/src/common/guards/tenant.guard.ts`:
  - Injects `Reflector` and `IFarmMemberRepository` (`@Inject(FARM_MEMBER_REPOSITORY)`).
  - Skips validation if `@Public()` route.
  - Extracts tenant ID from headers (`x-farm-id`, `x-tenant-id`), route params (`farmId`), or query string (`farmId`).
  - Validates UUID format.
  - Validates authenticated user exists.
  - Grants universal bypass to `SUPER_ADMIN`.
  - Verifies user membership in target farm.
  - Verifies farm role privileges against `@FarmRoles(...)`.
  - Injects `request.farmId` and `request.farmMember`.
- [x] Create `apps/api/src/common/guards/tenant.guard.spec.ts`:
  - Test header extraction (`x-farm-id`, `x-tenant-id`).
  - Test route param extraction (`:farmId`).
  - Test invalid UUID format throws `ValidationDomainException`.
  - Test non-member access throws `ForbiddenOperationException`.
  - Test `SUPER_ADMIN` bypass.
  - Test farm role authorization (owner bypass, insufficient role rejection).

### Step 5: Module Wiring
- [x] Create `apps/api/src/modules/farms/farms.module.ts`:
  - Provides `FARM_MEMBER_REPOSITORY` via `FarmMemberRepository`.
  - Exports `FARM_MEMBER_REPOSITORY`, `FarmMemberRepository`.
- [x] Create `apps/api/src/modules/farms/index.ts` with barrel exports.
- [x] Wire `FarmsModule` into `apps/api/src/app.module.ts`.
- [x] Export decorators and guard from `common/decorators/index.ts` and `common/guards/index.ts`.

### Step 6: Verification & Acceptance Testing
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 2.6.

---

## 3. Acceptance Criteria

1. **Strict Multi-Tenant Isolation**: No access granted to a farm's resources without active membership in `farm_members`.
2. **Soft-Deleted Farm Safety**: Membership lookup returns null if the parent farm is soft-deleted.
3. **Flexible Context Resolution**: Automatically resolves tenant ID from headers, route parameters, or query parameters.
4. **Farm-Level RBAC**: `@FarmRoles(...)` restricts endpoints to designated farm staff roles; `OWNER` automatically satisfies any farm role requirement.
5. **Super Admin Bypass**: `SUPER_ADMIN` can inspect any farm tenant without explicit membership.
6. **100% Test Pass Rate**: All unit tests pass with zero regressions.
