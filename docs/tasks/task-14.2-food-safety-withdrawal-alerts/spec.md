# Task 14.2 Specification: Food Safety Compliance — Automated Withdrawal Period Alerts

## 1. Feature Overview & Objective

In veterinary medicine and livestock farming, administering pharmacologically active substances (e.g., beta-lactam antibiotics, sulfonamides, anthelmintics, NSAIDs) leaves chemical residues in animal tissues and milk. Regulatory bodies (such as FDA CVM, EFSA, Codex Alimentarius) establish Maximum Residue Limits (MRLs) and mandatory **Withdrawal Periods**:
1. **Milk Withdrawal Period**: The minimum required interval between the administration of the final dose of a veterinary drug and the collection of milk from that animal for human consumption.
2. **Meat/Slaughter Withdrawal Period**: The minimum required interval between the final dose and the slaughter of the animal for meat.

Accidental contamination of bulk milk tanks or marketing animals prior to withdrawal clearance causes severe public health risks (antibiotic resistance, allergic reactions), regulatory shutdowns, and financial penalties for farms.

**Objective of Task 14.2**:
Implement an automated Food Safety compliance engine that:
1. Computes precise milk and meat withdrawal periods based on structured prescription items (including treatment duration and drug-specific withdrawal days).
2. Provides animal-level, consultation-level, and farm-wide food safety withdrawal queries.
3. Automatically evaluates the food safety risk level (`SAFE`, `MILK_ONLY`, `MEAT_ONLY`, `CRITICAL_BOTH`).
4. Generates automated food safety alert notifications (push/SMS/email) to farm managers and farmers upon prescription signing or on demand.

---

## 2. Current State vs. Proposed State

### Current State
- `PrescriptionEntity` (Task 14.1) validates non-negative `withdrawalDaysMilk`, `withdrawalDaysMeat`, and calculates `withdrawalDays`.
- `AnimalEhrService` has basic logic that calculates active withdrawal alerts for an animal based on `rx.signedAt + rx.withdrawalDays * 86400000`.
- Missing capabilities:
  - No distinction between milk and meat withdrawal countdowns in alerts (it lumped them together).
  - Treatment duration (`durationDays`) was not factored into the last dose calculation (`treatmentEnd = startDate + durationDays`).
  - No farm-wide query endpoint for herd managers to see all animals currently under withdrawal.
  - No automated alert dispatch to warn farmers of milk discard or slaughter prohibition.
  - No dedicated `FoodSafetyService` or API endpoints for food safety compliance inspection.

### Proposed State
- **Withdrawal Period Calculation Formula**:
  - `treatmentStartDate`: Date of first administration (defaults to `signedAt ?? createdAt`).
  - `treatmentEndDate`: `treatmentStartDate + durationDays` (date of final administered dose).
  - `milkWithdrawalEndsAt`: `treatmentEndDate + withdrawalDaysMilk`.
  - `meatWithdrawalEndsAt`: `treatmentEndDate + withdrawalDaysMeat`.
  - An animal is under **Milk Withdrawal** if `now < milkWithdrawalEndsAt`.
  - An animal is under **Meat Withdrawal** if `now < meatWithdrawalEndsAt`.
- **Food Safety Risk Level**:
  - `SAFE`: Zero active restrictions.
  - `MILK_WITHDRAWAL`: Milk discard required; meat is safe.
  - `MEAT_WITHDRAWAL`: Slaughter prohibited; milk is safe.
  - `CRITICAL_BOTH`: Both milk discard and slaughter prohibition active.
- **Dedicated Service & Endpoints**:
  - `FoodSafetyService` (`IFoodSafetyService`, token `FOOD_SAFETY_SERVICE`).
  - `GET /consultations/:id/food-safety-alerts`: Get withdrawal status for a consultation's prescription.
  - `GET /consultations/animals/:animalId/food-safety-status`: Get animal's active withdrawal status and history.
  - `GET /consultations/farms/:farmId/food-safety-alerts`: Get all active withdrawal alerts across an entire farm (bulk tank milk & slaughter safety).
  - `POST /consultations/:id/food-safety-alerts/dispatch`: Dispatch automated food safety warnings via push/SMS to the farmer.

---

## 3. Architectural & Design Trade-offs

