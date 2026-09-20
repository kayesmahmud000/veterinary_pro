# Task 12.4 Specification: Pay-Per-Consult Checkout Authorization Hold Before Session Confirmation

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, clinical consultations often carry a consultation fee (`feeCents`) for pay-per-consult appointments (live video appointments or specialized async tickets).

To protect both farmers and veterinarians:
1. **Guaranteed Payment Without Immediate Charge**: Before confirming a consultation session with an assigned veterinarian, an **authorization hold** must be placed on the farmer's payment method (credit card / debit card) via Stripe using `capture_method: 'manual'`.
2. **Session Confirmation Gate**: A consultation with a fee (`feeCents > 0`) cannot transition to `CONFIRMED` or proceed to active clinical consultation until the payment hold is successfully authorized (`AUTHORIZED`).
3. **Capture Upon Clinical Completion**: Once the attending veterinarian concludes the consultation (`COMPLETED`), the authorization hold is captured (`CAPTURED`) atomically.
4. **Automatic Release on Cancellation**: If the consultation is cancelled or rejected before completion (e.g. by triage officer, veterinarian, or farmer), the authorization hold is released/voided (`RELEASED`) without charging the farmer, avoiding chargeback fees.

---

## 2. Current State vs. Proposed State

### Current State
- `Consultation` has `feeCents: number`, but no fields to track payment authorization holds, payment intents, or payment status.
- `ConsultationEntity` can transition to `ASSIGNED`, `IN_PROGRESS`, and `COMPLETED` without verifying whether payment has been secured.
- The `orders` module has `StripePaymentService` for immediate checkouts (`capture_method: 'automatic'`), but no support for two-step authorization holds (`capture_method: 'manual'`), captures, or voiding/releasing holds.

### Proposed State
- **Database Schema**:
  - Add `ConsultationPaymentStatus` enum (`UNPAID`, `AUTHORIZED`, `CAPTURED`, `RELEASED`, `FAILED`) to Prisma schema.
  - Add `paymentStatus`, `paymentIntentId`, `paymentHeldAt`, `paymentCapturedAt`, `paymentReleasedAt`, and `currency` to `Consultation`.
- **Domain Entity**:
  - `ConsultationEntity` enforces payment state transitions: `placePaymentHold()`, `capturePayment()`, `releasePaymentHold()`, `markPaymentFailed()`.
- **Payment Gateway Abstraction**:
  - Dedicated `IConsultationPaymentGateway` supporting `createAuthorizationHold()`, `captureHold()`, and `releaseHold()`.
  - Supports live Stripe client (`capture_method: 'manual'`) and fallback to deterministic mock gateway for testing and offline environments.
- **Service & Controller**:
  - `ConsultationPaymentService`: orchestrates holds, confirmations, captures, releases, and audit logging.
  - `ConsultationPaymentController` at `/consultations/:id/payment`:
    - `POST /consultations/:id/payment/hold`: initiate authorization hold and return `clientSecret`.
    - `POST /consultations/:id/payment/confirm-hold`: confirm authorization hold.
    - `POST /consultations/:id/payment/capture`: capture payment upon completion.
    - `POST /consultations/:id/payment/release`: release/void hold upon cancellation.
  - Integration with `cancelTriageCase` to automatically void active holds.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Payment Flow** | Immediate capture upon booking with refund on cancellation. | Two-step authorization hold (`capture_method: 'manual'`) + capture upon completion. | **Selected: Option B**. Refunds take 5-10 business days and incur non-refundable Stripe processing fees. An authorization hold places a temporary hold on the card limit without settling funds, allowing instantaneous, fee-free release if a consultation is cancelled or declined during triage. |
| **Gateway Architecture** | Directly call Stripe in `ConsultationService`. | Implement `IConsultationPaymentGateway` interface with Stripe and mock providers. | **Selected: Option B**. Adheres to Dependency Inversion Principle (DIP). Allows reliable, deterministic unit and integration tests without network dependencies or live Stripe credentials. |
| **Hold Lifecycle Storage** | Store payment state in a separate `ConsultationPayment` table. | Store payment status and timestamps directly on `Consultation`. | **Selected: Option B**. Consultations have a strict 1-to-1 relationship with their fee hold. Direct fields avoid unnecessary joins and keep payment state changes atomic within the consultation aggregate. |

---

## 4. Data Models & Contracts

### Prisma Schema Additions

```prisma
enum ConsultationPaymentStatus {
  UNPAID
  AUTHORIZED
  CAPTURED
  RELEASED
  FAILED
}

model Consultation {
  // ... existing fields ...
  paymentStatus      ConsultationPaymentStatus @default(UNPAID) @map("payment_status")
  paymentIntentId    String?                   @map("payment_intent_id") @db.VarChar(255)
  paymentHeldAt      DateTime?                 @map("payment_held_at") @db.Timestamptz(6)
  paymentCapturedAt  DateTime?                 @map("payment_captured_at") @db.Timestamptz(6)
  paymentReleasedAt  DateTime?                 @map("payment_released_at") @db.Timestamptz(6)
  currency           String                    @default("USD") @db.VarChar(10)
}
```

### Shared Types (`packages/shared-types`)

```typescript
export enum ConsultationPaymentStatus {
  UNPAID = "UNPAID",
  AUTHORIZED = "AUTHORIZED",
  CAPTURED = "CAPTURED",
  RELEASED = "RELEASED",
  FAILED = "FAILED",
}

export interface ConsultationPaymentHoldResultDto {
  consultationId: string;
  paymentIntentId: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
  paymentStatus: ConsultationPaymentStatus;
}

export interface ConfirmPaymentHoldDto {
  paymentIntentId: string;
}

export interface CaptureConsultationPaymentResultDto {
  consultationId: string;
  paymentIntentId: string;
  amountCents: number;
  paymentStatus: ConsultationPaymentStatus;
  capturedAt: string;
}

export interface ReleaseConsultationHoldResultDto {
  consultationId: string;
  paymentIntentId: string;
  paymentStatus: ConsultationPaymentStatus;
  releasedAt: string;
  reason?: string;
}
```

---

## 5. Security & Edge Cases

1. **Authorization & Tenant Isolation**:
   - `POST /consultations/:id/payment/hold` and `confirm-hold` require the requesting user to be the consultation's farmer or a member of the farm tenant (`TenantGuard`).
   - `capture` and `release` endpoints can be triggered by triage officers, attending veterinarians, or automated lifecycle events.
2. **Zero-Fee Consultations**:
   - If `feeCents === 0` (e.g. routine check covered by farm subscription tier), creating an authorization hold is a no-op; `paymentStatus` immediately marks `CAPTURED` without contacting Stripe.
3. **Idempotency**:
   - If `hold` is called multiple times on an already `AUTHORIZED` consultation, the existing `paymentIntentId` and client secret are safely returned without duplicating holds.
4. **Expired Holds**:
   - Stripe authorization holds expire after 7 days. If a hold expires before a live session, the system prevents session start and prompts the farmer to re-authorize.
5. **Audit Logging**:
   - All payment mutations (`CONSULTATION_PAYMENT_HOLD_CREATED`, `CONSULTATION_PAYMENT_CAPTURED`, `CONSULTATION_PAYMENT_HOLD_RELEASED`) emit audit log entries with monetary amounts, intent IDs, and actor IDs.
