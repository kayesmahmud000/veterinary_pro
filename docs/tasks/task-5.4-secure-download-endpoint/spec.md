# SPEC-504: Secure Time-Limited Download Delivery Endpoint & Quota Enforcement
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.4: Secure time-limited download endpoint (/api/v1/orders/:id/download) with download counters
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
Allowing unrestricted, direct public access to digital veterinary assets (eBooks, spreadsheets, guides) exposes digital inventory to mass scraping, unauthorized redistribution, and resource leeching:
1. **Direct S3 Link Leaks**: Static or unexpiring S3 links shared on messaging boards or social media allow non-purchasing parties to download proprietary assets indefinitely at platform bandwidth expense.
2. **Account Sharing & Link Flooding**: Without atomic download counters and quota limits per digital line item, a single purchaser can share their active download URL with dozens of colleagues or competitors.
3. **Delivery Artifact Ambiguity**: Digital orders may have personalized watermarked PDF deliverables (in `S3_BUCKET_DELIVERIES`) or original non-watermarked templates (e.g. `EXCEL_TOOL` in `S3_BUCKET_MEDIA`). The download system must resolve the correct secure S3 asset key dynamically.
4. **Lack of Auditability**: Legal and compliance frameworks require tracking who downloaded which asset, at what UTC timestamp, from which IP address, and under which order ID.

### The Objective
Implement a high-security, **Time-Limited Download Delivery Endpoint** (`GET /api/v1/orders/:id/download`):
1. **Multi-Tenant Ownership & RBAC Guard**: Guard the endpoint with `JwtAuthGuard`. Enforce that only the order owner (`order.userId === currentUser.id`) or a system `ADMIN` can initiate downloads.
2. **Settled Order Status Enforcement**: Verify the order status is strictly `OrderStatus.COMPLETED`. Reject access for `PENDING`, `FAILED`, or `REFUNDED` orders.
3. **Cryptographic Token & Quota Counter Verification**:
   - Query line item by `downloadToken` (UUID).
   - Enforce maximum download limit (`MAX_DOWNLOADS = 5`).
   - If `downloadCount >= MAX_DOWNLOADS`, reject with HTTP 400 (`ValidationDomainException`).
4. **Time-Bound Presigned S3 GET URL (TTL: 15 Minutes)**:
   - Generate an ephemeral presigned S3 URL valid for exactly 900 seconds (15 minutes).
   - Resolve watermarked artifact `watermarked/<order-id>/<item-id>.pdf` in `S3_BUCKET_DELIVERIES` when available, falling back to authoritative `contentS3Key` in `S3_BUCKET_MEDIA`.
5. **Atomic Usage Tracking & Audit Trail**:
   - Atomically increment `downloadCount` in PostgreSQL.
   - Update `lastDownloadedAt = new Date()`.
   - Emit an `AuditLog` record (`ORDER_ITEM_DOWNLOADED`).
6. **Dual Response Mode**:
   - Standard JSON envelope returning download URL, expiration TTL, and remaining quota.
   - Optional browser direct download redirect (`?redirect=true`) returning HTTP 302 Found to presigned S3 URL for frictionless browser downloads.

---

## 2. Current State vs. Proposed State

| Capability | Current State | Proposed State (Post Task 5.4) |
| :--- | :--- | :--- |
| **Download Endpoint** | Only `GET /orders/:id/download-tokens` (listing token metadata) exists. | Fully secure `GET /orders/:id/download` generating time-limited presigned S3 URLs. |
| **S3 Presigned URL Delivery** | None for orders. | Ephemeral presigned URL (TTL: 900s) generated via `IS3StorageService.getPresignedGetUrl`. |
| **Download Counter Mutation** | `recordDownload()` interface method exists but is not wired to an active HTTP endpoint. | Atomic increment of `downloadCount` and `lastDownloadedAt` executed on every authorized download request. |
| **Quota Enforcement** | Basic quota calculation exists. | Hard enforcement rejecting requests when `downloadCount >= MAX_DOWNLOADS` (5). |
| **Audit Logging** | Generic order logs. | Dedicated `ORDER_ITEM_DOWNLOADED` audit log recording user, IP, order, and line item ID. |
| **Browser Redirect Option** | N/A | Optional `?redirect=true` returning HTTP 302 redirect for direct browser downloads. |

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Ephemeral Presigned S3 GET URL vs. Server Streaming Proxy
- **Option A: Streaming the PDF file through the NestJS API server (`res.pipe(...)`).**
  - *Cons*: Heavy memory and network I/O on the API gateway; multiple concurrent 50MB eBook downloads saturate Node.js event loops and socket connections.
