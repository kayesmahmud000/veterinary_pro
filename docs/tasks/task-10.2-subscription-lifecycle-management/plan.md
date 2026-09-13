# Task 10.2: Subscription Lifecycle Management Implementation Plan

## Prerequisites
- Task 10.1 (`SubscriptionPlan` domain model, repository, service, and controller) completed.
- PostgreSQL schema has `subscriptions` table and `SubscriptionStatus` enum.
- All previous tests pass cleanly.

---

## Implementation Steps

### Step 1: Shared Types & Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/subscription/subscription-lifecycle.dto.ts`:
  - `SubscriptionResponseDto`
  - `CreateTrialSubscriptionDto`
  - `CancelSubscriptionRequestDto`
  - `UpdateSubscriptionStatusDto`
- [x] Export in `packages/shared-types/src/dto/subscription/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: NestJS Validation & Request DTOs (`apps/api/src/modules/subscriptions/dto/`)
- [x] Create `create-trial-subscription.dto.ts`.
- [x] Create `cancel-subscription.dto.ts`.
- [x] Create `update-subscription-status.dto.ts`.
- [x] Create `subscription-response.dto.ts`.
- [x] Export in `apps/api/src/modules/subscriptions/dto/index.ts`.

### Step 3: Domain Entity (`apps/api/src/modules/subscriptions/entities/`)
- [x] Implement `SubscriptionEntity` in `subscription.entity.ts`:
  - State machine predicates: `isActive()`, `isInTrial()`, `isPastDue()`, `isCanceled()`, `isExpired()`, `canAccessService()`.
  - State transitions: `activate(periodEnd, gatewaySubId)`, `markPastDue()`, `requestCancellation(immediate)`, `revokeCancellation()`, `expire()`, `renew(periodEnd)`.
  - Computed properties: `daysRemaining()`.
- [x] Create unit tests in `subscription.entity.spec.ts`.

### Step 4: Repository Layer (`apps/api/src/modules/subscriptions/repositories/`)
- [x] Define `ISubscriptionRepository` interface in `subscription.repository.interface.ts`.
- [x] Implement `SubscriptionRepository` in `subscription.repository.ts` using `PrismaService`:
  - `findById(id)`
  - `findByFarmId(farmId)`
  - `findByUserId(userId)`
  - `findByGatewaySubId(gatewaySubId)`
  - `save(subscription)`
  - `findExpiredSubscriptions(now)`
- [x] Create unit tests in `subscription.repository.spec.ts`.

### Step 5: Domain Service Layer (`apps/api/src/modules/subscriptions/services/`)
- [x] Define `ISubscriptionLifecycleService` in `subscription-lifecycle.service.interface.ts`.
- [x] Implement `SubscriptionLifecycleService` in `subscription-lifecycle.service.ts`:
  - `createTrialSubscription(dto)`
  - `getFarmSubscription(farmId)`
  - `getUserSubscription(userId, farmId)`
  - `activateSubscription(id, params)`
  - `markSubscriptionPastDue(id)`
  - `cancelSubscription(id, params)`
  - `reactivateSubscription(id)`
  - `processExpiredSubscriptions()`
- [x] Create unit tests in `subscription-lifecycle.service.spec.ts`.

### Step 6: Controller Layer (`apps/api/src/modules/subscriptions/`)
- [x] Create `SubscriptionController` in `subscription.controller.ts`:
  - `GET /api/v1/subscriptions/current` (Public / Tenant)
  - `POST /api/v1/subscriptions/trial`
  - `POST /api/v1/subscriptions/:id/cancel`
  - `POST /api/v1/subscriptions/:id/reactivate`
  - `PATCH /api/v1/subscriptions/:id/status` (Admin)
- [x] Create unit tests in `subscription.controller.spec.ts`.

### Step 7: Module Wiring & App Bootstrap
- [x] Register `SubscriptionRepository`, `SubscriptionLifecycleService`, and `SubscriptionController` in `SubscriptionsModule`.
- [x] Verify `app.bootstrap.spec.ts` passes with 0 DI errors.

### Step 8: Comprehensive Verification
- [x] Run all subscription tests: `pnpm --filter @vetralink/api test -- src/modules/subscriptions`.
- [x] Run full API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build: `pnpm build`.
- [x] Check off all tasks in `plan.md` and update `ROADMAP.md`.
