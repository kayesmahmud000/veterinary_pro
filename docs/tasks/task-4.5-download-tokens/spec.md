# SPEC-405: Automated Download Token Generation & Order Fulfillment Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.5: Automated download token generation upon payment completion
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
In modern AgTech digital marketplaces and veterinary knowledge stores:
1. **Unpaid Token Leakage**: When orders are initially placed (`status = PENDING`), assigning active download tokens introduces severe piracy risks. If tokens are exposed prior to payment confirmation, buyers can bypass payment gateways or intercept download links without settling charges.
2. **Post-Payment Desynchronization**: Digital assets (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`) require individual, tamper-proof download tokens generated immediately when payment succeeds. Without an automated, transactional token generation pipeline, webhooks from Stripe and regional MFS (bKash, SSLCommerz) mark orders as completed without provisioning the cryptographic tokens required for digital fulfillment.
3. **Lack of Token Governance**: In subsequent phases (Sprint 5: Anti-Piracy Watermarking & Fulfillment), secure download endpoints must enforce quota counters (`downloadCount`), last download timestamps (`lastDownloadedAt`), and order completion status. Without authoritative token validation and lifecycle management, access control cannot be strictly maintained.

### The Objective
Implement an automated **Order Fulfillment & Download Token Generation Engine**:
1. **Zero Unpaid Access**: In `PENDING` checkout responses, download tokens are masked / omitted (`null`), guaranteeing zero unpaid asset access.
2. **Atomic Token Generation on Payment Completion**: When `StripeWebhookService` or `MfsWebhookService` settles an order to `OrderStatus.COMPLETED`, the fulfillment engine automatically generates fresh cryptographically secure UUIDv4 tokens for every digital line item inside the database transaction (`$transaction`).
3. **Download Token Repository & Verification Port**: Extend `IOrderRepository` with atomic methods to update tokens, find items by token, and increment download counters.
4. **Fulfillment Domain Service (`OrderFulfillmentService`)**: A dedicated domain service responsible for token issuance, token verification, and emitting audit logs (`ORDER_FULFILLED`).
5. **Customer Download Token Access**: Expose an authenticated endpoint `GET /orders/:id/download-tokens` enabling buyers to retrieve valid download tokens only when their order is settled.

---

## 2. Current State vs. Proposed State

| Capability | Current Codebase State | Proposed State (Post Task 4.5) |
| :--- | :--- | :--- |
| **Download Token Issuance** | Generated prematurely at checkout creation (`OrderItemEntity.create`) before payment is completed. | Masked during checkout `PENDING` state; cryptographically generated & persisted upon payment completion (`COMPLETED`). |
| **Webhook Fulfillment Integration** | Webhook services simply execute `orderRepository.updateStatus(order.id, COMPLETED)`. | Webhook services execute `orderFulfillmentService.fulfillOrder(order.id, gatewayTxId, tx)` which updates order status and issues fresh tokens atomically. |
| **Token Lookup & Validation** | None. No repository method exists to query an order item by its `download_token`. | `orderRepository.findByDownloadToken(token)` and `orderFulfillmentService.validateDownloadToken(token)` with quota & status verification. |
| **Download Counter Tracking** | Model fields exist (`download_count`, `last_downloaded_at`) but no repository method increments them. | Atomic `orderRepository.incrementDownloadCount(itemId)` method for usage tracking. |
| **Customer Token Endpoint** | Orders controller exposes `GET /orders/:id`, but does not guard token visibility by order payment status. | `GET /orders/:id/download-tokens` endpoint returning active tokens strictly for completed orders owned by the caller. |

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Synchronous In-Transaction Fulfillment vs. Asynchronous BullMQ Queue
- **Option A: Queue-based token generation via BullMQ worker.**
  - *Cons*: Introduces latency between payment webhook confirmation and token availability. If a customer is redirected to the order success page immediately after Stripe checkout, tokens might not be ready yet, causing poor UX.
- **Option B (Selected): Synchronous atomic token generation within the webhook `$transaction`, followed by async watermarking (Sprint 5).**
  - *Pros*: Sub-millisecond token issuance directly inside PostgreSQL transaction ensures that by the time the webhook returns HTTP 200, download tokens are 100% committed to the database. Heavy PDF watermarking (Sprint 5) will be offloaded to BullMQ, triggered using these pre-generated tokens.
  - *Rationale*: Guarantees immediate fulfillment consistency with zero distributed lag.

### Trade-off 2: Cryptographic Token Format (UUIDv4 vs. Signed JWT)
- **Option A: Signed JWT containing user, order, and product claims.**
  - *Cons*: Large token string (200+ characters), cannot be easily revoked if leaked, and violates the existing 3NF database schema (`download_token UUID`).
- **Option B (Selected): High-Entropy UUIDv4 stored in indexed PostgreSQL column (`download_token`).**
  - *Pros*: O(1) indexed lookup via `@@index([downloadToken])`, 128-bit entropy guarantees unguessability, and aligns cleanly with the Prisma schema.
  - *Rationale*: Keeps database queries fast and allows instant token revocation or expiration via database updates.

### Trade-off 3: Token Exposure Boundary (Masked on Checkout vs. Revealed on Completion)
- When `POST /orders/checkout` returns `201 Created` with `status: PENDING`, `items[].downloadToken` must be empty/null to prevent unauthorized access.
- Only when `status === OrderStatus.COMPLETED` do `GET /orders/:id` and `GET /orders/:id/download-tokens` expose the authoritative tokens.
- *Rationale*: Defense-in-depth against client-side exploitation.

---

## 4. Data Models, Contracts & DTOs

### 1. Download Token Response DTO (`packages/shared-types/src/dto/orders/download-token.dto.ts`)
```typescript
export interface DownloadTokenItemDto {
  readonly itemId: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly productType: string;
  readonly downloadToken: string;
  readonly downloadCount: number;
  readonly maxDownloads: number;
  readonly lastDownloadedAt: string | null;
  readonly isDownloadable: boolean;
}

export interface OrderDownloadTokensResponseDto {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly items: DownloadTokenItemDto[];
  readonly generatedAt: string;
}
```

### 2. Token Validation Result (`order-fulfillment.service.interface.ts`)
```typescript
export interface DownloadTokenValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
  readonly orderId?: string;
  readonly itemId?: string;
  readonly productId?: string;
  readonly productTitle?: string;
  readonly contentS3Key?: string;
  readonly downloadCount?: number;
  readonly maxDownloads?: number;
}
```

### 3. Service Interface (`order-fulfillment.service.interface.ts`)
```typescript
export interface IOrderFulfillmentService {
  /**
   * Fulfills a paid order by transitioning status to COMPLETED,
   * generating fresh download tokens for all digital line items,
   * and recording an audit log entry.
   */
  fulfillOrder(
    orderId: string,
    gatewayTxId?: string,
    tx?: Prisma.TransactionClient,
    traceId?: string
  ): Promise<OrderEntity>;

