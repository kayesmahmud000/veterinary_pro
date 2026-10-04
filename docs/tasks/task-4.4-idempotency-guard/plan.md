# PLAN-404: Distributed Idempotency Key Guard for Payment Events & Checkout
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.4: Idempotency key guard on payment events to prevent duplicate order fulfillment
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 4.1: ACID-compliant checkout workflow operational.
- [x] Task 4.2: Stripe webhook receiver operational.
- [x] Task 4.3: Regional MFS webhook receiver operational.
- [x] Redis connection configuration available via `EnvService`.

---

## 2. Granular Implementation Steps

### Step 1: Idempotency Engine Contracts
- [x] Create `apps/api/src/common/idempotency/idempotency.interface.ts`:
  - Define `IdempotencyStatus` (`PENDING`, `COMPLETED`).
  - Define `IdempotencyRecord<T>` interface.
  - Define `IIdempotencyStore` interface.
  - Define `IIdempotencyService` interface.
  - Define `IDEMPOTENCY_SERVICE` and `IDEMPOTENCY_STORE` tokens.

### Step 2: Storage Drivers (Redis & In-Memory Fallback)
- [x] Create `apps/api/src/common/idempotency/stores/memory-idempotency.store.ts`:
  - In-memory Map store with TTL expiry for test/offline environments.
- [x] Create `apps/api/src/common/idempotency/stores/redis-idempotency.store.ts`:
  - Redis atomic key storage using `ioredis` (`SET ... NX EX`).

### Step 3: Idempotency Service Core
- [x] Create `apps/api/src/common/idempotency/idempotency.service.ts`:
  - Computes deterministic SHA-256 payload hash.
  - Handles atomic lock acquisition (`PENDING`).
  - Detects payload mismatch on repeated keys (throws 422 Unprocessable Entity).
  - Detects concurrent in-flight requests (throws 409 Conflict).
  - Returns cached response on completed keys without executing handler.
  - Cleans up lock on errors so legitimate retries succeed.
- [x] Author unit tests in `apps/api/src/common/idempotency/idempotency.service.spec.ts`.

### Step 4: Declarative Decorator, Interceptor & Module
- [x] Create `apps/api/src/common/idempotency/decorators/idempotent.decorator.ts`.
- [x] Create `apps/api/src/common/idempotency/interceptors/idempotency.interceptor.ts`.
- [x] Create `apps/api/src/common/idempotency/idempotency.module.ts`:
  - Provides `IdempotencyService` with factory selecting Redis store when Redis is configured or Memory store in dev/test.
- [x] Author unit tests in `apps/api/src/common/idempotency/interceptors/idempotency.interceptor.spec.ts`.

### Step 5: Orders & Webhook Integration
- [x] Apply `@Idempotent()` to `POST /orders/checkout` in `apps/api/src/modules/orders/orders.controller.ts`.
- [x] Integrate `IdempotencyService` into `StripeWebhookService` for `stripe:event:<eventId>`.
- [x] Integrate `IdempotencyService` into `MfsWebhookService` for `mfs:event:<provider>:<txId>`.
- [x] Import `IdempotencyModule` in `OrdersModule`.

### Step 6: Supertest Integration Testing
- [x] Author `apps/api/src/modules/orders/orders-idempotency.int.spec.ts`:
  - Test checkout replay with `Idempotency-Key`: returns cached 201 response without creating duplicate order.
  - Test checkout replay with modified payload: returns 422 Unprocessable Entity.
  - Test concurrent webhook invocations: second concurrent event deduplicated.

### Step 7: Verification & Roadmap Update
- [x] Run test suite: `pnpm --filter @vetralink/api test src/modules/orders src/common/idempotency`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 4.4.

---

## 3. Acceptance Criteria
1. **Double-Click Defense**: Submitting the same `Idempotency-Key` on checkout returns the cached order response without duplicate records in PostgreSQL.
2. **Payload Mismatch Detection**: Reusing an idempotency key with different request parameters triggers HTTP 422 rejection.
3. **Concurrent Webhook Deduplication**: Webhooks arriving simultaneously are atomically locked; duplicate executions are prevented.
4. **Resilient Failure Recovery**: When an operation throws an error, the pending lock is freed so retries succeed.
5. **100% Test Pass Rate**: All unit and Supertest integration tests pass with zero regressions.
