# SPEC-404: Distributed Idempotency Key Guard for Payment Events & Checkout
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.4: Idempotency key guard on payment events to prevent duplicate order fulfillment
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
In distributed high-concurrency payment systems, duplicate requests are inevitable due to:
1. **Network Retries & Jitter**: Webhook providers (Stripe, SSLCommerz, bKash) automatically retry unacknowledged requests. When network latency spikes, multiple webhook deliveries for the same event arrive concurrently across multiple API cluster replicas.
2. **Client Double-Clicks & Rapid Submissions**: A buyer clicking "Complete Purchase" repeatedly, or mobile network dropouts resending checkout requests, can produce duplicate `Order` records and multiple Stripe payment charges.
3. **Database Race Conditions**: In-memory status checks (`if (order.status === COMPLETED)`) are prone to race conditions if two worker threads read `PENDING` before either commits their Prisma transaction, resulting in duplicate fulfillment, multiple email dispatches, and corrupted audit histories.

### The Solution
Implement an enterprise-grade **Distributed Idempotency Engine** powered by Redis (`ARCHITECTURE.md` Section 2):
1. **Atomic In-Flight Lock (`NX EX`)**: Uses Redis `SET idempotency:<key> PENDING NX EX <ttl>` to acquire an atomic distributed lock. Rejects concurrent requests for the same key with HTTP 409 Conflict.
2. **Response Caching**: Upon successful processing, caches the execution response in Redis (`COMPLETED`) for 24 hours. Subsequent duplicate calls receive the exact cached response with zero database or gateway overhead.
3. **Automatic Lock Release on Failure**: If processing fails with an exception, the pending lock is automatically removed, allowing subsequent legitimate retries.
4. **Declarative Decorator & Interceptor**: `@Idempotent()` decorator and `IdempotencyInterceptor` for HTTP controllers (e.g. `POST /orders/checkout` with `Idempotency-Key` header).
5. **Programmatic Wrapper for Webhooks**: Integrated directly into `StripeWebhookService` and `MfsWebhookService` to wrap payment event processing (`stripe:event:<id>`, `mfs:event:<provider>:<txId>`).

---

## 2. Current State vs. Proposed State

| Component | Current Codebase State | Proposed State (Post Task 4.4) |
| :--- | :--- | :--- |
| **Checkout Deduplication** | None. Double-submitting `POST /orders/checkout` creates duplicate pending orders and duplicate payment intents. | Decorated with `@Idempotent()`. Replays with same `Idempotency-Key` return cached `CheckoutResponseDto`. |
| **Concurrent Webhook Defense** | In-transaction database status check only (vulnerable to sub-millisecond race conditions). | Atomic Redis lock acquired before transaction execution; concurrent events blocked. |
| **Idempotency Storage** | Ad-hoc database queries. | Centralized Redis store with atomic state transitions (`PENDING` -> `COMPLETED` / `FAILED`). |
| **Test & Dev Portability** | Requires external Redis connection. | Pluggable driver architecture: Redis in production, seamless in-memory fallback for test suites. |

---

## 3. Architectural & Design Trade-offs

### Trade-Off 1: Redis Atomic Lock vs. Database Row Lock (`SELECT ... FOR UPDATE`)
- **Option A: Database Row-Level Locking (`FOR UPDATE`).**
  - *Cons*: Holds expensive database connections, creates lock contention on the `orders` table, and cannot protect against duplicate checkout creation (since the order does not exist yet).
- **Option B (Selected): Redis Atomic Key Lock with Payload Caching.**
  - *Pros*: Sub-millisecond execution, zero PostgreSQL connection pool exhaustion, protects both existing entities (webhooks) and non-existent entities (checkouts).
  - *Rationale*: Aligns with `ARCHITECTURE.md` Section 2 designating Redis 7 for cache and idempotency.

### Trade-Off 2: Payload Hash Verification (Mismatch Defense)
- When a client sends a request with an existing idempotency key, the engine compares the SHA-256 hash of the incoming request body against the cached payload hash.
- If the key matches but the body differs, the server returns HTTP 422 Unprocessable Entity (`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`), preventing malicious key reuse across different orders.

---

## 4. Data Models & Interface Contracts

### 1. Idempotency State & Record
```typescript
export enum IdempotencyStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export interface IdempotencyRecord<T = unknown> {
  readonly key: string;
  readonly status: IdempotencyStatus;
  readonly payloadHash: string;
  readonly response?: T;
  readonly createdAt: string;
}
```

### 2. Service Interface (`apps/api/src/common/idempotency/idempotency.service.interface.ts`)
```typescript
export interface IIdempotencyService {
  execute<T>(
    key: string,
    payload: unknown,
    ttlSeconds: number,
    operation: () => Promise<T>
  ): Promise<T>;

  acquireLock(key: string, payloadHash: string, lockTtlSeconds: number): Promise<boolean>;

  completeLock<T>(key: string, payloadHash: string, response: T, retentionTtlSeconds: number): Promise<void>;

  releaseLock(key: string): Promise<void>;
}

export const IDEMPOTENCY_SERVICE = "IDEMPOTENCY_SERVICE";
```

### 3. Declarative Decorator
```typescript
@Post("checkout")
@Idempotent({
  header: "idempotency-key",
  ttlSeconds: 86400, // 24 hours
  lockTtlSeconds: 60, // 60 seconds lock
})
public async checkout(...)
```

---

## 5. Security & Edge Cases

1. **Deadlock Prevention (Lock Timeout)**:
   In-flight locks (`PENDING`) are set with a strict `lockTtlSeconds` (e.g. 60s). If an application node crashes unexpectedly during checkout, the lock automatically expires.
2. **Payload Hash Mismatch**:
   Reusing an `Idempotency-Key` with a different payload throws a validation exception to stop replay manipulation.
3. **Concurrent Collisions**:
   If an incoming webhook or checkout arrives while an identical key is in `PENDING` state, the engine rejects with HTTP 409 Conflict.
4. **Graceful Fallback**:
   In automated testing and CI environments, an in-memory storage adapter ensures 100% test isolation with zero latency.
