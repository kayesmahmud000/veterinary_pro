# SPEC-401: ACID-Compliant Checkout Workflow & Order Snapshot Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 4: Orders, Checkout & Payment Webhooks
# Task 4.1: ACID-compliant checkout workflow inside Prisma $transaction
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

In digital veterinary education and AgTech asset marketplaces, cart checkout and order creation represent mission-critical financial mutations. When a user purchases a digital product (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`), the transaction must guarantee:
1. **Price & Availability Integrity**: Pricing must be calculated server-side from authoritative product records—never trusted from client request payloads. Inactive, unpublished, or soft-deleted products must be rejected.
2. **ACID Financial Snapshot**: Product pricing can change at any time (e.g. promotional discounts ending). When an order is placed, an immutable historical snapshot of the exact price paid per line item must be written into `order_items` inside an explicit atomic database transaction (`$transaction`).
3. **Payment Intent / Session Dispatch**: Integration with the payment gateway (Stripe / Local MFS) to initialize a secure payment intent or checkout session, linking the gateway's transaction identifier (`gateway_tx_id`) to the pending order.
4. **Zero Over-Payment / State Desync**: If gateway dispatch fails or the database write fails, the transaction is cleanly aborted with zero partial writes.

**Task 4.1** establishes the foundation of the **Orders & Checkout Engine** under Clean Architecture:
- `OrderEntity` and `OrderItemEntity` domain models.
- `IOrderRepository` with transactional execution.
- `IPaymentGatewayService` port with Stripe & Local Development/Test Mock adapter.
- `CheckoutService` orchestrating the atomic transactional checkout workflow.
- `OrdersController` exposing authenticated checkout initialization and order retrieval endpoints.

---

## 2. Current State vs. Proposed State

### Current State
- `products` table and `products` module exist with price management (`price_cents`, `discount_price_cents`).
- `orders` and `order_items` tables exist in Prisma 3NF schema, but there are no domain entities, repositories, services, or controllers for orders.
- No payment gateway integration or checkout orchestration exists.

### Proposed State
- **New Module**: `apps/api/src/modules/orders/` following Clean Architecture:
  - `entities/`: `order.entity.ts`, `order-item.entity.ts`
  - `dto/`: `create-checkout.dto.ts`, `order-query.dto.ts`
  - `repositories/`: `order.repository.interface.ts`, `order.repository.ts`
  - `services/`: `checkout.service.interface.ts`, `checkout.service.ts`, `payment-gateway.service.interface.ts`, `stripe-payment.service.ts`, `mock-payment.service.ts`
  - `orders.controller.ts`: API endpoints for initiating checkout, viewing order details, and listing customer purchase history.
- **Shared Contracts**: Add `CreateCheckoutRequestDto`, `CheckoutResponseDto`, `OrderDetailResponseDto`, `OrderItemResponseDto` to `@vetralink/shared-types`.
- **Atomic Transaction**: Enforced via `ITransactionManager` with simultaneous CUD `AuditLog` generation per GUARDRAIL-02 and GUARDRAIL-07.

---

## 3. Architectural & Design Trade-Offs

### Trade-Off 1: Payment Intent First vs. Database Order First
- **Option A (Create Payment Intent on Gateway First, then write Order to DB)**:
  - *Cons*: If database insert fails (e.g. deadlock, validation error), an orphaned payment intent exists on Stripe that might be paid by a user but has no corresponding order record.
- **Option B (Create Order in DB as PENDING inside transaction, then attach Gateway TX ID — Selected)**:
  - *Pros*: The database order is created in `PENDING` status. The payment intent is created with `metadata: { orderId }`. If gateway creation fails, the database transaction is rolled back. The order ID provides a strictly traceable idempotency key for webhooks.
  - *Verdict*: **Option B is selected**.

### Trade-Off 2: Direct Cart Array vs. Single Item Checkout
- Agricultural veterinarians and commercial farm managers frequently purchase bundles (e.g., a calf deworming manual + dairy feed formulation Excel model).
- The checkout DTO accepts an array of item requests: `items: [{ productId: string }]`.
- The service deduplicates items, validates each against Prisma, calculates individual effective prices (`coalesce(discountPriceCents, priceCents)`), and computes the consolidated sum.
- *Verdict*: Supports single and multi-item checkouts uniformly.

### Trade-Off 3: Payment Gateway Abstraction (Stripe vs. Mock in Dev/Test)
- Production uses Stripe (`PaymentIntent` / `Checkout.Session`).
- Running Jest unit and Supertest integration tests or local offline development without internet access should not require live Stripe credentials.
- `IPaymentGatewayService` defines a common port:
  - In production / staging with `STRIPE_SECRET_KEY`: `StripePaymentService` creates real Stripe Payment Intents.
  - In development / test when Stripe is unconfigured: `MockPaymentGatewayService` generates deterministic simulated gateway intents (`pi_mock_...`), allowing offline end-to-end development.
- *Verdict*: Clean Port-and-Adapter architecture guarantees testability and environment independence.

---

## 4. Data Models, Contracts & DTOs

### 1. Shared Types (`packages/shared-types/src/dto/orders/checkout.dto.ts`)
```typescript
export interface CheckoutItemRequestDto {
  productId: string;
}

export interface CreateCheckoutRequestDto {
  items: CheckoutItemRequestDto[];
  paymentGateway?: string; // default "stripe"
  successUrl?: string;
  cancelUrl?: string;
}

export interface OrderItemResponseDto {
  id: string;
  productId: string;
  productTitle: string;
  priceCents: number;
  downloadToken: string;
}

export interface CheckoutResponseDto {
  orderId: string;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  paymentGateway: string;
  clientSecret?: string; // Stripe PaymentIntent client_secret
  checkoutUrl?: string; // Stripe Hosted Checkout URL or payment gateway redirect
  items: OrderItemResponseDto[];
}

export interface OrderDetailResponseDto {
  id: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  paymentGateway: string;
  gatewayTxId: string | null;
  items: OrderItemResponseDto[];
  createdAt: string;
  updatedAt: string;
}
```

### 2. NestJS DTO (`apps/api/src/modules/orders/dto/create-checkout.dto.ts`)
```typescript
export class CheckoutItemDto implements CheckoutItemRequestDto {
  @ApiProperty({ description: "Target product UUID" })
  @IsUUID("4")
  productId!: string;
}

export class CreateCheckoutDto implements CreateCheckoutRequestDto {
  @ApiProperty({ type: [CheckoutItemDto], description: "List of items to purchase" })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiPropertyOptional({ default: "stripe" })
  @IsOptional()
  @IsString()
  paymentGateway?: string = "stripe";
}
```

### 3. Service & Repository Interfaces

#### `IOrderRepository` (`apps/api/src/modules/orders/repositories/order.repository.interface.ts`)
```typescript
export interface IOrderRepository {
  create(order: OrderEntity, items: OrderItemEntity[], tx?: Prisma.TransactionClient): Promise<OrderEntity>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<OrderEntity | null>;
  findByGatewayTxId(gatewayTxId: string, tx?: Prisma.TransactionClient): Promise<OrderEntity | null>;
  findUserOrders(userId: string, skip?: number, take?: number, tx?: Prisma.TransactionClient): Promise<{ orders: OrderEntity[]; total: number }>;
  updateStatus(id: string, status: OrderStatus, gatewayTxId?: string, tx?: Prisma.TransactionClient): Promise<OrderEntity>;
}
export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");
```

#### `IPaymentGatewayService` (`apps/api/src/modules/orders/services/payment-gateway.service.interface.ts`)
```typescript
export interface PaymentIntentResult {
  gatewayTxId: string;
  clientSecret?: string;
  checkoutUrl?: string;
}

export interface IPaymentGatewayService {
  createPaymentIntent(orderId: string, amountCents: number, currency: string, userEmail: string): Promise<PaymentIntentResult>;
}
export const PAYMENT_GATEWAY_SERVICE = Symbol("PAYMENT_GATEWAY_SERVICE");
```

#### `ICheckoutService` (`apps/api/src/modules/orders/services/checkout.service.interface.ts`)
```typescript
export interface ICheckoutService {
  createCheckout(userId: string, userEmail: string, dto: CreateCheckoutRequestDto, traceId?: string): Promise<CheckoutResponseDto>;
  getOrderById(orderId: string, userId: string, isAdmin?: boolean): Promise<OrderDetailResponseDto>;
  getUserOrders(userId: string, page?: number, limit?: number): Promise<{ items: OrderDetailResponseDto[]; meta: PaginationMeta }>;
}
export const CHECKOUT_SERVICE = Symbol("CHECKOUT_SERVICE");
```

---

## 5. API Endpoints

### 1. `POST /api/v1/orders/checkout`
- **Auth**: `Bearer <AccessToken>` (`JwtAuthGuard`).
- **Body**: `{ items: [{ productId: "UUID" }], paymentGateway: "stripe" }`.
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Checkout initiated successfully.",
    "data": {
      "orderId": "33333333-3333-4333-8333-333333333333",
      "totalCents": 4900,
      "currency": "USD",
      "status": "PENDING",
      "paymentGateway": "stripe",
      "clientSecret": "pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_YrKJ...",
      "items": [
        {
          "id": "item-1111",
          "productId": "11111111-1111-4111-8111-111111111111",
          "productTitle": "Bovine Mastitis Protocol",
          "priceCents": 4900,
          "downloadToken": "token-1111"
        }
      ]
    }
  }
  ```

### 2. `GET /api/v1/orders/:id`
- **Auth**: `Bearer <AccessToken>` (`JwtAuthGuard`).
- **Response**: `200 OK` with order details (restricted to order owner or Admin).

### 3. `GET /api/v1/orders/my-orders`
- **Auth**: `Bearer <AccessToken>` (`JwtAuthGuard`).
- **Response**: `200 OK` with paginated customer purchase history.

---

## 6. Security & Edge Cases
1. **Price Tampering Prevention**: Prices are completely ignored if passed in the client body; prices are read directly from PostgreSQL `products` record at the instant of checkout.
2. **Unpublished / Draft Isolation**: Products that are not published (`isPublished === false`) or soft-deleted (`deletedAt !== null`) fail checkout with standard 400 Bad Request.
3. **Customer Isolation**: A user cannot inspect another user's order details; requests for foreign orders return 403 Forbidden.
4. **Duplicate Product Elimination**: Duplicate `productId` entries in the checkout request array are consolidated so customers aren't billed twice for the same product in a single checkout.
5. **ACID Transaction Guarantee**: Database operations wrap order and item insertion inside `prisma.$transaction`.
