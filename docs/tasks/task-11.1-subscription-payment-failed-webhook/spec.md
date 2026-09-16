# Task 11.1: Webhook Handling for Failed Recurring Subscription Renewals Specification

## 1. Feature Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech platform combining Livestock ERP, LMS/Digital Assets Store, and Tele-Veterinary Telehealth. Subscriptions renew automatically on a recurring basis (`MONTHLY` or `ANNUAL`) via Stripe Billing. When a recurring renewal payment fails (e.g. card expired, insufficient balance, card declined by issuing bank), Stripe emits an asynchronous `invoice.payment_failed` webhook event.

Task 11.1 implements:
1. **Asynchronous Stripe Webhook Ingestion**:
   - Cryptographic signature validation of `stripe-signature` header via HMAC-SHA256.
   - Idempotent processing with Redis/Memory deduplication to prevent duplicate state mutations from webhook retries.
2. **Subscription State Lifecycle Transition**:
   - Parsing `invoice.payment_failed` and resolving the corresponding tenant `Subscription` via `gatewaySubId`.
   - Transitioning the subscription from `ACTIVE` or `TRIALING` to `PAST_DUE`.
   - Activating the 3-day grace period where farm services remain accessible before hard cutoff.
3. **Auditability & Financial Ledger**:
   - Recording structured, immutable `AuditLog` events inside an atomic Prisma transaction (`SUBSCRIPTION_PAYMENT_FAILED`).
   - Storing failed invoice metadata (`invoiceId`, `attemptCount`, `nextPaymentAttempt`, `amountDue`, `currency`, `hostedInvoiceUrl`).
4. **Resilience & Recovery**:
   - Handling `invoice.payment_succeeded` for automatic recovery when a customer pays an outstanding invoice or updates their card.
   - Dedicated webhook route (`POST /api/v1/subscriptions/webhook/stripe`) as well as cross-support in general webhook endpoints.

---

## 2. Current State vs. Proposed State

### Current State
- `StripeWebhookService` in `OrdersModule` processes one-off order payments (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`).
- `SubscriptionEntity` has `markPastDue()` and `isPastGracePeriod()` domain methods, but there is no webhook listener to invoke it when Stripe recurring renewals fail.
- Subscriptions whose payment fails remain in `ACTIVE` state indefinitely in the database unless an administrator manually calls `PATCH /subscriptions/:id/status`.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `SubscriptionWebhookResultDto`: Structured result returned to callers with event type, subscription ID, status, and message.
- **Service Layer (`apps/api/src/modules/subscriptions/services`)**:
  - `ISubscriptionWebhookService` and `SubscriptionWebhookService`:
    - Validates Stripe webhook cryptographic signatures using `EnvService.stripeWebhookSecret`.
    - Enforces idempotency via `IDEMPOTENCY_SERVICE`.
    - Handles `invoice.payment_failed`, transitioning `Subscription` to `PAST_DUE` in a database transaction with audit logging.
    - Handles `invoice.payment_succeeded`, transitioning recovered subscriptions back to `ACTIVE` with updated period boundaries.
    - Handles `customer.subscription.deleted`, marking subscriptions canceled/expired.
- **Controller Layer (`apps/api/src/modules/subscriptions/controllers`)**:
  - `SubscriptionWebhookController` exposing public endpoint `POST /api/v1/subscriptions/webhook/stripe`.
- **Unit & Integration Test Suites**:
  - Comprehensive Jest tests verifying HMAC signature verification, idempotency deduplication, state transitions, audit logging, and error handling.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Dedicated Subscriptions Webhook Controller vs Shared Order Webhook
- **Option A: Route all events through OrdersModule StripeWebhookController**:
  - *Cons*: Tightly couples `OrdersModule` to `SubscriptionsModule`, muddying domain boundaries.
- **Option B (Selected): Dedicated Subscriptions Webhook Controller with Domain Separation**:
  - `SubscriptionsModule` encapsulates its own `SubscriptionWebhookController` (`/subscriptions/webhook/stripe`) and `SubscriptionWebhookService`.
  - Maintains strict domain separation per Clean Architecture guidelines while allowing developers to point Stripe subscription webhook events directly to the subscription endpoint.

### Trade-off 2: Immediate Hard Cutoff vs Grace Period Status (`PAST_DUE`)
- **Option A: Immediately cancel subscription (`CANCELED`)**:
  - *Cons*: Immediately cuts off dairy farmers and livestock managers due to transient card declines (e.g. daily limit hit), causing operational disruption and churn.
- **Option B (Selected): Transition to `PAST_DUE` with 3-Day Grace Period**:
  - `SubscriptionEntity.canAccessService()` grants access during the grace period while alerting the farmer that billing retry is pending.
  - Aligns with Sprint 11 dunning workflows.

---

## 4. Data Models & Contracts

### 4.1 Shared Types (`packages/shared-types`)

```typescript
export interface SubscriptionWebhookResultDto {
  received: boolean;
  eventId: string;
  eventType: string;
  subscriptionId?: string;
  status: "settled" | "already_processed" | "ignored" | "failed";
  message: string;
}
```

### 4.2 Audit Log Payload (`SUBSCRIPTION_PAYMENT_FAILED`)

```typescript
{
  userId: subscription.userId,
  action: "SUBSCRIPTION_PAYMENT_FAILED",
  entityType: "Subscription",
  entityId: subscription.id,
  newValues: {
    status: SubscriptionStatus.PAST_DUE,
    gatewaySubId: invoice.subscription,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
    nextPaymentAttempt: invoice.next_payment_attempt,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    eventId: event.id,
  },
  traceId: string
}
```

---

## 5. Security & Edge Cases

1. **HMAC-SHA256 Signature Verification**: Rejects any request with invalid or missing `stripe-signature` header (HTTP 400 Bad Request).
2. **Idempotency Deduplication**: Stripe frequently retries webhooks on network timeouts. The idempotency guard ensures duplicate `invoice.payment_failed` events do not trigger redundant audit logs or corrupt state.
3. **Unknown Subscriptions**: If an invoice arrives for a subscription not present in our database, acknowledge the event safely (`status: "ignored"`) and log a warning without crashing.
4. **Reactivation / Recovery**: If a subscriber settles an outstanding invoice, `invoice.payment_succeeded` safely reactivates the subscription to `ACTIVE`.
