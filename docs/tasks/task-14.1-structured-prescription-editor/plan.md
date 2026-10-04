# Task 14.1 Execution Plan: Structured Prescription Editor

## 1. Prerequisites

- Phase 5 Sprint 12 and Sprint 13 completed and verified.
- `ConsultationRepository`, `AuditLogRepository`, and `PrismaService` available.

---

## 2. Implementation Steps

### Step 1: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `PrescriptionStatus` enum (`DRAFT`, `SIGNED`, `REVOKED`).
  - Add `MedicationFormulation` enum (`INJECTABLE`, `ORAL_SUSPENSION`, `BOLUS_TABLET`, `TOPICAL_SPRAY`, `INTRAMAMMARY`, `POWDER`, `EYE_DROPS`, `OTHER`).
  - Add `MedicationRoute` enum (`INTRAMUSCULAR`, `SUBCUTANEOUS`, `INTRAVENOUS`, `ORAL`, `TOPICAL`, `INTRAMAMMARY`, `OTHER`).
  - Update `Prescription` model:
    - Add `status: PrescriptionStatus @default(DRAFT)`.
    - Add `notes: String? @db.Text`.
    - Make `pdfS3Key`, `digitalSignatureHash`, and `signedAt` nullable (`String?`, `DateTime?`).
    - Add `updatedAt: DateTime @default(now()) @updatedAt`.
    - Add index on `[status]`.
- [x] Create migration SQL script `20260920230000_enhance_prescriptions/migration.sql`.
- [x] Regenerate Prisma Client (`pnpm --filter @vetralink/api db:generate`).
- [x] Verify `animal-ehr.service.ts` compiles cleanly with nullable `signedAt`/`pdfS3Key`.

### Step 2: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Update `packages/shared-types`:
  - Add enums in `src/enums/index.ts`:
    - `PrescriptionStatus`
    - `MedicationFormulation`
    - `MedicationRoute`
  - Add DTOs in `src/dto/consultations/prescription.dto.ts`:
    - `StructuredMedicationItemDto`
    - `PrescriptionDto`
    - `CreatePrescriptionDto`
    - `UpdatePrescriptionDto`
  - Export from `src/dto/consultations/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### Step 3: Domain Entity & Repository Layer
- [x] Create `PrescriptionEntity` in `apps/api/src/modules/consultations/entities/prescription.entity.ts`:
  - Invariant rules: validate non-empty diagnosis, validate at least one medication, validate medication items (dosage, frequency, durationDays >= 1, non-negative withdrawal days), prevent updating signed prescriptions.
- [x] Create `IPrescriptionRepository` interface in `apps/api/src/modules/consultations/repositories/prescription.repository.interface.ts`:
  - `create(entity: PrescriptionEntity): Promise<PrescriptionEntity>`
  - `findById(id: string): Promise<PrescriptionEntity | null>`
  - `findByConsultationId(consultationId: string): Promise<PrescriptionEntity | null>`
  - `save(entity: PrescriptionEntity): Promise<PrescriptionEntity>`
  - Token: `PRESCRIPTION_REPOSITORY`
- [x] Implement `PrescriptionRepository` in `apps/api/src/modules/consultations/repositories/prescription.repository.ts`.

### Step 4: Domain Service Layer
- [x] Create `IPrescriptionService` interface in `apps/api/src/modules/consultations/services/prescription.service.interface.ts`:
  - `createPrescription(consultationId: string, author: JwtPayload, dto: CreatePrescriptionDto, traceId?: string): Promise<PrescriptionDto>`
  - `getPrescription(consultationId: string, requestingUser: JwtPayload): Promise<PrescriptionDto | null>`
  - `updatePrescription(consultationId: string, author: JwtPayload, dto: UpdatePrescriptionDto, traceId?: string): Promise<PrescriptionDto>`
  - Token: `PRESCRIPTION_SERVICE`
- [x] Implement `PrescriptionService` in `apps/api/src/modules/consultations/services/prescription.service.ts`:
  - Access validation: attending vet or admin can draft and edit; farmers can only view signed prescriptions.
  - Immutability check: cannot edit signed prescriptions.
  - Audit logging for `PRESCRIPTION_DRAFTED` and `PRESCRIPTION_UPDATED`.

### Step 5: REST Controller & Module Wiring
- [x] Create `PrescriptionsController` in `apps/api/src/modules/consultations/controllers/prescriptions.controller.ts`:
  - `POST /consultations/:id/prescription`: create/draft prescription.
  - `GET /consultations/:id/prescription`: get prescription for consultation.
  - `PATCH /consultations/:id/prescription`: update draft prescription.
  - Guards: `JwtAuthGuard`, `RolesGuard`.
  - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`, `FARMER`.
  - OpenAPI Swagger documentation.
- [x] Update `ConsultationsModule` (`apps/api/src/modules/consultations/consultations.module.ts`):
  - Register `PrescriptionRepository` (`PRESCRIPTION_REPOSITORY`).
  - Register `PrescriptionService` (`PRESCRIPTION_SERVICE`).
  - Register `PrescriptionsController`.
  - Export repository and service.

### Step 6: Unit & Integration Tests Verification
- [x] Write `prescription.entity.spec.ts`.
- [x] Write `prescription.repository.spec.ts`.
- [x] Write `prescription.service.spec.ts`.
- [x] Write `prescriptions.controller.spec.ts`.
- [x] Run test suite (`pnpm test`) and build verification (`pnpm build`).

---

## 3. Verification & Acceptance Criteria

- [x] All unit test suites pass with >80% coverage.
- [x] Structured medication schema validates formulation, route, dosage, frequency, duration, and withdrawal days.
- [x] Farmers cannot see draft prescriptions; only signed ones.
- [x] Attending veterinarians can create and edit draft prescriptions.
- [x] Signed prescriptions are immutable to further edits.
- [x] Full build succeeds with zero TypeScript errors.
