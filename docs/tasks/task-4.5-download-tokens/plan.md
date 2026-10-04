# PLAN-405: Automated Download Token Generation & Order Fulfillment Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.5: Automated download token generation upon payment completion
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 4.1: ACID-compliant checkout workflow operational.
- [x] Task 4.2: Stripe webhook receiver operational.
- [x] Task 4.3: Regional MFS webhook receiver operational.
- [x] Task 4.4: Idempotency key guard operational.
- [x] Prisma database schema with `OrderItem.downloadToken`, `downloadCount`, and `lastDownloadedAt`.

---

## 2. Granular Implementation Steps

### Step 1: Shared Contracts & DTOs
- [x] Create `packages/shared-types/src/dto/orders/download-token.dto.ts`:
  - Define `DownloadTokenItemDto`.
  - Define `OrderDownloadTokensResponseDto`.
- [x] Export new DTOs in `packages/shared-types/src/dto/orders/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build shared types package: `pnpm --filter @vetralink/shared-types build`.

### Step 2: Repository Enhancements (`OrderRepository`)
- [x] Update `apps/api/src/modules/orders/repositories/order.repository.interface.ts`:
  - Add `updateItemDownloadTokens(orderId: string, tokens: { itemId: string; downloadToken: string }[], tx?: Prisma.TransactionClient): Promise<void>`.
  - Add `findByDownloadToken(downloadToken: string, tx?: Prisma.TransactionClient): Promise<{ order: OrderEntity; item: OrderItemEntity; contentS3Key: string } | null>`.
  - Add `incrementDownloadCount(itemId: string, tx?: Prisma.TransactionClient): Promise<OrderItemEntity>`.
- [x] Implement new methods in `apps/api/src/modules/orders/repositories/order.repository.ts`.
- [x] Author unit tests in `apps/api/src/modules/orders/repositories/order.repository.spec.ts`.

### Step 3: Order Fulfillment Service Core (`OrderFulfillmentService`)
- [x] Create `apps/api/src/modules/orders/services/order-fulfillment.service.interface.ts`:
  - Define `DownloadTokenValidationResult`.
  - Define `IOrderFulfillmentService` interface and `ORDER_FULFILLMENT_SERVICE` injection token.
- [x] Create `apps/api/src/modules/orders/services/order-fulfillment.service.ts`:
  - `fulfillOrder(orderId, gatewayTxId, tx, traceId)`: transitions order to `COMPLETED`, generates cryptographically unique UUIDv4 download tokens for all line items, updates `order_items`, and records `ORDER_FULFILLED` audit log.
  - `getOrderDownloadTokens(orderId, userId, userRole)`: verifies order is `COMPLETED` and caller is owner/admin; formats response.
  - `validateDownloadToken(downloadToken)`: looks up item, verifies order `COMPLETED`, verifies download counter within limit (`MAX_DOWNLOADS = 5`).
  - `recordDownload(downloadToken, tx)`: increments download count and updates timestamp.
- [x] Register `OrderFulfillmentService` in `apps/api/src/modules/orders/orders.module.ts`.
- [x] Author unit tests in `apps/api/src/modules/orders/services/order-fulfillment.service.spec.ts`.

### Step 4: Webhook Integration
- [x] Update `apps/api/src/modules/orders/services/stripe-webhook.service.ts`:
  - Inject `ORDER_FULFILLMENT_SERVICE`.
  - Call `orderFulfillmentService.fulfillOrder(order.id, gatewayTxId, tx, traceId)` upon `payment_intent.succeeded`.
- [x] Update `apps/api/src/modules/orders/services/mfs-webhook.service.ts`:
  - Inject `ORDER_FULFILLMENT_SERVICE`.
  - Call `orderFulfillmentService.fulfillOrder(order.id, payload.gatewayTxId, tx, traceId)` upon `VALID` IPN status.

### Step 5: Customer Download Token Endpoint
- [x] Update `apps/api/src/modules/orders/orders.controller.ts`:
  - Add `GET /orders/:id/download-tokens`: authenticated via `JwtAuthGuard`, returns `OrderDownloadTokensResponseDto`.
  - Decorate with OpenAPI Swagger annotations (`@ApiOkResponse`, `@ApiForbiddenResponse`, `@ApiBadRequestResponse`).
- [x] Update `apps/api/src/modules/orders/orders.controller.spec.ts` and `apps/api/src/modules/orders/orders.controller.int.spec.ts`.

### Step 6: Comprehensive Integration Testing
- [x] Author `apps/api/src/modules/orders/orders-fulfillment.int.spec.ts`:
  - Verify webhook payment completion automatically issues fresh download tokens.
  - Verify `GET /orders/:id/download-tokens` returns tokens for paid orders.
  - Verify `GET /orders/:id/download-tokens` rejects unpaid/pending orders with HTTP 400.
  - Verify non-owner receives HTTP 403 Forbidden.
  - Verify `validateDownloadToken` approves valid token and rejects exceeded/non-existent token.

### Step 7: Verification & Acceptance
- [x] Run test suite: `pnpm --filter @vetralink/api test src/modules/orders`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Check off Task 4.5 in `ROADMAP.md`.

---

## 3. Acceptance Criteria
1. **Automated Issuance on Succeeded Webhook**: When a Stripe or Regional MFS webhook reports successful payment, fresh download tokens are generated and stored in PostgreSQL inside the same atomic transaction.
2. **Unpaid Order Protection**: Any attempt to retrieve tokens for an order that is `PENDING`, `FAILED`, or `CANCELLED` is blocked with HTTP 400.
3. **Owner Access Control**: Only the buyer or an admin can access download tokens for an order; other users receive HTTP 403.
4. **Download Quota Governance**: The engine tracks download attempts and enforces a maximum download threshold (e.g. 5 downloads per item).
5. **100% Test Coverage**: All unit, repository, service, and Supertest integration tests pass with zero regressions.
