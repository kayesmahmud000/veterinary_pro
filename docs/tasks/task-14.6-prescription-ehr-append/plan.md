# Implementation Plan: Task 14.6 - Automatic Append of Prescription into Animal Permanent EHR Record

## Prerequisites
- Working knowledge of `PrescriptionService.signPrescription` in `apps/api/src/modules/consultations/services/prescription.service.ts`.
- Understanding of `AnimalEhrService` in `apps/api/src/modules/consultations/services/animal-ehr.service.ts`.
- Prisma client and `HealthRecord` model in `schema.prisma`.

---

## Implementation Steps (Atomic Checklist)

- [x] **Step 1: Implement EHR Record Appending in `PrescriptionService`**
  - In `PrescriptionService.signPrescription`:
    - Check if `consultation.animalId` is present.
    - Format medication details into a structured treatment string including drug names, dosages, frequencies, routes, durations, withdrawal days, instructions, and clinical notes.
    - Check for existing `HealthRecord` for this consultation/prescription to ensure idempotency.
    - Create/update `HealthRecord` in `prisma.healthRecord` with `farmId`, `animalId`, `recordedById`, `attendingVetId`, `eventType: ILLNESS`, `severity: MEDIUM`, `symptoms`, `diagnosis`, `treatment`, `cost`, `resolvedAt: null`.
    - Record audit log `PRESCRIPTION_EHR_APPENDED`.
    - Handle null/empty `animalId` gracefully for herd-level consultations.

- [x] **Step 2: Add Helper / Formatting Method**
  - Add `formatMedicationsForEhr(medications: any[], notes?: string | null, prescriptionId?: string, consultationId?: string): string` to `PrescriptionService`.

- [x] **Step 3: Verify and Ensure Integration with `AnimalEhrService`**
  - Verify that `AnimalEhrService.getConsultationEhr` and `AnimalEhrService.getAnimalEhr` seamlessly aggregate the created `HealthRecord` under `clinicalIncidents` and the signed prescription under `prescriptionHistory` and `activeWithdrawalAlerts`.

- [x] **Step 4: Unit and Integration Tests**
  - Update `prescription.service.spec.ts` with tests for:
    - Automatically creating a `HealthRecord` when `animalId` is present upon prescription signing.
    - Formatting medication treatments and notes accurately.
    - Setting cost to `feeCents / 100`.
    - Handling herd consultations (`animalId` is null) without creating an individual `HealthRecord`.
    - Emitting `PRESCRIPTION_EHR_APPENDED` audit log.
    - Idempotency when a record already exists.
  - Run all consultation and EHR tests: `pnpm --filter @vetralink/api test prescription animal-ehr`.
  - Run API build check: `pnpm --filter @vetralink/api build`.

- [x] **Step 5: Documentation & Roadmap Sign-off**
  - Mark checklist items in `plan.md` complete.
  - Mark Task 14.6 in `ROADMAP.md` complete, completing Sprint 14!
  - Present summary, test results, and suggested commit message at human-in-the-loop gate.

---

## Verification & Acceptance Criteria
- Signing a prescription for a consultation linked to an animal creates a `HealthRecord` row in PostgreSQL.
- The `HealthRecord` row contains diagnosis, treatment with drug details, attending vet, farm ID, and cost.
- Herd consultations without an animal ID sign successfully without throwing foreign key or validation errors.
- All unit and integration test suites pass with 100% success.
- Clean build of `@vetralink/api`.
