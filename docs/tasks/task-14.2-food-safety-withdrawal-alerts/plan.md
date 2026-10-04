# Task 14.2 Execution Plan: Food Safety Compliance — Automated Withdrawal Period Alerts

## 1. Prerequisites

- Task 14.1 (Structured prescription editor) completed and verified.
- `PrescriptionRepository`, `ConsultationRepository`, `PrismaService`, `PUSH_NOTIFICATION_PROVIDER`, and `SMS_NOTIFICATION_PROVIDER` available.

---

## 2. Implementation Steps

### Step 1: Shared Enums & DTO Contracts (`packages/shared-types`)
- [x] Add `FoodSafetyRiskLevel` and `WithdrawalType` enums in `packages/shared-types/src/enums/index.ts`.
- [x] Create `packages/shared-types/src/dto/consultations/food-safety.dto.ts` with:
  - `MedicationWithdrawalDetailDto`
  - `FoodSafetyWithdrawalStatusDto`
  - `FarmWithdrawalAlertsDto`
  - `WithdrawalAlertDispatchResultDto`
- [x] Export from `packages/shared-types/src/dto/consultations/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Food Safety Calculation Engine
- [x] Create `FoodSafetyEngine` helper/domain utility in `apps/api/src/modules/consultations/utils/food-safety-engine.ts`:
  - `computeWithdrawalDates(medication, startDate, isDairySpecies)`
  - `evaluateRiskLevel(isMilkWithdrawn, isMeatWithdrawn)`
  - `aggregateAnimalWithdrawalStatus(animal, prescriptions, now)`

### Step 3: Food Safety Domain Service
- [x] Create `IFoodSafetyService` interface in `apps/api/src/modules/consultations/services/food-safety.service.interface.ts`:
  - `getConsultationWithdrawalStatus(consultationId: string, user: JwtPayload): Promise<FoodSafetyWithdrawalStatusDto>`
  - `getAnimalWithdrawalStatus(animalId: string, user: JwtPayload): Promise<FoodSafetyWithdrawalStatusDto>`
  - `getFarmWithdrawalAlerts(farmId: string, user: JwtPayload): Promise<FarmWithdrawalAlertsDto>`
  - `dispatchWithdrawalAlert(consultationId: string, author: JwtPayload, traceId?: string): Promise<WithdrawalAlertDispatchResultDto>`
  - Token: `FOOD_SAFETY_SERVICE`
- [x] Implement `FoodSafetyService` in `apps/api/src/modules/consultations/services/food-safety.service.ts`:
  - Multi-tenant farm membership authorization checks.
  - Multi-medication withdrawal aggregation.
  - Push, SMS, and Email notification dispatch via `PUSH_NOTIFICATION_PROVIDER`, `SMS_NOTIFICATION_PROVIDER`, and `MailService`.
  - Audit logging of `FOOD_SAFETY_ALERT_DISPATCHED`.

### Step 4: REST Controller & Module Wiring
- [x] Create `FoodSafetyController` in `apps/api/src/modules/consultations/controllers/food-safety.controller.ts`:
  - `GET /consultations/:id/food-safety-alerts`
  - `GET /consultations/animals/:animalId/food-safety-status`
  - `GET /consultations/farms/:farmId/food-safety-alerts`
  - `POST /consultations/:id/food-safety-alerts/dispatch`
- [x] Register `FoodSafetyController` and `FoodSafetyService` in `apps/api/src/modules/consultations/consultations.module.ts`.

### Step 5: Unit & Integration Tests Verification
- [x] Write unit tests for `FoodSafetyEngine`: `apps/api/src/modules/consultations/utils/food-safety-engine.spec.ts`.
- [x] Write unit tests for `FoodSafetyService`: `apps/api/src/modules/consultations/services/food-safety.service.spec.ts`.
- [x] Write unit tests for `FoodSafetyController`: `apps/api/src/modules/consultations/controllers/food-safety.controller.spec.ts`.
- [x] Run test suite (`pnpm --filter @vetralink/api test food-safety`).
- [x] Run full build (`pnpm --filter @vetralink/api build`).

---

## 3. Verification & Acceptance Criteria

- [x] Accurate calculation of `milkWithdrawalEndsAt` and `meatWithdrawalEndsAt` using `treatmentEndDate = startDate + durationDays`.
- [x] Correct risk level determination (`SAFE`, `MILK_WITHDRAWAL`, `MEAT_WITHDRAWAL`, `CRITICAL_BOTH`).
- [x] Dairy vs. non-dairy species correctly distinguished (e.g. beef cattle do not trigger milk withdrawal).
- [x] Farm-wide aggregation accurately totals animals under milk and meat withdrawal.
- [x] Multi-channel alert dispatch sends push and SMS notifications with explicit warning messages.
- [x] Full build succeeds with zero TypeScript errors.