  /**
   * Retrieves active download tokens for an order.
   * Throws ForbiddenOperationException if order is not COMPLETED or not owned by user.
   */
  getOrderDownloadTokens(
    orderId: string,
    userId: string,
    userRole: string
  ): Promise<OrderDownloadTokensResponseDto>;

  /**
   * Validates a download token for consumption by download endpoints.
   */
  validateDownloadToken(
    downloadToken: string
  ): Promise<DownloadTokenValidationResult>;

  /**
   * Records a download event, incrementing the counter and updating lastDownloadedAt.
   */
  recordDownload(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}

export const ORDER_FULFILLMENT_SERVICE = "ORDER_FULFILLMENT_SERVICE";
```

### 4. Repository Extension (`order.repository.interface.ts`)
```typescript
export interface IOrderRepository {
  // Existing methods...
  create(order: OrderEntity, items?: OrderItemEntity[], tx?: Prisma.TransactionClient): Promise<OrderEntity>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<OrderEntity | null>;
  findByGatewayTxId(gatewayTxId: string, tx?: Prisma.TransactionClient): Promise<OrderEntity | null>;
  findUserOrders(userId: string, skip?: number, take?: number, tx?: Prisma.TransactionClient): Promise<{ orders: OrderEntity[]; total: number }>;
  updateStatus(id: string, status: OrderStatus, gatewayTxId?: string, tx?: Prisma.TransactionClient): Promise<OrderEntity>;

  // New Methods for Task 4.5:
  updateItemDownloadTokens(
    orderId: string,
    tokens: { itemId: string; downloadToken: string }[],
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  findByDownloadToken(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ order: OrderEntity; item: OrderItemEntity; contentS3Key: string } | null>;

  incrementDownloadCount(
    itemId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderItemEntity>;
}
```

---

## 5. Security & Edge Cases

1. **Unpaid Order Protection**:
   Attempting to fetch download tokens for an order in `PENDING`, `FAILED`, or `CANCELLED` status triggers HTTP 400 (`ValidationDomainException: Order has not been settled`).
2. **Multi-Tenant / User Authorization**:
   A buyer can only access download tokens for orders they own (`userId === token.userId`), unless the caller possesses `ADMIN` privileges. Non-owners receive HTTP 403 (`ForbiddenOperationException`).
3. **Quota Limiting (Max Downloads)**:
   Tokens enforce a configurable download threshold (`maxDownloads = 5`). Once reached, `validateDownloadToken` returns `isValid: false, reason: "Download limit exceeded"`.
4. **Idempotent Webhook Replay**:
   If a webhook replays for an already completed order, the fulfillment engine detects `status === COMPLETED` and avoids regenerating or invalidating existing tokens, preserving existing download links.
5. **Atomic Consistency**:
   Status mutation, token assignment, and audit log generation occur inside the same Prisma `$transaction`. If any step fails, everything rolls back.
