# PLAN-504: Step-by-Step Execution Plan for Secure Download Delivery Endpoint
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.4: Secure time-limited download endpoint (/api/v1/orders/:id/download) with download counters
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites & Dependencies

- [x] Ensure `@aws-sdk/s3-request-presigner` and `@aws-sdk/client-s3` are operational in `MediaModule` (completed in Sprint 3).
- [x] Ensure `IOrderRepository.incrementDownloadCount` and `findByDownloadToken` are operational (completed in Task 4.5).

---

## 2. Implementation Checklist

### Step 1: DTO Contract (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/orders/secure-download.dto.ts`:
  - `SecureDownloadResponseDto` interface (`orderId`, `itemId`, `productId`, `productTitle`, `productType`, `downloadUrl`, `expiresInSeconds`, `downloadCount`, `maxDownloads`, `remainingDownloads`, `lastDownloadedAt`).
- [x] Export `secure-download.dto.ts` from `packages/shared-types/src/dto/orders/index.ts`.
- [x] Build shared-types: `pnpm --filter @vetralink/shared-types build`.

### Step 2: Extend Fulfillment Service Interface (`apps/api`)
- [x] Update `apps/api/src/modules/orders/services/order-fulfillment.service.interface.ts`:
  - Import `SecureDownloadResponseDto`.
  - Add `getSecureDownloadUrl(orderId: string, downloadToken: string, userId: string, userRole: string, traceId?: string, ipAddress?: string): Promise<SecureDownloadResponseDto>`.

### Step 3: Implement `getSecureDownloadUrl` in `OrderFulfillmentService`
- [x] Update `apps/api/src/modules/orders/services/order-fulfillment.service.ts`:
  - Inject `IS3StorageService` (`S3_STORAGE_SERVICE`) and `EnvService`.
  - Verify order exists and caller owns it (`order.userId === userId || userRole === 'ADMIN'`).
  - Verify order status is `OrderStatus.COMPLETED`.
  - Validate token via `validateDownloadToken(downloadToken)`.
  - Enforce quota threshold: if `item.downloadCount >= MAX_DOWNLOADS (5)`, throw `ValidationDomainException`.
  - Resolve delivery S3 bucket and object key:
    - Default key: `watermarked/${orderId}/${itemId}.pdf` in `envService.s3BucketDeliveries`.
    - Fallback: `item.product.contentS3Key` in `envService.s3BucketMedia`.
  - Generate presigned GET URL (TTL: 900 seconds / 15 minutes) via `s3Storage.getPresignedGetUrl`.
  - Increment download count: `await this.orderRepository.incrementDownloadCount(itemId)`.
  - Record audit log: `ORDER_ITEM_DOWNLOADED`.
  - Return `SecureDownloadResponseDto`.

### Step 4: Wire `MediaModule` into `OrdersModule`
- [x] Update `apps/api/src/modules/orders/orders.module.ts`:
  - Import `MediaModule` to provide `S3_STORAGE_SERVICE` to `OrderFulfillmentService`.

### Step 5: Implement `GET /orders/:id/download` Route in `OrdersController`
- [x] Update `apps/api/src/modules/orders/orders.controller.ts`:
  - Add `@Get(':id/download')`:
    - Query: `@Query('token') downloadToken: string`.
    - Query: `@Query('redirect') redirect?: string`.
    - Decorators: `@ApiOperation`, `@ApiOkResponse`, `@ApiFoundResponse`, `@ApiBadRequestResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse`, `@Throttle()`.
    - If `redirect === 'true'`, issue 302 redirect via `@Res() res: Response -> res.redirect(result.downloadUrl)`.
    - Otherwise return `ApiResponse<SecureDownloadResponseDto>`.

### Step 6: Comprehensive Unit & Integration Tests
- [x] Update `apps/api/src/modules/orders/services/order-fulfillment.service.spec.ts`:
  - Test successful presigned download URL generation and counter increment.
  - Test rejection on non-owner user (ForbiddenOperationException).
  - Test rejection on non-COMPLETED order (ValidationDomainException).
  - Test rejection on quota exhaustion (`downloadCount >= 5`).
  - Test rejection on mismatched token and order ID.
- [x] Update `apps/api/src/modules/orders/orders.controller.spec.ts` & `orders.controller.int.spec.ts`:
  - Test `GET /orders/:id/download?token=<token>` returning 200 with presigned URL.
  - Test `GET /orders/:id/download?token=<token>&redirect=true` issuing 302 redirect.
  - Test 403 Forbidden for non-owners.
  - Test 400 Bad Request for uncompleted orders or exceeded quotas.

### Step 7: Full Build & Regression Verification
- [x] Run orders test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/orders
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Update `ROADMAP.md` ticking off Task 5.4.
- [x] Suggest conventional git commit message.

---

## 3. Verification & Acceptance Criteria

1. **Quota Strictness**: Exactly 5 downloads allowed per item. Attempt 6 is hard-rejected with HTTP 400.
2. **Ephemeral Lifetime**: Presigned S3 GET URL is cryptographically configured with TTL = 900 seconds.
3. **Multi-Tenant Security**: Calling download on another farmer's order returns HTTP 403 Forbidden.
4. **Audit Integrity**: Every generated download URL produces an immutable `ORDER_ITEM_DOWNLOADED` audit log entry with IP address and timestamp.
5. **Zero Regression**: Full test suite passes across all modules.
