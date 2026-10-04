# Specification: Task 15.1 - Vet Consultation Fee Split & Payout Ledger

## 1. Feature Overview & Objective
In VetraLink's telehealth platform, consultations generate revenue via farmer consultation fees. When a consultation is conducted and payment is captured, the platform must split the gross consultation fee between the attending veterinarian and the platform according to an agreed commercial split (by default: 80% to the veterinarian, 20% platform commission).

The objective of Task 15.1 is to:
1. Implement a **Consultation Fee Split Engine** enforcing exact integer cent arithmetic (`total = vetPayout + platformFee`) without fractional penny drift.
2. Establish a permanent **Payout Ledger (`ConsultationPayoutLedger`)** in PostgreSQL to track every financial settlement, vet earnings, platform fees, settlement statuses (`PENDING`, `PROCESSING`, `PAID`, `HELD`, `REVERSED`), and payment batch/reference identifiers.
3. Automatically record a ledger entry upon consultation payment capture in `ConsultationPaymentService`.
4. Provide veterinarians with an **Earnings & Settlement Dashboard** (`/consultations/settlements/vet/me`) reporting lifetime gross earnings, platform deductions, net payouts, pending balances, and settlement history.
5. Provide platform administrators with a **Platform Revenue & Payout Management** endpoint suite to monitor gross transaction volume, collected platform commissions, and execute/mark payouts as processed (`POST /consultations/settlements/:id/process` and bulk payout processing).

---

## 2. Current State vs. Proposed State

### Current State:
- `ConsultationPaymentService` manages Stripe authorization holds (`createHold`), hold confirmations (`confirmHold`), captures (`capturePayment`), and releases (`releaseHold`).
- While `Consultation` tracks `feeCents`, `paymentStatus` (`UNPAID`, `AUTHORIZED`, `CAPTURED`, `RELEASED`), and `currency`, there is no ledger tracking the revenue split between the vet and the platform.
- Veterinarians have no ledger or API to query their accrued earnings or pending payouts.
- Administrators have no automated settlement mechanism to disburse vet earnings or report platform commissions.

### Proposed State:
- `schema.prisma` includes `model ConsultationPayoutLedger` and enum `PayoutStatus`.
- When `ConsultationPaymentService.capturePayment` executes:
  - It automatically invokes the settlement logic if `feeCents > 0` and `vetId` is present.
  - Generates a `ConsultationPayoutLedger` entry in `PENDING` status.
  - Enforces exact mathematical integrity: `platformFeeCents = round(totalFeeCents * 0.20)`, `vetPayoutCents = totalFeeCents - platformFeeCents`.
- `VetPayoutLedgerService` provides comprehensive querying, reporting, and payout lifecycle management.
- `ConsultationSettlementController` exposes authenticated endpoints for vets and administrators.
- Full audit logging on ledger creation and payout processing.

---

## 3. Architectural & Design Trade-offs

### Option A: Real-time Stripe Transfer on Capture (Stripe Connect Transfers) vs. Option B: Payout Ledger with Batch Settlement
- **Option A (Instant Stripe Transfer)**:
  - Calls Stripe Transfers API immediately on capture.
  - Requires all veterinarians to have pre-onboarded Stripe Express/Custom accounts and incurs per-transfer fees. If a consultation is refunded or disputed, clawback is complex.
- **Option B (Payout Ledger with Batch Settlement)**:
  - Captures payment to the platform account and writes an immutable double-entry style payout ledger record (`ConsultationPayoutLedger`).
  - Supports flexible payout schedules (e.g. weekly/monthly ACH or mobile money payouts in developing markets), holds for disputed consultations, and batch transfers.
  - Decoupled from payment gateway specifics.
- **Decision**: Implement Option B. This provides an enterprise-grade financial ledger supporting both international credit card flows and local payment methods, while laying the foundation for automated batch payouts.

---

## 4. Data Models & Contracts

