# Implementation Plan: Task 15.1 - Vet Consultation Fee Split & Payout Ledger

## Prerequisites
- Working knowledge of `ConsultationPaymentService` in `apps/api/src/modules/consultations/services/consultation-payment.service.ts`.
- Prisma client in `apps/api/prisma/schema.prisma`.
- Shared types package `@vetralink/shared-types`.

---

## Implementation Steps (Atomic Checklist)

- [x] **Step 1: Database Schema & Shared Types**
  - In `schema.prisma`:
    - Define enum `PayoutStatus` (`PENDING`, `PROCESSING`, `PAID`, `HELD`, `REVERSED`).
    - Define model `ConsultationPayoutLedger` with `id`, `consultationId`, `vetId`, `totalFeeCents`, `platformFeeRate`, `platformFeeCents`, `vetPayoutCents`, `currency`, `status`, `payoutBatchId`, `payoutReference`, `processedAt`, `metadata`, `createdAt`, `updatedAt`.
    - Add relations in `User` (`vetPayouts`) and `Consultation` (`payoutLedger`).
    - Run `prisma generate` (`pnpm --filter @vetralink/api db:generate`).
  - In `packages/shared-types`:
    - Add `PayoutStatus` enum in `src/enums/index.ts`.
    - Create `src/dto/consultations/consultation-settlement.dto.ts` with:
      - `FeeSplitCalculationDto`
      - `ConsultationPayoutLedgerDto`
      - `VetEarningsSummaryDto`
      - `PlatformRevenueSummaryDto`
      - `ProcessPayoutDto`
      - `BulkProcessPayoutDto`
      - `PayoutLedgerQueryDto`
    - Re-export in `src/dto/consultations/index.ts` and `src/index.ts`.
    - Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

- [x] **Step 2: Domain Entity & Repository**
  - Create `PayoutLedgerEntity` in `apps/api/src/modules/consultations/entities/payout-ledger.entity.ts`.
  - Create repository interface `IPayoutLedgerRepository` in `apps/api/src/modules/consultations/repositories/payout-ledger.repository.interface.ts`.
  - Implement `PayoutLedgerRepository` in `apps/api/src/modules/consultations/repositories/payout-ledger.repository.ts`.

- [x] **Step 3: Settlement & Fee Split Domain Service**
  - Create service interface `IVetPayoutLedgerService` in `apps/api/src/modules/consultations/services/vet-payout-ledger.service.interface.ts`.
  - Implement `VetPayoutLedgerService` in `apps/api/src/modules/consultations/services/vet-payout-ledger.service.ts`:
    - `calculateSplit(totalFeeCents, platformRate?)`
    - `recordConsultationSettlement(consultationId, customRate?, traceId?)`
    - `getVetPayoutLedger(vetId, filter?)`
    - `getVetEarningsSummary(vetId)`
    - `getPlatformRevenueSummary(filter?)`
    - `processPayout(payoutId, dto, actorUserId, traceId?)`
    - `bulkProcessPayouts(vetId, payoutIds, dto, actorUserId, traceId?)`
  - Wire automatic settlement into `ConsultationPaymentService.capturePayment`:
    - When payment is captured and `consultation.feeCents > 0` and `consultation.vetId` is present, automatically invoke `recordConsultationSettlement`.

- [x] **Step 4: Controller & API Endpoints**
  - Create `ConsultationSettlementController` in `apps/api/src/modules/consultations/controllers/consultation-settlement.controller.ts`:
    - `GET /consultations/settlements/summary` (Admin/Super Admin only)
    - `GET /consultations/settlements/vet/me` (Vet only)
    - `GET /consultations/settlements/vet/:vetId` (Admin or target Vet)
    - `GET /consultations/:id/settlement` (Admin or assigned Vet or Farmer)
    - `POST /consultations/:id/settlement/calculate` (Preview calculation)
    - `POST /consultations/settlements/:id/process` (Admin/Super Admin only)
    - `POST /consultations/settlements/bulk-process` (Admin/Super Admin only)
  - Register repository, service, and controller in `ConsultationsModule`.

- [x] **Step 5: Unit & Integration Tests**
  - Create `vet-payout-ledger.service.spec.ts` testing:
    - Accurate 80/20 fee split calculation without rounding loss.
    - Zero fee handling.
    - Creation and idempotency of payout ledger records.
    - Vet earnings summary calculation.
    - Platform revenue summary calculation.
    - Payout processing transitions (`PENDING` -> `PAID`).
    - Bulk payout processing.
  - Create `consultation-settlement.controller.spec.ts` testing endpoint permissions and responses.
  - Update `consultation-payment.service.spec.ts` verifying automatic settlement on payment capture.
  - Run tests: `pnpm --filter @vetralink/api test payout-ledger settlement consultation-payment`.
  - Run API build: `pnpm --filter @vetralink/api build`.

- [x] **Step 6: Documentation & Roadmap Update**
  - Check off items in `plan.md`.
  - Update `ROADMAP.md` marking Task 15.1 complete.
  - Provide summary, test results, and suggested commit message at human-in-the-loop gate.

---

## Verification & Acceptance Criteria
- Running `POST /consultations/:id/payment/capture` generates a `ConsultationPayoutLedger` entry with 80% to vet and 20% to platform.
- Querying `GET /consultations/settlements/vet/me` returns accrued earnings and ledger items.
- Querying `GET /consultations/settlements/summary` returns gross volume, platform commissions, and owed vs paid vet payouts.
- All unit and integration test suites pass with 100% coverage.
- Clean build of `@vetralink/api`.
