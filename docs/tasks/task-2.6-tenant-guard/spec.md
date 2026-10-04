# SPEC-206: Multi-Tenant Protection — `TenantGuard` Enforcing Farm Isolation via `farm_members`
# Status: PROPOSED (Pending Approval)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.6: Multi-tenant protection: `TenantGuard` enforcing farm isolation via `farm_members`
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem & Context
VETRALINK PRO is a multi-tenant SaaS ERP serving thousands of farms, ranging from smallholder dairy farms to large commercial livestock operations.
GUARDRAIL-05 in `.antigravityrules` explicitly dictates:
> "Every repository query MUST include farmId or tenantId scope where applicable. No cross-tenant data leakage — enforced at the repository layer."

To strictly protect tenant boundaries before request execution reaches domain services or repositories:
1. Every farm-scoped endpoint must resolve the active `farmId` context (from HTTP headers `x-farm-id`, route params `:farmId`, or query parameters `farmId`).
2. The system must verify that the authenticated user is an active member of that specific farm in `farm_members`.
3. The system must verify that the target farm has not been soft-deleted (`deletedAt IS NULL`).
4. Farm-level operations can optionally be restricted to specific farm roles (`FarmRole`: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) via declarative metadata (`@FarmRoles(...)`).
5. Platform `SUPER_ADMIN` users must possess universal oversight access to any tenant for support and system maintenance.

### 1.2 Objective & Deliverables
Task 2.6 delivers:
1. **`FarmMemberEntity` Domain Entity**:
   - Pure domain model encapsulating farm membership, role privileges (`isOwner()`, `isManager()`, `canManageLivestock()`), and invariants.
2. **`IFarmMemberRepository` Contract & `FARM_MEMBER_REPOSITORY` Injection Token**:
   - Decoupled interface for tenant membership resolution and farm-membership queries.
3. **`FarmMemberRepository` Implementation**:
   - Implements `IFarmMemberRepository` using `PrismaService`, validating both the junction `farm_members` record and that `farm.deletedAt IS NULL`.
4. **Tenant Decorators**:
   - `@Tenant(options?: { optional?: boolean })`: Marks endpoints requiring tenant resolution.
   - `@FarmRoles(...roles: FarmRole[])`: Enforces farm-level member privileges (e.g., only `OWNER` or `MANAGER` can update farm billing or invite staff).
   - `@CurrentFarm()` / `@CurrentTenant()`: Parameter decorator injecting the verified `farmId` and `FarmMemberEntity` into route handlers.
5. **`TenantGuard` Implementation**:
   - Intercepts incoming requests, extracts tenant ID from headers (`x-farm-id`, `x-tenant-id`), route params (`farmId`), or query string (`farmId`).
   - Validates UUID syntax.
   - Grants bypass to `SUPER_ADMIN`.
   - Validates user membership in the farm.
   - Validates required `FarmRole` permissions.
   - Injects `request.farmId` and `request.farmMember` into the request object.
6. **Module Wiring**:
   - `FarmsModule` registering `FARM_MEMBER_REPOSITORY` and exporting it.
   - `AppModule` importing `FarmsModule`.
7. **Comprehensive Unit Test Suites**:
   - `farm-member.entity.spec.ts`
   - `farm-member.repository.spec.ts`
   - `tenant.guard.spec.ts`

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.6) |
| :--- | :--- | :--- |
| **Tenant Isolation** | No tenant guard exists; queries would have to manually trust caller parameters. | `TenantGuard` intercepts requests and verifies membership before controllers execute. |
| **Farm Membership Model** | Only raw Prisma `FarmMember` schema exists. | Domain entity `FarmMemberEntity` with role predicates and validation. |
| **Membership Data Access** | None. | `IFarmMemberRepository` contract with `FarmMemberRepository` implementation. |
| **Farm-Level RBAC** | Only platform `UserRole` exists. | Granular `FarmRole` (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) enforced via `@FarmRoles()`. |
| **Tenant Context Injection** | None. | `@CurrentFarm()` parameter decorator extracting validated tenant ID or membership. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Tenant ID Extraction Strategy: Headers vs. Route Params vs. Query Params
- **Option A: Header only (`x-farm-id`).**
  - *Cons*: RESTful web routes like `GET /api/v1/farms/:farmId/animals` would force clients to duplicate `farmId` in both URL and headers.
