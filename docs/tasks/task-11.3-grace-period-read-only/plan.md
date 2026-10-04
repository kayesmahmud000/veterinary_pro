# Task 11.3: Grace Period Mechanism & Read-Only Access Restriction Plan

## Prerequisites
- `@vetralink/shared-types` builds cleanly.
- SubscriptionsModule, PrismaService, and existing guards functional.
- Tasks 11.1 and 11.2 complete.

---

## Implementation Steps

- [x] **Step 1: Enums & DTOs in `@vetralink/shared-types`**
  - Define `SubscriptionAccessMode` enum (`FULL_ACCESS`, `GRACE_PERIOD`, `READ_ONLY`, `SUSPENDED`).
  - Define `SubscriptionAccessStatusDto` and `SubscriptionSuspensionResultDto`.
  - Export from `packages/shared-types` and rebuild package.

- [x] **Step 2: Domain Entity Methods & Exceptions (`apps/api/src/modules/subscriptions`)**
  - Enhance `SubscriptionEntity`:
    - Add `getAccessMode(now?: Date): SubscriptionAccessMode`.
    - Add `canWrite(now?: Date): boolean`.
    - Add `canRead(now?: Date): boolean`.
    - Add `isReadOnly(now?: Date): boolean`.
    - Add `isSuspended(now?: Date): boolean`.
    - Add `suspend(now?: Date): void`.
  - Create domain exceptions in `apps/api/src/common/exceptions/domain.exception.ts`:
    - `SubscriptionReadOnlyException` (HTTP 403 / code: `SUBSCRIPTION_READ_ONLY`).
    - `SubscriptionSuspendedException` (HTTP 403 / code: `SUBSCRIPTION_SUSPENDED`).
  - Unit tests for entity access mode transitions.

- [x] **Step 3: Grace Period Service (`apps/api/src/modules/subscriptions/services`)**
  - Create `ISubscriptionGracePeriodService` and `SubscriptionGracePeriodService`:
    - `getAccessStatus(farmId: string, now?: Date): Promise<SubscriptionAccessStatusDto>`.
    - `assertWriteAccess(farmId: string, now?: Date): Promise<void>`.
    - `assertReadAccess(farmId: string, now?: Date): Promise<void>`.
    - `processSuspensions(asOfDate?: Date, traceId?: string): Promise<SubscriptionSuspensionResultDto>`.
  - Unit tests for `SubscriptionGracePeriodService`.

- [x] **Step 4: Guard & Decorators (`apps/api/src/modules/subscriptions/guards`)**
  - Create decorators in `apps/api/src/common/decorators/`:
    - `@AllowReadOnly()` / `ALLOW_READ_ONLY_KEY`.
    - `@RequireWriteAccess()` / `REQUIRE_WRITE_ACCESS_KEY`.
  - Create `SubscriptionReadOnlyGuard`:
    - Checks HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`).
    - Resolves farmId and asserts write access via `gracePeriodService.assertWriteAccess`.
    - Allows `GET` and routes marked `@AllowReadOnly()`.
  - Unit tests for `SubscriptionReadOnlyGuard`.

- [x] **Step 5: Controller & Module Wiring (`apps/api/src/modules/subscriptions`)**
  - Add `GET /api/v1/subscriptions/access-status` to `SubscriptionController`.
  - Add `POST /api/v1/subscriptions/dunning/suspensions/process` to `SubscriptionDunningController`.
  - Register `SubscriptionGracePeriodService` and `SubscriptionReadOnlyGuard` in `SubscriptionsModule`.

- [x] **Step 6: Unit & Integration Tests Verification**
  - Run full test suite for subscriptions module (`pnpm test -- src/modules/subscriptions`).
  - Verify acceptance criteria.
  - Mark checklist items complete in `plan.md` and update `ROADMAP.md`.

---

## Verification & Acceptance Criteria

1. **Access Mode Accuracy**:
   - Days 1–3 past-due: `GRACE_PERIOD` (read=true, write=true).
   - Days 4–7 past-due: `READ_ONLY` (read=true, write=false).
   - Day 8+ past-due: `SUSPENDED` (read=false, write=false).
   - Active/Trialing: `FULL_ACCESS` (read=true, write=true).
2. **Guard Interception**:
   - `GET` requests pass through under `READ_ONLY`.
   - `POST`, `PUT`, `PATCH`, `DELETE` throw `SubscriptionReadOnlyException` under `READ_ONLY`.
   - All requests throw `SubscriptionSuspendedException` under `SUSPENDED` (except `@AllowReadOnly()`).
3. **Suspension Sweeper**:
   - Subscriptions exceeding 7 days past due transition to `EXPIRED` status with audit log `SUBSCRIPTION_SUSPENDED_DUE_TO_DUNNING`.
