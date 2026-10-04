# Task 13.1 Execution Plan: Doctor Clinical Portal — Comprehensive Animal Electronic Health Record (EHR) View

## 1. Prerequisites

- Phase 5 Sprint 12 completed and verified.
- Database models (`Animal`, `HealthRecord`, `VaccineRecord`, `AnimalWeightLog`, `MilkLog`, `MilkYieldAnomaly`, `Consultation`, `Prescription`) available and indexed.
- `AuditLogRepository` and `PrismaService` available for injection.

---

## 2. Implementation Steps

### Step 1: Shared Types & DTO Contracts
- [x] In `packages/shared-types`:
  - Define and export all EHR DTO interfaces:
    - `EhrActiveWithdrawalAlertDto`
    - `EhrClinicalHighlightsDto`
    - `EhrAnimalSummaryDto`
    - `EhrClinicalIncidentDto`
    - `EhrPreventativeRecordDto`
    - `EhrWeightRecordDto`
    - `EhrMilkProductionSummaryDto`
    - `EhrConsultationHistoryDto`
    - `EhrPrescriptionHistoryDto`
    - `AnimalEhrResponseDto`
- [x] Build `@vetralink/shared-types`.

### Step 2: Domain Service Layer & Calculations
- [x] Create `IAnimalEhrService` interface in `apps/api/src/modules/consultations/services/animal-ehr.service.interface.ts`:
  - `getConsultationEhr(consultationId: string, requestingUser: JwtPayload, traceId?: string): Promise<AnimalEhrResponseDto>`
  - `getAnimalEhr(animalId: string, requestingUser: JwtPayload, traceId?: string): Promise<AnimalEhrResponseDto>`
- [x] Create `AnimalEhrService` in `apps/api/src/modules/consultations/services/animal-ehr.service.ts`:
  - Aggregate animal master data, sire, dam, and farm details.
  - Calculate formatted age (`X years, Y months` or `Z days`).
  - Retrieve and format clinical health records with attachments and resolution status.
  - Retrieve and format preventative vaccination/deworming records with overdue checks against `now`.
  - Retrieve and calculate weight history trajectory with deltas.
  - Retrieve milk logs, compute 7-day and 30-day averages, and load anomaly records (for dairy species).
  - Retrieve past consultation encounters for this animal.
  - Retrieve past prescriptions, parse medications, and calculate active food safety withdrawal period alerts.
  - Compute clinical highlights and KPIs (lifetime spend, active conditions, overdue care count).
  - Emit `ANIMAL_EHR_VIEWED` audit log.

### Step 3: Controller & API Routing
- [x] Create `AnimalEhrController` in `apps/api/src/modules/consultations/controllers/animal-ehr.controller.ts`:
  - `GET /consultations/:consultationId/ehr`:
    - Guards: `JwtAuthGuard`, `RolesGuard`.
    - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`, `FARMER`.
    - Returns `ApiResponse<AnimalEhrResponseDto>`.
  - `GET /consultations/animals/:animalId/ehr`:
    - Guards: `JwtAuthGuard`, `RolesGuard`.
    - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`, `FARMER`.
    - Returns `ApiResponse<AnimalEhrResponseDto>`.
  - Full OpenAPI / Swagger decorators.

### Step 4: Module Wiring
- [x] Update `ConsultationsModule` (`apps/api/src/modules/consultations/consultations.module.ts`):
  - Register `AnimalEhrService` & `{ provide: ANIMAL_EHR_SERVICE, useClass: AnimalEhrService }`.
  - Register `AnimalEhrController`.
  - Export `AnimalEhrService` and `ANIMAL_EHR_SERVICE`.

### Step 5: Unit & Integration Tests
- [x] Write `animal-ehr.service.spec.ts`:
  - Verify complete EHR aggregation for dairy and non-dairy animals.
  - Verify age calculation and weight trajectory delta computations.
  - Verify active withdrawal alert calculation for food safety compliance.
  - Verify authorization checks (attending vet, farm owner, admin).
  - Verify error handling when consultation has no animal attached.
- [x] Write `animal-ehr.controller.spec.ts`:
  - Verify routing, guards, and parameter validation pipes.
- [x] Run test suite (`pnpm test`) and build verification (`pnpm build`).

---

## 3. Verification & Acceptance Criteria

- [x] All unit tests pass with >80% coverage.
- [x] `GET /consultations/:consultationId/ehr` returns complete EHR with clinical highlights, withdrawal alerts, and timeline.
- [x] `GET /consultations/animals/:animalId/ehr` enforces tenant authorization.
- [x] Food safety withdrawal period correctly identifies active vs expired medications.
- [x] Build succeeds with zero TypeScript errors.