- **Option B: Hierarchical Multi-Source Resolver (CHOSEN)**
  - *Order of precedence*:
    1. HTTP header `x-farm-id` or `x-tenant-id` (standard for API clients, SPAs, and mobile app API interceptors).
    2. Route parameter `:farmId` (standard for nested REST resources).
    3. Query parameter `?farmId=` (standard for exports, filters, and downloads).
  - *Justification*: Provides maximum developer ergonomics and full support for both RESTful URL routing and header-based client API gateways.

### 3.2 Tenant Denial Policy: 403 Forbidden vs. 404 Not Found
- **Option A: Always return 403 Forbidden.**
  - *Cons*: Leaks the existence of a farm UUID to an attacker who is probing valid tenant IDs.
- **Option B: Throw 403 Forbidden with generic message "Farm tenant not found or access denied." (CHOSEN)**
  - *Pros*: Prevents enumeration attacks by giving an identical opaque response whether the farm does not exist or the user has no membership in it.

### 3.3 Role Hierarchy within a Farm Tenant
- `FarmRole.OWNER`: Has complete administrative, financial, and personnel authority.
- `FarmRole.MANAGER`: Manages livestock, feed, milk production, and staff, but cannot delete the farm or transfer ownership.
- `FarmRole.HERDSMAN`: Logs daily milk yields, feeding records, and animal weights.
- `FarmRole.VET_STAFF`: Logs clinical health events, vaccinations, and deworming treatments.
- **Rule**: `OWNER` automatically satisfies any `@FarmRoles()` requirement.

---

## 4. Data Models & Interface Contracts

### 4.1 `FarmMemberEntity` (`apps/api/src/modules/farms/entities/farm-member.entity.ts`)

```typescript
export interface FarmMemberEntityProps {
  id: string;
  farmId: string;
  userId: string;
  role: FarmRole;
  createdAt: Date;
}

export class FarmMemberEntity {
  public get id(): string;
  public get farmId(): string;
  public get userId(): string;
  public get role(): FarmRole;
  public get createdAt(): Date;

  public isOwner(): boolean;
  public isManager(): boolean;
  public canManageLivestock(): boolean;
  public canManageHealth(): boolean;
}
```

### 4.2 `IFarmMemberRepository` (`apps/api/src/modules/farms/repositories/farm-member.repository.interface.ts`)

```typescript
export interface IFarmMemberRepository {
  findMembership(
    farmId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity | null>;

  findUserFarms(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity[]>;

  create(
    member: FarmMemberEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmMemberEntity>;
}

export const FARM_MEMBER_REPOSITORY = "FARM_MEMBER_REPOSITORY";
```

### 4.3 Decorators (`apps/api/src/common/decorators/`)

```typescript
// @Tenant(options?: { optional?: boolean })
export const TENANT_OPTIONS_KEY = "tenantOptions";
export const Tenant = (options?: { optional?: boolean }) =>
  SetMetadata(TENANT_OPTIONS_KEY, options ?? { optional: false });

// @FarmRoles(...roles: FarmRole[])
export const FARM_ROLES_KEY = "farmRoles";
export const FarmRoles = (...roles: FarmRole[]) =>
  SetMetadata(FARM_ROLES_KEY, roles);

// @CurrentFarm()
export const CurrentFarm = createParamDecorator(
  (data: "id" | "member" | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data === "id") return request.farmId;
    if (data === "member") return request.farmMember;
    return { farmId: request.farmId, member: request.farmMember };
  }
);
```

---

## 5. Security & Edge Cases

1. **Unauthenticated User Attempt**:
   - If `TenantGuard` executes on a route where `request.user` is missing (i.e. `JwtAuthGuard` did not run), it throws `UnauthorizedDomainException`, upholding fail-closed security.
2. **Invalid UUID Syntax**:
   - `farmId` is strictly validated against the RFC 4122 UUID regex. Malformed inputs throw `ValidationDomainException("Invalid farm tenant identifier.")`.
3. **Soft-Deleted Farm Access**:
   - If a farm was soft-deleted (`deletedAt !== null`), all membership lookups return `null`, rendering the tenant inaccessible.
4. **Cross-Tenant Parameter Injection**:
   - Once verified, `request.farmId` is stored immutably on the request object, guaranteeing downstream services and controllers pull from the trusted `request.farmId` rather than unvalidated body/query payloads.
