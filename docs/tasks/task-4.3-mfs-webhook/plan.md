# PLAN-403: Regional MFS Webhook Receiver (bKash / SSLCommerz / Paymob IPN)
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.3: Regional MFS Webhook receiver (bKash / SSLCommerz / Paymob IPN)
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 4.1: ACID-compliant checkout workflow operational.
- [x] Task 4.2: Stripe webhook receiver and rawBody ingestion operational.
- [x] `OrderEntity`, `OrderRepository`, `ITransactionManager`, and `IAuditLogRepository` operational.

---

## 2. Granular Implementation Steps

### Step 1: Environment Configuration
- [x] Add `MFS_WEBHOOK_SECRET` in `apps/api/src/config/env.schema.ts` with development fallback.
- [x] Expose `mfsWebhookSecret` getter in `apps/api/src/config/env.service.ts`.

### Step 2: MFS Webhook Service Interface & Contracts
- [x] Create `apps/api/src/modules/orders/services/mfs-webhook.service.interface.ts`:
  - Define `MfsIpnPayload` interface.
  - Define `MfsWebhookResult` interface.
  - Define `IMfsWebhookService` contract.
  - Define `MFS_WEBHOOK_SERVICE` injection token.

### Step 3: MFS Webhook Service Implementation
- [x] Create `apps/api/src/modules/orders/services/mfs-webhook.service.ts`:
  - Cryptographic HMAC-SHA256 signature verification using `MFS_WEBHOOK_SECRET`.
  - Specialized normalization adapters for:
    - **SSLCommerz**: maps `tran_id`, `val_id`, `amount`, `status` (`VALID` / `FAILED`), `verify_sign`.
    - **bKash**: maps `paymentID`, `trxID`, `amount`, `transactionStatus` (`Completed` / `Failed`), `signature`.
    - **Generic MFS**: parses standardized `MfsIpnPayload`.
  - Amount integrity check: validates `payload.amountCents === order.totalCents` to prevent underpayment exploits.
  - Idempotency guard: returns `"already_processed"` on duplicate postbacks without re-running mutations.
  - Transactional settlement: updates order status and writes audit log inside Prisma `$transaction`.
- [x] Author unit tests in `apps/api/src/modules/orders/services/mfs-webhook.service.spec.ts`.

### Step 4: MFS Webhook HTTP Controller
- [x] Create `apps/api/src/modules/orders/controllers/mfs-webhook.controller.ts`:
  - `POST /orders/webhook/mfs`: Generic MFS IPN receiver.
  - `POST /orders/webhook/sslcommerz`: Dedicated SSLCommerz postback receiver.
  - `POST /orders/webhook/bkash`: Dedicated bKash callback receiver.
  - Decorate all endpoints with `@Public()` to bypass JWT authentication.
- [x] Author unit tests in `apps/api/src/modules/orders/controllers/mfs-webhook.controller.spec.ts`.

### Step 5: Module Wiring & Exports
- [x] Register `MfsWebhookController` and `MfsWebhookService` in `apps/api/src/modules/orders/orders.module.ts`.
- [x] Re-export MFS webhook types and services in `apps/api/src/modules/orders/index.ts`.

### Step 6: Supertest Integration Testing
- [x] Author `apps/api/src/modules/orders/controllers/mfs-webhook.controller.int.spec.ts`:
  - Test missing / invalid signature header -> 400 Bad Request.
  - Test amount tampering (mismatch against order) -> 400 Bad Request.
  - Test valid SSLCommerz IPN -> 200 OK, order settled to `COMPLETED`.
  - Test valid bKash callback -> 200 OK, order settled to `COMPLETED`.
  - Test duplicate IPN delivery -> 200 OK, status `already_processed`.
  - Test failed transaction status -> 200 OK, order settled to `FAILED`.

### Step 7: Verification & Roadmap Update
- [x] Run test suite: `pnpm --filter @vetralink/api test src/modules/orders`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 4.3.

---

## 3. Acceptance Criteria
1. **Multi-Gateway Support**: Handles SSLCommerz, bKash, and generic MFS IPN payloads with specialized parsers.
2. **Amount Integrity Defense**: Postback amounts are strictly validated against database order totals before order fulfillment.
3. **Cryptographic Validation**: Signatures are checked against merchant secrets; forged or missing signatures return HTTP 400.
4. **ACID Transaction Settlement**: Order status update and audit log recording execute in the same database transaction.
5. **Strict Idempotency**: Duplicate IPN deliveries return HTTP 200 without duplicate database writes.
6. **100% Test Pass Rate**: All unit and Supertest integration tests pass with zero regressions.
