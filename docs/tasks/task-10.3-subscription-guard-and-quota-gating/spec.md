# Task 10.3: Subscription Quota Guard & Tier Limits Interceptor Specification

## 1. Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech platform combining Livestock ERP, LMS/Digital Store, and Tele-Veterinary Telehealth. To enforce commercial tier monetization, safeguard computational and database resources, and uphold fair multi-tenant resource sharing, the platform requires an autonomous, real-time subscription tier quota gating engine.

Task 10.3 introduces **SubscriptionGuard & Tier Quota Enforcement**:
- Real-time interception and quota evaluation for tenant farms against their active subscription plan.
- Quota boundaries enforced:
  - `STARTER`: 5 animals max, 1 staff member (owner seat only), bulk import/export disabled.
  - `PRO`: 30 animals max, 3 staff members, bulk import/export enabled.
  - `ENTERPRISE`: Unlimited animals (`-1`), unlimited staff (`-1`), bulk import/export enabled.
- Interception points:
  1. Individual animal registration (`POST /animals` in `AnimalsController`).
  2. Bulk animal spreadsheet imports (`POST /animals/import` in `AnimalsController` & background batch processor).
  3. Farm staff / member additions and invitations (`POST /farms/:farmId/members` in `FarmsModule`).
- Rich, structured domain error reporting (`QuotaExceededDomainException` -> HTTP 403 Forbidden with `QUOTA_EXCEEDED` error code, current usage count, tier limit, and recommended upgrade tier).
- Diagnostic dashboard endpoint (`GET /api/v1/subscriptions/farm/:farmId/quota`) exposing real-time quota consumption for frontend UI meters.

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionTier` enum (`STARTER`, `PRO`, `ENTERPRISE`) exists in `prisma/schema.prisma` and `@vetralink/shared-types`.
- `SubscriptionPlanEntity` and `SubscriptionEntity` model tier metadata, price schedules, and subscription lifecycles.
- `AnimalsController.registerAnimal` and `AnimalsController.bulkImportAnimals` allow creating and importing animals without checking farm subscription tier limits.
- `FarmsModule` contains `FarmMemberRepository` and `FarmMemberEntity`, but has no public controller endpoints (`POST /farms/:farmId/members`) for inviting or adding farm staff members, and no quota checks on staff seats.
- There is no unified `SubscriptionQuotaGuard` or `@CheckQuota()` decorator to inspect tier boundaries.

### Proposed State
- `@vetralink/shared-types` exports:
  - `SubscriptionQuotaType` (`ANIMALS`, `STAFF`).
  - `SubscriptionQuotaUsageDto` detailing current usage, ceiling limit, remaining headroom, unlimited flag, and canAccommodate status.
  - `FarmQuotaSummaryDto` containing comprehensive quota status for animals, staff seats, and feature flags.
  - `AddFarmMemberDto` and `FarmMemberResponseDto`.
- `apps/api/src/common/exceptions/domain.exception.ts`:
  - `QuotaExceededDomainException` extending `DomainException` with HTTP 403 status code, code `"QUOTA_EXCEEDED"`, and typed `QuotaExceededDetails`.
- `apps/api/src/common/decorators/quota.decorator.ts`:
  - `@CheckQuota(type, increment?)` metadata decorator.
- `apps/api/src/modules/subscriptions/`:
  - `ISubscriptionUsageRepository` & `SubscriptionUsageRepository` querying active non-deleted animals and registered farm members.
  - `ISubscriptionQuotaService` & `SubscriptionQuotaService` orchestrating subscription resolution (falling back to default `STARTER` plan if no subscription record exists), verifying active/trialing validity, and asserting quota headroom.
  - `SubscriptionQuotaGuard` implementing `CanActivate`, extracting `farmId` from request context (`TenantGuard` context, `x-farm-id` header, route params, or body), and evaluating `@CheckQuota` metadata.
  - Controller endpoint `GET /api/v1/subscriptions/farm/:farmId/quota`.
- `apps/api/src/modules/animals/`:
  - `@CheckQuota(SubscriptionQuotaType.ANIMALS)` applied to `POST /animals` and `POST /animals/import`.
  - Feature verification in `bulkImportAnimals` (blocking bulk imports on `STARTER` plan with 403 Forbidden).
  - Row-level quota enforcement in `AnimalImportProcessor`.
- `apps/api/src/modules/farms/`:
  - `FarmMembersController` exposing `POST /farms/:farmId/members` with `@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionQuotaGuard)`, `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`, and `@CheckQuota(SubscriptionQuotaType.STAFF)`.
  - `FarmMembersService` managing membership creation and member retrieval.
- Comprehensive unit and integration test coverage across all affected modules.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Synchronous Guard Interception vs. Service-Level Verification vs. Dual Layer
- **Option A: Pure Guard-Only (Reflector + CanActivate)**:
  - *Pros*: Intercepts HTTP requests early before controllers execute; uniform declarative DX (`@CheckQuota(...)`).
  - *Cons*: Cannot easily inspect deep dynamic payloads (e.g. bulk CSV file row counts processed asynchronously in BullMQ worker).
- **Option B: Pure Service-Only (Injected Service)**:
  - *Pros*: Can dynamically check variable batch sizes (e.g. 25 animals in a single import file).
  - *Cons*: Repetitive imperative boilerplate in every controller/service handler.
- **Option C (Selected): Dual-Layer Defense (Guard Interceptor + Domain Service Assertion)**:
  - Route handlers declare `@CheckQuota(SubscriptionQuotaType.ANIMALS)` or `@CheckQuota(SubscriptionQuotaType.STAFF)` with `SubscriptionQuotaGuard` for instant fail-fast HTTP 403 responses before body parsing/allocation.
  - Asynchronous batch processors (`AnimalImportProcessor`) and domain services call `assertQuotaAvailable(farmId, quotaType, batchSize)` to prevent race conditions and enforce row-level quota integrity during asynchronous execution.

### Trade-off 2: Handling Unsubscribed Farms vs. Free Starter Defaults
- **Option A: Block all actions if no subscription record exists**:
  - *Cons*: Breaks onboarding flow if a newly created farm hasn't explicitly triggered a trial creation.
  - *Pros*: Strict.
- **Option B (Selected): Implicit STARTER Tier Fallback**:
  - If a farm has no explicit `Subscription` record in the database, `SubscriptionQuotaService` resolves to the system's authoritative `STARTER` plan (5 animals, 1 staff member).
  - Existing farms can register up to 5 animals without manual billing setup.
  - Once they exceed 5 animals or try to add a 2nd member, the guard intercepts with a clear prompt to upgrade to `PRO`.

### Trade-off 3: Avoiding Circular Module Dependencies
- **Option A: SubscriptionsModule imports AnimalsModule & FarmsModule; AnimalsModule & FarmsModule import SubscriptionsModule**:
  - *Cons*: Circular dependency in NestJS dependency injection graph (`forwardRef()` spaghetti, brittle test harnesses).
- **Option B (Selected): Inversion of Control with Dedicated Repository Interface**:
  - `SubscriptionsModule` encapsulates `ISubscriptionUsageRepository` (`SubscriptionUsageRepository`) that directly queries Prisma for `animal.count({ where: { farmId, deletedAt: null } })` and `farmMember.count({ where: { farmId } })`.
  - `SubscriptionsModule` does NOT depend on `AnimalsModule`.
  - `AnimalsModule` and `FarmsModule` import `SubscriptionsModule` and use `SubscriptionQuotaGuard` cleanly with zero circular dependencies.

---

## 4. Data Contracts & Interfaces

### 4.1 Shared Types (`@vetralink/shared-types`)

```typescript
export enum SubscriptionQuotaType {
  ANIMALS = "ANIMALS",
  STAFF = "STAFF",
}