- **Option B (Selected): Time-Bound Presigned S3 URL (TTL: 15 Minutes / 900s).**
  - *Pros*: Offloads all heavy file streaming directly to AWS S3 / Cloudflare CDN; API server only performs sub-millisecond database quota checks and HMAC URL signing; zero memory bloat on API.
  - *Rationale*: Optimal AgTech cloud architecture, ensuring scalable delivery even during traffic surges.

### Trade-off 2: Ephemeral URL Lifetime (15 Minutes vs. 24 Hours)
- **Option A: 24 to 72 hour presigned URLs.**
  - *Cons*: High risk of link sharing; within 72 hours, a link can be forwarded to many unauthorized users.
- **Option B (Selected): 15-Minute (900 seconds) Window.**
  - *Pros*: Provides ample time for low-bandwidth rural connections to begin downloading, but expires quickly enough to prevent link forwarding. Once the download begins, the HTTP transfer completes even if the 15-minute token window expires.
  - *Rationale*: Best security posture for digital intellectual property.

### Trade-off 3: Atomic Counter Increment (Pre-URL vs. Post-Download Webhook)
- **Option A: Post-download S3 event notification.**
  - *Cons*: S3 does not send direct download completion webhooks for presigned GET requests without complex CloudWatch/EventBridge infrastructure; adds asynchronous lag to download counter tracking.
- **Option B (Selected): Atomic counter increment at URL issuance time.**
  - *Pros*: Guaranteed atomic enforcement; prevents race conditions or automated scraping bursts from exceeding quota.
  - *Rationale*: Standard digital fulfillment practice for secure digital stores.

---

## 4. Data Models, Contracts & DTOs

### 1. Secure Download Response DTO (`packages/shared-types/src/dto/orders/secure-download.dto.ts`)
```typescript
export interface SecureDownloadResponseDto {
  readonly orderId: string;
  readonly itemId: string;
  readonly productId: string;
  readonly productTitle: string;
  readonly productType: string;
  readonly downloadUrl: string;
  readonly expiresInSeconds: number;
  readonly downloadCount: number;
  readonly maxDownloads: number;
  readonly remainingDownloads: number;
  readonly lastDownloadedAt: string;
}
```

### 2. Service Interface Extension (`order-fulfillment.service.interface.ts`)
```typescript
export interface IOrderFulfillmentService {
  // Existing methods...
  fulfillOrder(orderId: string, gatewayTxId?: string, tx?: Prisma.TransactionClient, traceId?: string): Promise<OrderEntity>;
  getOrderDownloadTokens(orderId: string, userId: string, userRole: string): Promise<OrderDownloadTokensResponseDto>;
  validateDownloadToken(downloadToken: string): Promise<DownloadTokenValidationResult>;
  recordDownload(downloadToken: string, tx?: Prisma.TransactionClient): Promise<void>;

  // New Method for Task 5.4:
  getSecureDownloadUrl(
    orderId: string,
    downloadToken: string,
    userId: string,
    userRole: string,
    traceId?: string,
    ipAddress?: string
  ): Promise<SecureDownloadResponseDto>;
}
```

---

## 5. Security & Edge Cases

1. **Quota Exhaustion**: Once `downloadCount >= 5`, subsequent requests fail immediately with HTTP 400 (`ValidationDomainException`).
2. **Ownership Isolation**: A buyer cannot download assets from an order belonging to another user. Enforced via `order.userId === userId || userRole === 'ADMIN'`. Unauthorized attempts result in HTTP 403 (`ForbiddenOperationException`).
3. **Mismatched Token & Order**: If `downloadToken` belongs to Order A, but the user calls `GET /orders/B/download?token=tokenA`, validation fails with HTTP 400 (`Token does not belong to this order`).
4. **Unpaid Orders**: Orders in `PENDING`, `FAILED`, or `REFUNDED` status are rejected with HTTP 400.
5. **Rate Limiting**: Public endpoint decorated with `@Throttle()` to protect against brute-force token enumeration.