### Prisma Schema
```prisma
enum PayoutStatus {
  PENDING
  PROCESSING
  PAID
  HELD
  REVERSED
}

model ConsultationPayoutLedger {
  id               String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId   String       @unique @map("consultation_id") @db.Uuid
  vetId            String       @map("vet_id") @db.Uuid
  totalFeeCents    Int          @map("total_fee_cents")
  platformFeeRate  Decimal      @map("platform_fee_rate") @db.Decimal(5, 4) // e.g. 0.2000
  platformFeeCents Int          @map("platform_fee_cents") // e.g. 600
  vetPayoutCents   Int          @map("vet_payout_cents") // e.g. 2400
  currency         String       @default("USD") @db.VarChar(10)
  status           PayoutStatus @default(PENDING)
  payoutBatchId    String?      @map("payout_batch_id") @db.VarChar(100)
  payoutReference  String?      @map("payout_reference") @db.VarChar(255)
  processedAt      DateTime?    @map("processed_at") @db.Timestamptz(6)
  metadata         Json         @default("{}")
  createdAt        DateTime     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Restrict)
  vet          User         @relation("VetPayouts", fields: [vetId], references: [id], onDelete: Restrict)

  @@index([vetId, status])
  @@index([status, createdAt])
  @@index([payoutBatchId])
  @@map("consultation_payout_ledgers")
}
```

### Shared DTOs (`packages/shared-types`)
- `PayoutStatus`: Enum (`PENDING`, `PROCESSING`, `PAID`, `HELD`, `REVERSED`)
- `FeeSplitCalculationDto`:
  - `totalFeeCents: number`
  - `platformFeeRate: number`
  - `platformFeeCents: number`
  - `vetPayoutCents: number`
  - `currency: string`
- `ConsultationPayoutLedgerDto`:
  - `id: string`
  - `consultationId: string`
  - `vetId: string`
  - `totalFeeCents: number`
  - `platformFeeRate: number`
  - `platformFeeCents: number`
  - `vetPayoutCents: number`
  - `currency: string`
  - `status: PayoutStatus`
  - `payoutBatchId?: string | null`
  - `payoutReference?: string | null`
  - `processedAt?: string | null`
  - `createdAt: string`
  - `updatedAt: string`
  - `vet?: { id: string; name: string; email: string }`
  - `consultation?: { id: string; chiefComplaint: string; type: string; feeCents: number }`
- `VetEarningsSummaryDto`:
  - `vetId: string`
  - `lifetimeGrossCents: number`
  - `lifetimePlatformFeeCents: number`
  - `lifetimeVetEarningsCents: number`
  - `pendingPayoutCents: number`
  - `paidPayoutCents: number`
  - `totalSettledConsultations: number`
  - `currency: string`
- `PlatformRevenueSummaryDto`:
  - `totalGrossVolumeCents: number`
  - `totalPlatformFeesEarnedCents: number`
  - `totalVetPayoutsOwedCents: number`
  - `totalVetPayoutsPaidCents: number`
  - `totalSettledConsultations: number`
  - `currency: string`
- `ProcessPayoutDto`:
  - `payoutReference?: string`
  - `payoutBatchId?: string`
- `PayoutLedgerQueryDto`:
  - `vetId?: string`
  - `status?: PayoutStatus`
  - `startDate?: string`
  - `endDate?: string`
  - `page?: number`
  - `limit?: number`

---

## 5. Security & Edge Cases
1. **Zero-Fee / Waived Consultations**: Handled gracefully (`totalFeeCents = 0`, `platformFeeCents = 0`, `vetPayoutCents = 0`).
2. **Idempotency**: Payout ledger records are uniquely keyed by `consultationId`. If payment capture is re-evaluated, existing record is returned without duplicate ledger creation.
3. **Strict Integer Cent Math**: Prevents fractional cent discrepancies (`vetPayoutCents = totalFeeCents - platformFeeCents`).
4. **Access Control**:
   - Vets can only view their own ledger (`/consultations/settlements/vet/me` or `/consultations/settlements/vet/:vetId` matching their user ID).
   - Only `ADMIN` and `SUPER_ADMIN` can access platform revenue summaries or execute payout transitions (`POST /consultations/settlements/:id/process`).
5. **Audit Logging**: `VET_CONSULTATION_SETTLED` and `VET_PAYOUT_PROCESSED` audit log actions with actor ID and trace ID.