export interface SubscriptionQuotaUsageDto {
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  canAccommodate: boolean;
  planTier: SubscriptionTier;
  upgradeTier: SubscriptionTier | null;
}

export interface FarmQuotaSummaryDto {
  farmId: string;
  planTier: SubscriptionTier;
  planName: string;
  isSubscriptionActive: boolean;
  quotas: {
    animals: SubscriptionQuotaUsageDto;
    staff: SubscriptionQuotaUsageDto;
  };
  features: {
    bulkImportExport: boolean;
    advancedAnalytics: boolean;
    customReports: boolean;
    teleVetPriority: string;
  };
}

export interface AddFarmMemberDto {
  userId: string;
  role?: FarmRole;
}

export interface FarmMemberResponseDto {
  id: string;
  farmId: string;
  userId: string;
  role: FarmRole;
  createdAt: string;
}
```

### 4.2 Domain Exception (`QuotaExceededDomainException`)

```typescript
export interface QuotaExceededDetails {
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  planTier: SubscriptionTier;
  upgradeTier: SubscriptionTier | null;
}

export class QuotaExceededDomainException extends DomainException {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly errorCode = "QUOTA_EXCEEDED";

  constructor(
    message: string,
    public override readonly details?: QuotaExceededDetails
  ) {
    super(message, details);
  }
}
```

---

## 5. Security & Multi-Tenancy Invariants

1. **Tenant Isolation**: Quota queries (`countActiveAnimals`, `countFarmMembers`, `findByFarmId`) always filter strictly by `farmId`.
2. **Soft Deletes**: Only active livestock (`deletedAt IS NULL`) consume animal quota. Sold, culled, or deceased animals that are retained in EHR history do not count against the limit if deleted or soft-deleted.
3. **Owner Seat Protection**: In `STARTER` plan, `maxStaff` is `1` (the farm owner). Attempting to add an employee or secondary herdsman requires upgrading to `PRO` (up to 3 staff members).
4. **Subscription Status Validation**: If a farm has an expired or canceled subscription that has exceeded its 3-day grace period (`canAccessService() === false`), quota creation checks throw `QuotaExceededDomainException` or `ForbiddenOperationException`.
