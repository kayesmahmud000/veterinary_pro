# Task 10.4: Upgrade & Downgrade Subscription Flow with Prorated Billing Calculation Plan

## Prerequisites
- Monorepo packages build cleanly (`@vetralink/shared-types`, `apps/api`).
- Existing `SubscriptionPlanEntity`, `SubscriptionEntity`, and `SubscriptionQuotaService` functional.

---

## Implementation Steps

- [x] **Step 1: Type Contracts & DTOs (`packages/shared-types`)**
  - Define `SubscriptionBillingInterval` (`MONTHLY`, `ANNUAL`).
  - Define `SubscriptionPlanChangeType` (`UPGRADE`, `DOWNGRADE`, `INTERVAL_CHANGE`, `NO_CHANGE`).
  - Define `PreviewSubscriptionPlanChangeDto` & `ChangeSubscriptionPlanDto`.
  - Define `SubscriptionProrationBreakdownDto`, `SubscriptionProrationPreviewDto`, and `SubscriptionChangeResultDto`.
  - Export from `packages/shared-types/src/index.ts` and build shared types package.

- [x] **Step 2: Domain Proration Calculator (`apps/api/src/modules/subscriptions/domain`)**
  - Implement `SubscriptionProrationCalculator` domain service with pure functional methods.
  - Calculate period elapsed ratio, unused credit, target plan cost, net amount due, and credit balance.
  - Detect change type (`UPGRADE`, `DOWNGRADE`, `INTERVAL_CHANGE`, `NO_CHANGE`).
  - Write dedicated unit tests in `subscription-proration-calculator.spec.ts`.

- [x] **Step 3: Subscription Entity Enhancements (`apps/api/src/modules/subscriptions/entities`)**
  - Add `changePlan(...)` domain method on `SubscriptionEntity` to transition plan, period start/end, and reset status to `ACTIVE`.
  - Fix timestamp awareness in `toResponseDto(now?: Date)` to allow deterministic testing across time boundaries.
  - Unit test entity plan change transitions in `subscription.entity.spec.ts`.

- [x] **Step 4: Subscription Plan Change Service (`apps/api/src/modules/subscriptions/services`)**
  - Create `ISubscriptionPlanChangeService` and `SubscriptionPlanChangeService`.
  - Implement `previewPlanChange`:
    - Resolve current subscription and target plan.
    - Check quota violations for downgrades (animals and staff seats).
    - Compute prorated billing breakdown.
  - Implement `changePlan`:
    - Authorize user (subscription owner, farm owner/manager, or admin).
    - Validate target plan and current subscription status.
    - Assert no quota violations on downgrade.
    - Calculate proration.
    - Mutate subscription inside Prisma transaction with audit log record.
  - Register in `SubscriptionsModule`.
  - Unit test in `subscription-plan-change.service.spec.ts`.

- [x] **Step 5: Controller Endpoints & Validation DTOs (`apps/api/src/modules/subscriptions`)**
  - Create class-validator input DTOs: `PreviewSubscriptionPlanChangeDto`, `ChangeSubscriptionPlanDto`.
  - Add endpoints in `SubscriptionController`:
    - `POST /subscriptions/:id/preview-change`
    - `POST /subscriptions/:id/change-plan`
  - Decorate with Swagger documentation (`@ApiOperation`, `@ApiOkResponse`, `@ApiBearerAuth`, etc.).
  - Update controller unit tests in `subscription.controller.spec.ts`.

- [x] **Step 6: Verification & Test Suite Execution**
  - Run unit and integration tests across subscriptions module.
  - Run full test suite check (`pnpm test`).
  - Verify all acceptance criteria.

---

## Verification & Acceptance Criteria
1. **Proration Precision**:
   - Upgrading from PRO Monthly ($9.00) after 10 days of a 30-day cycle to ENTERPRISE Monthly ($29.00):
     - Unused ratio = 20 / 30 = 0.6667
     - Unused credit = $6.00 (600 cents)
     - Target cost = $29.00 (2900 cents)
     - Net amount due = $23.00 (2300 cents).
2. **Quota Gating on Downgrades**:
   - Downgrading from PRO (30 animal limit) to STARTER (5 animal limit) when farm has 10 active animals throws `QuotaExceededDomainException` with detailed breakdown.
3. **Auditability**:
   - Every plan change emits an audit log record with previous tier, new tier, and prorated financials.
