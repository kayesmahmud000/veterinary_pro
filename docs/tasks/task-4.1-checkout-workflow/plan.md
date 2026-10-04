# PLAN-401: ACID-Compliant Checkout Workflow & Order Snapshot Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.1: ACID-compliant checkout workflow inside Prisma $transaction
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational (`ProductRepository`, `products` table).
- [x] Task 3.6: Product catalog public search with full-text indexing and filtering operational.
- [x] `orders` and `order_items` tables exist in PostgreSQL schema.
- [x] `ITransactionManager` and `IAuditLogRepository` operational.

---

## 2. Granular Implementation Steps

### Step 1: Shared Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/orders/checkout.dto.ts`:
  - `CheckoutItemRequestDto`
  - `CreateCheckoutRequestDto`
  - `OrderItemResponseDto`
  - `CheckoutResponseDto`
  - `OrderDetailResponseDto`
- [x] Export in `packages/shared-types/src/dto/orders/index.ts`, `dto/index.ts`, and root `src/index.ts`.
- [x] Compile `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Domain Entities
- [x] Create `apps/api/src/modules/orders/entities/order.entity.ts`:
  - Pure TypeScript domain entity with encapsulation, status transitions, and response transformation.
- [x] Create `apps/api/src/modules/orders/entities/order-item.entity.ts`:
  - Snapshot item entity storing `productId`, `productTitle`, `priceCents`, `downloadToken`.
- [x] Author unit tests in `order.entity.spec.ts`.

### Step 3: Order Repository Layer
- [x] Create `apps/api/src/modules/orders/repositories/order.repository.interface.ts`:
  - Define `IOrderRepository` and `ORDER_REPOSITORY` token.
- [x] Create `apps/api/src/modules/orders/repositories/order.repository.ts`:
  - Implements `create`, `findById`, `findByGatewayTxId`, `findUserOrders`, `updateStatus`.
  - Maps to/from domain entities and supports transactional client `tx`.
- [x] Author unit tests in `order.repository.spec.ts`.

### Step 4: Payment Gateway Adapter Layer
- [x] Create `apps/api/src/modules/orders/services/payment-gateway.service.interface.ts`:
  - Define `IPaymentGatewayService` and `PAYMENT_GATEWAY_SERVICE` token.
- [x] Create `apps/api/src/modules/orders/services/mock-payment-gateway.service.ts`:
  - Development / test mock implementation returning deterministic `pi_mock_...` client secrets and URLs.
- [x] Create `apps/api/src/modules/orders/services/stripe-payment.service.ts`:
  - Real Stripe payment gateway adapter creating Stripe Payment Intents using `STRIPE_SECRET_KEY`.
- [x] Author unit tests in `payment-gateway.service.spec.ts`.

### Step 5: Checkout Orchestration Service
- [x] Create `apps/api/src/modules/orders/services/checkout.service.interface.ts`:
  - Define `ICheckoutService` and `CHECKOUT_SERVICE` token.
- [x] Create `apps/api/src/modules/orders/services/checkout.service.ts`:
  - Validates all requested products exist, are published, and are not soft-deleted.
  - Computes authoritative prices from `coalesce(discountPriceCents, priceCents)`.
  - Runs inside `transactionManager.run(async (tx) => { ... })`:
    - Inserts `Order` and `OrderItem` snapshots.
    - Calls payment gateway adapter for payment intent.
    - Updates order with `gatewayTxId`.
    - Writes `AuditLog` entry.
  - Implements `getOrderById` and `getUserOrders` with ownership checks.
- [x] Author unit tests in `checkout.service.spec.ts`.

### Step 6: Controller & Orders Module Wiring
- [x] Create `apps/api/src/modules/orders/dto/create-checkout.dto.ts` with `class-validator` rules.
- [x] Create `apps/api/src/modules/orders/orders.controller.ts`:
  - `POST /api/v1/orders/checkout`: Authenticated checkout initialization.
  - `GET /api/v1/orders/my-orders`: User's order history.
  - `GET /api/v1/orders/:id`: Single order details (owner or admin).
- [x] Create `apps/api/src/modules/orders/orders.module.ts` registering providers, repositories, and controller.
- [x] Register `OrdersModule` in `AppModule` (`apps/api/src/app.module.ts`).
- [x] Export module and services in `apps/api/src/modules/orders/index.ts`.

### Step 7: Unit & Supertest Integration Tests
- [x] Author `orders.controller.spec.ts` (unit tests).
- [x] Author `orders.controller.int.spec.ts` (Supertest integration suite testing authentication, price recalculation, foreign order isolation, validation errors, and successful checkout creation).

### Step 8: Full Verification & Roadmap Update
- [x] Run test suite: `pnpm --filter @vetralink/api test src/modules/orders`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 4.1.

---

## 3. Acceptance Criteria
1. **Server-Side Price Authority**: Client cannot manipulate order pricing; line item prices are read directly from authoritative database product records.
2. **ACID Transaction Isolation**: Order and order items are inserted within an explicit database transaction; failure at any step aborts the write with zero orphaned records.
3. **Audit Trail Compliance**: An audit log entry is recorded in the same transaction as the order creation.
4. **Payment Gateway Dispatch**: Emits payment intent / client secret for client-side payment completion.
5. **Customer Ownership Boundary**: A customer can only access their own orders; foreign order access returns 403 Forbidden.
6. **100% Test Pass Rate**: All unit and integration test suites pass with zero regressions.
