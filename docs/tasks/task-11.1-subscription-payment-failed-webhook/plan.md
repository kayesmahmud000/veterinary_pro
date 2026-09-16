# Task 11.1: Webhook Handling for Failed Recurring Subscription Renewals Plan

## Prerequisites
- Monorepo packages build cleanly (`@vetralink/shared-types`, `apps/api`).
- Existing `SubscriptionsModule`, `IdempotencyModule`, and Stripe client infrastructure functional.

---

## Implementation Steps

- [x] **Step 1: Type Contracts & DTOs (`packages/shared-types`)**
  - Define `SubscriptionWebhookResultDto` in `@vetralink/shared-types`.
  - Export from `packages/shared-types/src/dto/subscription/` and build package.

- [x] **Step 2: Subscription Webhook Service Interface & Implementation (`apps/api/src/modules/subscriptions/services`)**
  - Create `ISubscriptionWebhookService` and `SubscriptionWebhookService`.
  - Implement HMAC-SHA256 signature verification via `stripe.webhooks.constructEvent`.
  - Enforce idempotency via `IDEMPOTENCY_SERVICE`.
  - Handle `invoice.payment_failed`:
    - Resolve subscription via `findByGatewaySubId`.
    - Mutate status to `PAST_DUE`.
    - Persist change and emit audit log in Prisma transaction.
  - Handle `invoice.payment_succeeded`:
    - Renew or reactivate subscription to `ACTIVE`.
    - Persist change and emit audit log in Prisma transaction.
  - Handle `customer.subscription.deleted`:
    - Cancel subscription immediately.
  - Write comprehensive unit tests in `subscription-webhook.service.spec.ts`.

- [x] **Step 3: Webhook Controller & Module Wiring (`apps/api/src/modules/subscriptions`)**
  - Create `SubscriptionWebhookController` with endpoint `POST /subscriptions/webhook/stripe`.
  - Decorate with `@Public()`, Swagger OpenAPI annotations, and raw body buffer handling.
  - Register controller and service in `SubscriptionsModule`.
  - Write controller unit tests in `subscription-webhook.controller.spec.ts`.

- [x] **Step 4: Verification & Test Suite Execution**
  - Run unit and integration tests across subscriptions module.
  - Run full test suite check (`pnpm test`).
  - Verify all acceptance criteria.

---

## Verification & Acceptance Criteria
1. **Signature Security**:
   - Requests without valid `stripe-signature` header are rejected with HTTP 400 Bad Request.
2. **State Transition**:
   - Webhook `invoice.payment_failed` transitions subscription from `ACTIVE` to `PAST_DUE`.
3. **Idempotency**:
   - Duplicate delivery of the same event ID returns `already_processed` without duplicate database writes.
4. **Audit Trail**:
   - `AuditLog` record is generated with `SUBSCRIPTION_PAYMENT_FAILED` containing invoice metadata.
