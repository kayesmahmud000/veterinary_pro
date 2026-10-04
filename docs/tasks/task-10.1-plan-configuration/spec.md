# Task 10.1: Subscription Plan Configuration Specification

## 1. Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech platform combining Livestock ERP, LMS/Digital Store, and Tele-Veterinary Telehealth. To establish a sustainable commercial model and protect infrastructure resources, the system requires a multi-tier subscription engine with quota gating.

Task 10.1 establishes the foundational **Plan Configuration Engine**:
- Tier Definitions: `STARTER` (Free / 5 animals max), `PRO` ($9/mo, $89/yr / 30 animals max), and `ENTERPRISE` ($29/mo, $289/yr / Unlimited animals).
- Domain entity representation with capability checks (`isUnlimitedAnimals()`, `canAccommodateAnimals(count)`, `hasFeature(key)`).
- Safe, idempotent plan initialization and seeding.
- High-performance, clean architecture service and repository layers.
- REST API endpoints for catalog discovery (public/tenant) and plan governance (admin).

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionTier` (`STARTER`, `PRO`, `ENTERPRISE`) enum exists in Prisma schema and `packages/shared-types`.
- `SubscriptionPlan` table exists in PostgreSQL schema (`0_init/migration.sql`), with columns: `id`, `name`, `tier`, `price_monthly_cents`, `price_annual_cents`, `max_animals`, `features`, `is_active`, `created_at`.
- No NestJS module, domain entities, repositories, or services exist for subscriptions.
- There are no runtime APIs or seeding logic to serve plan metadata or enforce animal tier limits.

### Proposed State
- Dedicated NestJS module `apps/api/src/modules/subscriptions/`.
- Domain Entity `SubscriptionPlanEntity` encapsulating tier rules, quota predicates, and pricing calculations.
- Clean repository interface `ISubscriptionPlanRepository` and Prisma implementation.
- Service `ISubscriptionPlanService` with automatic on-boot idempotent initialization of standard tiers and CRUD query methods.
- Shared DTOs in `packages/shared-types` (`SubscriptionPlanDto`, `SubscriptionPlanFeaturesDto`).
- REST Controller `SubscriptionPlanController` exposing public discovery (`/api/v1/subscriptions/plans`, `/api/v1/subscriptions/plans/:tier`) and admin seeding/management.
- 100% test coverage with zero regressions across the monorepo.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Hardcoded Configuration vs. Database-Driven Model vs. Hybrid
- **Option A: Purely Hardcoded in Code (Constants)**:
  - *Pros*: Zero DB lookups, fast.
  - *Cons*: Cannot update prices, promotion copy, or feature flags without full code redeployment; cannot associate foreign keys from `subscriptions` table.
- **Option B: Purely Dynamic Database Table**:
  - *Pros*: Completely dynamic.
  - *Cons*: Can drift if code expects specific tier limits (`STARTER` having 5 animals, `PRO` having 30); prone to missing seeds in clean test/staging environments.
- **Option C (Selected): Hybrid Architecture (DB-Backed with Strongly Typed Domain Enums & Idempotent Bootstrap)**:
  - Strongly typed `SubscriptionTier` enum guarantees compile-time safety and relations in Prisma.
  - `SubscriptionPlan` database records provide runtime flexibility and relational integrity.
  - Default plans are defined in code constants and automatically upserted idempotently on module startup, ensuring test suites and new environments always have consistent plan data.

### Trade-off 2: Modeling "Unlimited" Quotas
- **Option A: Nullable `maxAnimals`**:
  - *Cons*: Nullable integers often lead to null-pointer bugs or ambiguity between "unknown/unconfigured" and "unlimited".
- **Option B (Selected): Sentinel Value `-1` with Domain Helper**:
  - `max_animals: -1` is a standard SaaS convention for unlimited capacity.
  - The domain entity encapsulates this logic (`isUnlimitedAnimals() => this.maxAnimals < 0 || this.maxAnimals >= 999999`) so business logic never leaks raw sentinel checks.

---

## 4. Plan Specifications

| Attribute | `STARTER` | `PRO` | `ENTERPRISE` |
| :--- | :--- | :--- | :--- |
| **Name** | Starter | Pro Farmer | Commercial Enterprise |
| **Tier Key** | `STARTER` | `PRO` | `ENTERPRISE` |
| **Monthly Price** | $0.00 (`0` cents) | $9.00 (`900` cents) | $29.00 (`2900` cents) |
| **Annual Price** | $0.00 (`0` cents) | $89.00 (`8900` cents) | $289.00 (`28900` cents) |
| **Animal Quota** | **5 animals** | **30 animals** | **Unlimited** (`-1`) |
| **Staff Members** | 1 (Owner only) | 3 members | Unlimited (`-1`) |
| **Tele-Vet Priority** | Standard | Expedited | Priority VIP |
| **Advanced Analytics** | No (`false`) | Yes (`true`) | Yes (`true`) |
| **Bulk Import/Export** | No (`false`) | Yes (`true`) | Yes (`true`) |
| **Custom Reports** | No (`false`) | No (`false`) | Yes (`true`) |

---

## 5. Data Contracts & Interfaces

### 5.1 Shared Types (`packages/shared-types`)
```typescript
export interface SubscriptionPlanFeaturesDto {
  maxAnimals: number;
  maxStaff: number;
  teleVetPriority: 'STANDARD' | 'EXPEDITED' | 'PRIORITY';
  advancedAnalytics: boolean;
  bulkImportExport: boolean;
  customReports: boolean;
  [key: string]: unknown;
}

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxAnimals: number;
  features: SubscriptionPlanFeaturesDto;
  isActive: boolean;
  createdAt: string;
}
```

### 5.2 API Request & Response Contracts
- **GET `/api/v1/subscriptions/plans`**
  - Query: `includeInactive?: boolean` (default: false)
  - Returns: `ApiResponse<SubscriptionPlanDto[]>`
  - Auth: Public / Optional JWT
- **GET `/api/v1/subscriptions/plans/:tier`**
  - Param: `tier` (`STARTER`, `PRO`, `ENTERPRISE`)
  - Returns: `ApiResponse<SubscriptionPlanDto>`
  - Auth: Public / Optional JWT
- **POST `/api/v1/subscriptions/plans/seed`**
  - Resets / syncs default plans idempotently
  - Returns: `ApiResponse<SubscriptionPlanDto[]>`
  - Auth: Required JWT + Roles (`SUPER_ADMIN`, `ADMIN`)

---

## 6. Security & Edge Cases
1. **Tier Immutability**: The tier field (`STARTER`, `PRO`, `ENTERPRISE`) is unique and serves as the billing anchor.
2. **Graceful Defaults**: If the database has not yet run seeds, `onModuleInit` in NestJS automatically checks and seeds the plans without blocking the request pipeline.
3. **Admin Guarding**: Mutation and seed endpoints are guarded with `JwtAuthGuard` and `RolesGuard(SUPER_ADMIN, ADMIN)`.
