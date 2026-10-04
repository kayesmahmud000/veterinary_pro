# SPEC-402: Stripe Webhook Receiver with Raw Payload Signature Validation & Idempotent Order Fulfillment
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.2: Stripe Webhook receiver with raw payload signature validation (`stripe-signature`)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
During checkout (Task 4.1), orders are created in `PENDING` status with an associated Stripe `PaymentIntent` identifier (`gateway_tx_id`). The client completes payment asynchronously via Stripe Elements, mobile SDKs, or hosted checkout. Because client-side callbacks can be intercepted, forged, or aborted (e.g., user closes the browser before redirection), the server **must never trust the client** to confirm payment completion.

Authoritative order settlement must occur via secure, asynchronous server-to-server **Stripe Webhooks**.

### The Solution
Implement a production-grade webhook ingestion pipeline that:
1. Preserves the exact, unparsed raw HTTP request buffer (`req.rawBody`) before standard JSON parsing.
2. Validates the cryptographic HMAC-SHA256 signature in the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` with timestamp replay protection.
3. Idempotently processes lifecycle events (`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`):
   - Transitions `Order` state from `PENDING` to `COMPLETED` (or `FAILED` / `REFUNDED`).
   - Activates order items and unique `downloadToken`s for buyer fulfillment.
   - Emits an immutable `AuditLog` entry in the **same database transaction** (`GUARDRAIL-07`).
4. Ensures idempotency: duplicate or re-delivered webhook events produce zero duplicate mutations and return immediate HTTP 200 acknowledgment.
5. Returns fast HTTP 200 responses to avoid Stripe retry backoff storms, while rejecting invalid signatures with HTTP 400 Bad Request.

---

## 2. Current State vs. Proposed State

| Component | Current Codebase State | Proposed State (Post Task 4.2) |
| :--- | :--- | :--- |
| **HTTP Raw Body** | Standard JSON body parser only; raw buffer discarded. | NestJS `rawBody: true` enabled in `main.ts`, preserving raw `Buffer` on incoming webhook requests. |
| **Stripe Webhook Route** | No webhook controller exists. | `@Public()` `StripeWebhookController` at `POST /api/v1/orders/webhook/stripe` accepting raw bytes and `stripe-signature`. |
| **Signature Verification** | None. | Validated via `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`. |
| **Order Status Settlement** | Orders remain in `PENDING` indefinitely after checkout. | Atomic transition to `COMPLETED` on `payment_intent.succeeded` or `FAILED` on `payment_intent.payment_failed`. |
| **Idempotency** | None. | State check guard prevents double fulfillment if Stripe re-delivers duplicate events. |
| **Audit Compliance** | Task 4.1 checkout logs `ORDER_CREATED`. | Webhook logs `ORDER_COMPLETED`, `ORDER_PAYMENT_FAILED`, or `ORDER_REFUNDED` inside Prisma `$transaction`. |

---

## 3. Architectural & Design Trade-offs

### Trade-Off 1: Raw Body Preservation (NestJS Built-in vs. Custom Middleware)
- **Option A: Custom Express `body-parser` middleware with `verify` hook.**
  - *Cons*: Bypasses NestJS framework idioms, can cause race conditions with global pipes.
- **Option B (Selected): NestJS native `rawBody: true` in `NestFactory.create` + `@RawBody()`.**
  - *Pros*: First-class NestJS support (v9+), zero external middleware dependencies, preserves typed raw `Buffer` on `req.rawBody`.
  - *Rationale*: Cleanest architecture adhering to `.antigravityrules` Section 2.

### Trade-Off 2: Synchronous DB Mutation vs. Enqueued Background Worker
- **Option A: Enqueue all webhook events to BullMQ worker, immediately return 200.**
  - *Cons*: Introduces asynchronous latency for immediate UI polling; adds queue failure modes for basic status flips.
- **Option B (Selected): Synchronous Order Status Transition in Transaction + Enqueue Fulfillment Actions.**
  - *Pros*: Fast relational database transaction updates order status and logs audit entry within ~15ms, satisfying Stripe's 20-second timeout. Subsequent heavy tasks (e.g. BullMQ PDF watermarking in Sprint 5) are triggered downstream.
  - *Rationale*: Guarantees immediate ACID consistency for customer entitlement queries while keeping webhook responses lightning-fast.

### Trade-Off 3: Mock vs. Live Verification in Testing & Development
- In local development and automated CI runs, live Stripe secrets may not be present.
- `StripeWebhookService` supports signature verification via Stripe SDK when `STRIPE_WEBHOOK_SECRET` is configured.
- For test environments, a mock verification strategy allows testing valid payloads, signature failures, and unknown events deterministically without making outbound network calls.

---

## 4. Data Models & Interface Contracts

### 1. Webhook Result Contract (`apps/api/src/modules/orders/services/stripe-webhook.service.interface.ts`)
```typescript
export interface WebhookProcessingResult {
  readonly received: boolean;
  readonly eventId: string;
  readonly eventType: string;
  readonly orderId?: string;
  readonly status: "processed" | "already_processed" | "ignored" | "failed";
  readonly message: string;
}

export interface IStripeWebhookService {
  processWebhook(
    rawBody: Buffer,
    signature: string,
    traceId?: string
  ): Promise<WebhookProcessingResult>;
}

export const STRIPE_WEBHOOK_SERVICE = "STRIPE_WEBHOOK_SERVICE";
```

### 2. Supported Stripe Lifecycle Events
| Event Name | Source | Handler Action |
| :--- | :--- | :--- |
| `payment_intent.succeeded` | Stripe Payment Engine | Transition Order to `COMPLETED`, record `ORDER_COMPLETED` audit log. |
| `payment_intent.payment_failed` | Stripe Payment Engine | Transition Order to `FAILED`, record `ORDER_PAYMENT_FAILED` audit log. |
| `charge.refunded` | Stripe Dashboard / API | Transition Order to `REFUNDED`, record `ORDER_REFUNDED` audit log. |
| Other Events (e.g., `payment_intent.created`) | Stripe System | Safely acknowledge with status `"ignored"` (HTTP 200). |

---

## 5. Security & Edge Cases

1. **Tamper-Resistance via HMAC-SHA256**:
   Any modification of the raw request payload invalidates the signature, triggering an immediate HTTP 400 rejection.
2. **Replay Attack Defense**:
   Stripe timestamps embedded in the signature header are validated against system clock with a default tolerance of 300 seconds.
3. **Idempotency Guard**:
   If an order is already marked `COMPLETED` when a duplicate `payment_intent.succeeded` arrives:
   - The transaction aborts mutation.
   - The service returns `{ received: true, status: "already_processed" }`.
   - Returns HTTP 200 to acknowledge Stripe and suppress further retries.
4. **Order Not Found**:
   If a webhook references an unknown `orderId` or unknown `gatewayTxId`, the service logs a warning and returns status `"ignored"` with HTTP 200 so that Stripe does not retry dead events indefinitely.
5. **Public Endpoint Protection**:
   Decorated with `@Public()` to bypass `JwtAuthGuard`, but strictly protected by the cryptographic `stripe-signature` verification barrier.
