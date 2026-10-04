# PLAN-402: Stripe Webhook Receiver & Idempotent Order Settlement
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.2: Stripe Webhook receiver with raw payload signature validation (`stripe-signature`)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 4.1: ACID-compliant checkout workflow operational (`OrderEntity`, `OrderRepository`, `CheckoutService`).
- [x] `stripe` SDK installed in `@vetralink/api`.
- [x] `STRIPE_WEBHOOK_SECRET` defined in `EnvSchema` and `EnvService`.
- [x] `ITransactionManager` and `IAuditLogRepository` operational.

---

## 2. Granular Implementation Steps

### Step 1: Raw Body Preservation in Main Application
- [x] Update `apps/api/src/main.ts`:
  - Set `rawBody: true` in `NestFactory.create(AppModule, { bufferLogs: true, rawBody: true })`.

### Step 2: Webhook Service Interface & Contracts
- [x] Create `apps/api/src/modules/orders/services/stripe-webhook.service.interface.ts`:
  - Define `WebhookProcessingResult` contract.
  - Define `IStripeWebhookService` interface.
  - Define `STRIPE_WEBHOOK_SERVICE` injection token.

### Step 3: Stripe Webhook Service Implementation
- [x] Create `apps/api/src/modules/orders/services/stripe-webhook.service.ts`:
  - Validates `stripe-signature` via `stripe.webhooks.constructEvent(rawBody, signature, secret)`.
  - Routes events:
    - `payment_intent.succeeded`: Resolves order via `orderId` metadata or `gatewayTxId`. Idempotently updates status to `COMPLETED` and emits `ORDER_COMPLETED` audit log inside Prisma `$transaction`.
    - `payment_intent.payment_failed`: Updates status to `FAILED` and emits `ORDER_PAYMENT_FAILED` audit log inside Prisma `$transaction`.
    - `charge.refunded`: Updates status to `REFUNDED` and emits `ORDER_REFUNDED` audit log inside Prisma `$transaction`.
    - Other events: Acknowledges safely with status `"ignored"`.
  - Idempotency guard: If order is already in the target state, avoids duplicate writes and returns `"already_processed"`.
- [x] Author unit tests in `stripe-webhook.service.spec.ts`.

### Step 4: Stripe Webhook HTTP Controller
- [x] Create `apps/api/src/modules/orders/controllers/stripe-webhook.controller.ts`:
  - Endpoint: `POST /orders/webhook/stripe`.
  - Decorate with `@Public()` to bypass JWT authentication.
  - Extract `@Headers("stripe-signature")` and raw body buffer from `req.rawBody`.
  - Reject missing signature or missing raw body with HTTP 400 Bad Request.
  - Call `stripeWebhookService.processWebhook(rawBody, signature, traceId)`.
- [x] Author unit tests in `stripe-webhook.controller.spec.ts`.

### Step 5: Module Wiring & Exports
- [x] Register `StripeWebhookController` and `StripeWebhookService` in `apps/api/src/modules/orders/orders.module.ts`.
- [x] Re-export webhook service and controller in `apps/api/src/modules/orders/index.ts`.

### Step 6: Supertest Integration Testing
- [x] Author `apps/api/src/modules/orders/controllers/stripe-webhook.controller.int.spec.ts`:
  - Test missing `stripe-signature` header -> 400 Bad Request.
  - Test invalid/tampered signature -> 400 Bad Request.
  - Test `payment_intent.succeeded` -> 200 OK, order updated to `COMPLETED`.
  - Test duplicate `payment_intent.succeeded` -> 200 OK, status `already_processed`.
  - Test `payment_intent.payment_failed` -> 200 OK, order updated to `FAILED`.
  - Test unhandled event -> 200 OK, status `ignored`.

### Step 7: Verification & Roadmap Update
- [x] Run test suite: `pnpm --filter @vetralink/api test src/modules/orders`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 4.2.

---

## 3. Acceptance Criteria
1. **Cryptographic Validation**: Any request with an altered body or forged signature header is immediately rejected with HTTP 400 Bad Request.
2. **ACID Settlement**: Order status update and audit log recording occur in the same database transaction.
3. **Strict Idempotency**: Duplicate webhook deliveries for the same event/order return HTTP 200 without duplicate mutations.
4. **Resilient Event Routing**: Unhandled event types are safely ignored with HTTP 200 acknowledgment.
5. **100% Test Pass Rate**: All unit and Supertest integration tests pass with zero regressions.
