# Task 12.4 Execution Plan: Pay-Per-Consult Checkout Authorization Hold Before Session Confirmation

## Prerequisites
- [x] Tasks 12.1, 12.2, and 12.3 completed and verified.
- [x] Shared types package built and linked.

---

## Implementation Steps

### 1. Shared Types & Contracts (`packages/shared-types`)
- [x] Add `ConsultationPaymentStatus` enum in `packages/shared-types/src/enums/index.ts`.
- [x] Add payment hold DTOs to `packages/shared-types/src/dto/consultations/consultation.dto.ts`:
  - `ConsultationPaymentHoldResultDto`
  - `ConfirmPaymentHoldDto`
  - `CaptureConsultationPaymentResultDto`
  - `ReleaseConsultationHoldResultDto`
- [x] Update `ConsultationResponseDto` and `TriageQueueItemDto` with payment fields:
  - `paymentStatus`, `paymentIntentId`, `paymentHeldAt`, `paymentCapturedAt`, `paymentReleasedAt`, `currency`.
- [x] Rebuild `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### 2. Database Schema (`apps/api/prisma/schema.prisma`)
- [x] Add `ConsultationPaymentStatus` enum to `schema.prisma`.
- [x] Add `paymentStatus`, `paymentIntentId`, `paymentHeldAt`, `paymentCapturedAt`, `paymentReleasedAt`, `currency` to `Consultation`.
- [x] Run `pnpm --filter api db:generate` to regenerate Prisma Client.

### 3. NestJS DTOs (`apps/api/src/modules/consultations/dto`)
- [x] Create `confirm-payment-hold.dto.ts` with `class-validator` rules (`paymentIntentId`).
- [x] Create `release-payment-hold.dto.ts` with `class-validator` rules (`reason`).
- [x] Export new DTOs in `apps/api/src/modules/consultations/dto/index.ts`.

### 4. Domain Entity (`apps/api/src/modules/consultations/entities`)
- [x] Update `ConsultationEntity` in `consultation.entity.ts`:
  - `placePaymentHold(paymentIntentId: string, now?: Date): void`
  - `capturePayment(now?: Date): void`
  - `releasePaymentHold(now?: Date): void`
  - `markPaymentFailed(now?: Date): void`
  - Update `fromPersistence()` and `toResponseDto()`.
- [x] Update unit tests in `consultation.entity.spec.ts`.

### 5. Payment Gateway Layer (`apps/api/src/modules/consultations/services`)
- [x] Create `consultation-payment-gateway.interface.ts`:
  - `createAuthorizationHold(consultationId: string, amountCents: number, currency: string, customerEmail?: string)`
  - `captureHold(paymentIntentId: string, amountCents?: number)`
  - `releaseHold(paymentIntentId: string)`
- [x] Implement `ConsultationStripePaymentGateway` in `consultation-stripe-payment.service.ts` with mock fallback.
- [x] Unit tests for gateway in `consultation-stripe-payment.service.spec.ts`.

### 6. Domain Service Layer (`apps/api/src/modules/consultations/services`)
- [x] Create `consultation-payment.service.interface.ts` and `ConsultationPaymentService`:
  - `createHold(consultationId: string, farmId: string, userId: string, traceId?: string)`
  - `confirmHold(consultationId: string, paymentIntentId: string, userId: string, traceId?: string)`
  - `capturePayment(consultationId: string, userId: string, traceId?: string)`
  - `releaseHold(consultationId: string, reason: string, userId: string, traceId?: string)`
- [x] Integrate automatic hold release into `cancelTriageCase` in `ConsultationService`.
- [x] Unit tests in `consultation-payment.service.spec.ts`.

### 7. Controller & Module Wiring (`apps/api/src/modules/consultations`)
- [x] Create `ConsultationPaymentController` at `consultations/:id/payment`:
  - `POST /consultations/:id/payment/hold`
  - `POST /consultations/:id/payment/confirm-hold`
  - `POST /consultations/:id/payment/capture`
  - `POST /consultations/:id/payment/release`
- [x] Register `ConsultationPaymentController`, `ConsultationPaymentService`, and payment gateway in `ConsultationsModule`.
- [x] Unit tests in `consultation-payment.controller.spec.ts`.

### 8. Verification & Test Execution
- [x] Run test suite: `pnpm --filter api test -- src/modules/consultations` (12 suites, 115 tests passed).
- [x] Verify build: `pnpm --filter api build` (build code 0).

### 9. Documentation & Human-in-the-Loop Gate
- [x] Mark checklist items complete in this `plan.md`.
- [x] Mark Task 12.4 complete in `ROADMAP.md`.
- [x] Present completion summary, test results, and suggested conventional commit message.
- [x] STOP and wait for human confirmation.
