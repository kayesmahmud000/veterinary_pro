# Task 10.5: Stripe Customer Portal Integration for Self-Service Billing Plan

## Prerequisites
- Monorepo packages build cleanly (`@vetralink/shared-types`, `apps/api`).
- Existing `SubscriptionsModule`, `UsersModule`, and Stripe client infrastructure functional.

---

## Implementation Steps

- [x] **Step 1: Type Contracts & DTOs (`packages/shared-types` & `apps/api`)**
  - Define `CreateCustomerPortalSessionDto` & `CustomerPortalSessionResponseDto` in `@vetralink/shared-types`.
  - Create class-validator & Swagger decorated DTOs in `apps/api/src/modules/subscriptions/dto`.
  - Export from respective module index files and build `@vetralink/shared-types`.

- [x] **Step 2: Stripe Portal Service Interface & Implementation (`apps/api/src/modules/subscriptions/services`)**
  - Create `IStripePortalService` and `StripePortalService`.
  - Implement Stripe customer resolution:
    - Inspect subscription `gatewaySubId` to retrieve customer.
    - Query Stripe customers by user email.
    - Provision new Stripe customer if none exists.
  - Implement portal session creation via `stripe.billingPortal.sessions.create(...)`.
  - Record audit log event for portal session issuance.
  - Provide test/dev mock fallback when `STRIPE_SECRET_KEY` is not present.
  - Write comprehensive unit tests in `stripe-portal.service.spec.ts`.

- [x] **Step 3: Controller Endpoints & Wiring (`apps/api/src/modules/subscriptions`)**
  - Register `StripePortalService` in `SubscriptionsModule`.
  - Import `UsersModule` into `SubscriptionsModule`.
  - Add controller endpoints to `SubscriptionController`:
    - `POST /subscriptions/customer-portal`
    - `POST /subscriptions/:id/customer-portal`
  - Decorate with Swagger documentation (`@ApiOperation`, `@ApiOkResponse`, `@ApiBearerAuth`, etc.).
  - Update controller unit tests in `subscription.controller.spec.ts`.

- [x] **Step 4: Verification & Test Suite Execution**
  - Run unit and integration tests across subscriptions module.
  - Run full test suite check (`pnpm test`).
  - Verify all acceptance criteria.

---

## Verification & Acceptance Criteria
1. **Portal Session Generation**:
   - Calling `POST /subscriptions/customer-portal` resolves or creates a Stripe customer and returns a valid session URL.
2. **Subscription Linkage**:
   - For an existing subscription with `gatewaySubId`, portal session accurately identifies the customer.
3. **Audit Trail**:
   - Emits an `AuditLog` entry capturing the portal session creation.
