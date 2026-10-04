# SPEC-403: Regional MFS Webhook & IPN Ingestion Engine (bKash / SSLCommerz / Paymob)
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.3: Regional MFS Webhook receiver (bKash / SSLCommerz / Paymob IPN)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
In emerging agricultural markets (South Asia, Southeast Asia, East Africa), smallholder and commercial livestock farmers rarely utilize international credit cards (Stripe). The dominant financial rails are **Mobile Financial Services (MFS)** and local payment aggregators:
- **bKash / Nagad / Rocket** (Direct MFS Wallets via API/Callback)
- **SSLCommerz** (Regional aggregator supporting all Bangladeshi MFS, cards, and internet banking)
- **Paymob / Flutterwave** (Regional MENA & African payment orchestration)

These gateways do not use Stripe-style webhooks. Instead, they use **Instant Payment Notification (IPN)** HTTP POST callbacks with:
1. URL-encoded or JSON postback payloads containing transaction IDs (`tran_id` / `paymentID`), validation IDs (`val_id`), amounts, and verification hashes (`verify_sign`, `signature`).
2. Server-to-server query validation where the merchant server validates the IPN with the provider's validation API before releasing digital assets.

Without a dedicated MFS IPN receiver, regional farm orders cannot be authoritatively settled, preventing farmers from accessing purchased courses, digital tools, and eBooks.

### The Solution
Implement an enterprise-grade Regional MFS Webhook & IPN ingestion pipeline that:
1. Ingests IPN payloads via `POST /api/v1/orders/webhook/mfs`, with dedicated endpoint aliases for major regional gateways (`POST /api/v1/orders/webhook/sslcommerz`, `POST /api/v1/orders/webhook/bkash`).
2. Verifies cryptographic authenticity using HMAC-SHA256 / hash validation against configured gateway secrets (`MFS_WEBHOOK_SECRET` / `SSLCOMMERZ_STORE_PASSWD`).
3. Validates amount integrity: ensures the settled amount reported by MFS matches the database `order.totalCents` to prevent underpayment fraud.
4. Idempotently settles order statuses inside an ACID database transaction:
   - On valid payment confirmation: updates `Order` status to `COMPLETED`, saves `gatewayTxId`, and records an immutable `ORDER_COMPLETED` audit log.
   - On failed/cancelled payment: updates `Order` status to `FAILED` and records `ORDER_PAYMENT_FAILED` audit log.
5. Returns fast, compliant HTTP 200 responses to satisfy IPN gateway requirements, preventing repetitive retry storms.

---

## 2. Current State vs. Proposed State

| Capability | Current Codebase State | Proposed State (Post Task 4.3) |
| :--- | :--- | :--- |
| **MFS Gateway Ingestion** | No MFS IPN controller or service exists. | `MfsWebhookController` handling `POST /orders/webhook/mfs`, `/sslcommerz`, and `/bkash`. |
| **Regional Signatures** | Only Stripe HMAC-SHA256 signature verification exists. | Pluggable MFS hash & HMAC signature verification engine with replay protection. |
| **Amount Integrity** | Client prices verified during checkout only. | Postback amount matched against database `total_cents` before marking order `COMPLETED`. |
| **Idempotency** | Stripe webhook idempotency implemented. | MFS IPN idempotency implemented: duplicate postbacks return HTTP 200 without duplicate DB writes. |
| **Audit Trails** | Implemented for checkout and Stripe. | Atomic `ORDER_COMPLETED` / `ORDER_PAYMENT_FAILED` audit logging inside Prisma `$transaction`. |

---

## 3. Architectural & Design Trade-offs

### Trade-Off 1: Gateway Polymorphism (Unified Port vs. Isolated Controllers)
- **Option A: Separate standalone controller for each gateway.**
  - *Cons*: Duplicate boilerplate, divergent error responses, fragmented endpoint management.
- **Option B (Selected): Strategy Pattern with Polymorphic Provider Handlers.**
  - *Pros*: Unified `IMfsWebhookService` delegating to specialized provider strategies (`SslCommerzStrategy`, `BkashStrategy`, `GenericMfsStrategy`). A unified endpoint `/orders/webhook/mfs` handles auto-detected payloads, while dedicated aliases (`/sslcommerz`, `/bkash`) route directly to respective strategies.
  - *Rationale*: Clean Architecture, Open-Closed Principle (SOLID) — adding a new regional gateway (e.g. Paymob, Flutterwave) requires adding a strategy without altering core order settlement logic.

### Trade-Off 2: Direct Hash Verification vs. Back-Channel Query Confirmation
- **Option A: Query external gateway API synchronously on every IPN.**
  - *Cons*: Gateway API timeouts (frequent in rural gateways) cause IPN processing to fail or exceed HTTP timeout.
- **Option B (Selected): Cryptographic Hash Verification with Configurable Validation Adapter.**
  - *Pros*: Validates cryptographic signature/hash locally in <1ms. For environments requiring secondary validation, an injectable validation port can confirm transaction validity or run in fallback mode.
  - *Rationale*: High resilience, zero external gateway dependency in automated CI/test environments, and sub-10ms response time.

---

## 4. Data Models & Interface Contracts

### 1. Unified IPN Payload Contract
```typescript
export interface MfsIpnPayload {
  readonly provider?: string; // "sslcommerz" | "bkash" | "paymob" | "generic"
  readonly transactionId: string; // Order UUID or tran_id
  readonly gatewayTxId: string; // Gateway transaction ID / val_id / trxID
  readonly amountCents: number;
  readonly currency?: string;
  readonly status: "VALID" | "FAILED" | "CANCELLED" | "SUCCESS";
  readonly signature?: string;
  readonly rawPayload?: Record<string, unknown>;
}
```

### 2. Service Contract (`apps/api/src/modules/orders/services/mfs-webhook.service.interface.ts`)
```typescript
export interface MfsWebhookResult {
  readonly received: boolean;
  readonly provider: string;
  readonly orderId?: string;
  readonly gatewayTxId: string;
  readonly status: "processed" | "already_processed" | "ignored" | "failed";
  readonly message: string;
}

export interface IMfsWebhookService {
  processIpn(
    payload: MfsIpnPayload,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult>;

  processSslCommerz(
    payload: Record<string, unknown>,
    traceId?: string
  ): Promise<MfsWebhookResult>;

  processBkash(
    payload: Record<string, unknown>,
    traceId?: string
  ): Promise<MfsWebhookResult>;
}

export const MFS_WEBHOOK_SERVICE = "MFS_WEBHOOK_SERVICE";
```

---

## 5. Security & Edge Cases

1. **Amount Mismatch Detection (Underpayment Fraud)**:
   If an attacker submits an IPN claiming an order of $50 was paid with $1, the service compares `payload.amountCents` against `order.totalCents`. If mismatched, it rejects with 400 Bad Request and logs a security alert.
2. **Cryptographic Signature Validation**:
   IPN payloads must match HMAC-SHA256 or MD5 signature generated using `MFS_WEBHOOK_SECRET` / gateway store secret. Unsigned or invalid payloads are rejected with 400 Bad Request.
3. **Idempotency Guard**:
   If an order is already marked `COMPLETED` when a duplicate IPN arrives, it immediately returns `{ received: true, status: "already_processed" }` with HTTP 200.
4. **Order Not Found**:
   If `transactionId` does not map to any database order, the service logs a warning and returns status `"ignored"` with HTTP 200.
5. **Public Access via `@Public()`**:
   Bypasses JWT bearer guard for external server-to-server callbacks while protected by signature validation.