| Option | Description | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Embed inside `AnimalEhrService`** | Add more methods to `AnimalEhrService` | Keeps all EHR logic together | Violates Single Responsibility; bloats `AnimalEhrService`; hard to test independently | **Rejected** |
| **Option B: Dedicated `FoodSafetyService`** | Standalone domain service implementing `IFoodSafetyService` with specialized controller | Clean architecture, adheres to SRP, modular, easily tested, provides clean endpoints for farm-wide compliance audits | Requires registering new service & controller | **Accepted** |

### Justification:
Food Safety compliance is a major regulatory concern for dairy and meat farms. A dedicated `FoodSafetyService` allows isolated business logic, clean audit trails, and multi-channel alerting without coupling to general EHR view formatting.

---

## 4. Data Models & Contracts

### 4.1 Enums (`packages/shared-types/src/enums/index.ts`)
```typescript
export enum FoodSafetyRiskLevel {
  SAFE = "SAFE",
  MILK_WITHDRAWAL = "MILK_WITHDRAWAL",
  MEAT_WITHDRAWAL = "MEAT_WITHDRAWAL",
  CRITICAL_BOTH = "CRITICAL_BOTH",
}

export enum WithdrawalType {
  MILK = "MILK",
  MEAT = "MEAT",
  BOTH = "BOTH",
}
```

### 4.2 Shared DTOs (`packages/shared-types/src/dto/consultations/food-safety.dto.ts`)
```typescript
export interface MedicationWithdrawalDetailDto {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: MedicationRoute;
  treatmentStartDate: string;
  treatmentEndDate: string;
  withdrawalDaysMilk: number;
  withdrawalDaysMeat: number;
  milkWithdrawalEndsAt: string | null;
  meatWithdrawalEndsAt: string | null;
  isMilkActive: boolean;
  isMeatActive: boolean;
  milkDaysRemaining: number;
  meatDaysRemaining: number;
  instructions?: string;
}

export interface FoodSafetyWithdrawalStatusDto {
  animalId: string;
  animalTag: string;
  animalName?: string;
  species: AnimalSpecies;
  farmId: string;
  consultationId?: string;
  prescriptionId?: string;
  riskLevel: FoodSafetyRiskLevel;
  isMilkWithdrawn: boolean;
  isMeatWithdrawn: boolean;
  milkWithdrawalEndsAt: string | null;
  meatWithdrawalEndsAt: string | null;
  milkDaysRemaining: number;
  meatDaysRemaining: number;
  activeMedications: MedicationWithdrawalDetailDto[];
  warningMessage?: string;
}

export interface FarmWithdrawalAlertsDto {
  farmId: string;
  totalAnimalsUnderWithdrawal: number;
  animalsWithMilkWithdrawal: number;
  animalsWithMeatWithdrawal: number;
  alerts: FoodSafetyWithdrawalStatusDto[];
}

export interface WithdrawalAlertDispatchResultDto {
  consultationId: string;
  animalId: string;
  farmerId: string;
  riskLevel: FoodSafetyRiskLevel;
  notificationsSent: {
    push: boolean;
    sms: boolean;
    email: boolean;
  };
  dispatchedAt: string;
}
```

---

## 5. Security & Edge Cases

1. **Non-Dairy Animals**: For beef cattle, poultry, or non-lactating species, `withdrawalDaysMilk` is irrelevant. The engine ignores milk withdrawal if the species is not dairy-capable, setting `isMilkWithdrawn = false`.
2. **Multiple Prescriptions**: An animal might have multiple active prescriptions from different consultations. The engine aggregates all active prescriptions for the animal and computes the outer maximum end dates for milk and meat.
3. **Multi-Tenant Authorization**:
   - Attending veterinarians and admins can view any consultation/animal food safety status.
   - Farmers can only view animals/consultations belonging to their assigned farms.
4. **Zero or Missing Withdrawal Days**: If a medication has 0 withdrawal days (e.g., standard saline or non-restricted vitamins), it does not trigger a food safety alert.
5. **Timezone & Granularity**: All calculations operate on UTC timestamps; remaining days are rounded up (`Math.ceil`) to ensure an abundance of caution for food safety (e.g., 2.1 days remaining is reported as 3 days remaining).
