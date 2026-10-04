# Task 10.1: Subscription Plan Configuration Implementation Plan

## Prerequisites
- PostgreSQL schema has `subscription_plans` table and `SubscriptionTier` enum.
- `packages/shared-types` exports `SubscriptionTier`.
- All previous tests pass cleanly.

---

## Implementation Steps

### Step 1: Shared Types & Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/subscription/subscription-plan.dto.ts`:
  - `SubscriptionPlanFeaturesDto`
  - `SubscriptionPlanDto`
  - `DEFAULT_TIER_LIMITS` and `DEFAULT_PLAN_CONFIGS`
- [x] Export in `packages/shared-types/src/dto/subscription/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: NestJS Validation & Response DTOs (`apps/api/src/modules/subscriptions/dto/`)
- [x] Create `create-subscription-plan.dto.ts` with `class-validator` and `@ApiProperty`.
- [x] Create `update-subscription-plan.dto.ts`.
- [x] Create `subscription-plan-response.dto.ts`.
- [x] Create `query-subscription-plans.dto.ts`.
- [x] Export via `apps/api/src/modules/subscriptions/dto/index.ts`.

### Step 3: Domain Entity (`apps/api/src/modules/subscriptions/entities/`)
- [x] Implement `SubscriptionPlanEntity` in `subscription-plan.entity.ts`:
  - Pure domain model without ORM dependencies.
  - Quota predicates: `isUnlimitedAnimals()`, `canAccommodateAnimals(count)`, `allowsStaffMembers(count)`.
  - Feature helpers: `hasFeature(key)`, `getFeature<T>(key)`.
  - Financial helpers: `calculateAnnualSavingsCents()`.
- [x] Unit tests in `subscription-plan.entity.spec.ts`.

### Step 4: Repository Layer (`apps/api/src/modules/subscriptions/repositories/`)
- [x] Define `ISubscriptionPlanRepository` interface in `subscription-plan.repository.interface.ts`.
- [x] Implement `SubscriptionPlanRepository` in `subscription-plan.repository.ts` using `PrismaService`.
- [x] Unit tests in `subscription-plan.repository.spec.ts`.

### Step 5: Domain Service Layer (`apps/api/src/modules/subscriptions/services/`)
- [x] Define `ISubscriptionPlanService` interface in `subscription-plan.service.interface.ts`.
- [x] Implement `SubscriptionPlanService` in `subscription-plan.service.ts`:
  - `onModuleInit()`: Idempotent seed verification on startup.
  - `getActivePlans()`, `getPlanByTier(tier)`, `getPlanById(id)`.
  - `seedDefaultPlans()` and `updatePlan(id, dto)`.
- [x] Unit tests in `subscription-plan.service.spec.ts`.

### Step 6: Controller Layer (`apps/api/src/modules/subscriptions/`)
- [x] Create `SubscriptionPlanController` in `subscription-plan.controller.ts`:
  - `GET /api/v1/subscriptions/plans` (Public/Authenticated).
  - `GET /api/v1/subscriptions/plans/:tier` (Public/Authenticated).
  - `POST /api/v1/subscriptions/plans/seed` (Guarded: `JwtAuthGuard` + `RolesGuard(SUPER_ADMIN, ADMIN)`).
- [x] Unit tests in `subscription-plan.controller.spec.ts`.

### Step 7: Module Wiring & App Bootstrap
- [x] Create `SubscriptionsModule` in `subscriptions.module.ts`.
- [x] Wire `SubscriptionsModule` into `AppModule`.
- [x] Verify `app.bootstrap.spec.ts` passes with 0 DI errors.

### Step 8: Comprehensive Verification
- [x] Run subscription tests: `pnpm --filter @vetralink/api test -- src/modules/subscriptions`.
- [x] Run full API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build: `pnpm build`.
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`.
