# Task 12.3 Execution Plan: Vet Assignment and Scheduling Algorithm Based on Availability and Specialty

## Prerequisites
- [x] Task 12.1 and Task 12.2 completed and verified.
- [x] Shared types package built and linked.

---

## Implementation Steps

### 1. Shared Types & Contracts (`packages/shared-types`)
- [x] Add vet profile and scheduling contracts to `packages/shared-types/src/dto/consultations/consultation.dto.ts`:
  - `VetWorkingHoursDto`
  - `VetProfileDto`
  - `UpdateVetProfileDto`
  - `VetCandidateScoreBreakdownDto`
  - `VetCandidateDto`
  - `AssignConsultationDto`
  - `AutoAssignConsultationDto`
  - `VetAvailabilitySummaryDto`
- [x] Rebuild `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### 2. Database Schema (`apps/api/prisma/schema.prisma`)
- [x] Add `VetProfile` model with 1-to-1 relation to `User`.
- [x] Add `scheduledAt` and `assignedAt` fields to `Consultation`.
- [x] Run `pnpm --filter api db:generate` to regenerate Prisma Client.

### 3. NestJS DTOs (`apps/api/src/modules/consultations/dto`)
- [x] Create `assign-consultation.dto.ts` with `class-validator` rules (`vetId`, `scheduledAt`, `notes`).
- [x] Create `auto-assign-consultation.dto.ts` (`scheduledAt`).
- [x] Create `update-vet-profile.dto.ts` (`specialties`, `isAvailable`, `maxActiveCases`, `workingHours`, `timezone`).
- [x] Export new DTOs in `apps/api/src/modules/consultations/dto/index.ts`.

### 4. Domain Entities (`apps/api/src/modules/consultations/entities`)
- [x] Create `VetProfileEntity` in `vet-profile.entity.ts`:
  - Working hours validation, capacity validation, specialty checking, and slot conflict checking.
- [x] Update `ConsultationEntity` to manage `scheduledAt`, `assignedAt`, and updated `assignToVet()`.
- [x] Add unit tests in `vet-profile.entity.spec.ts` and update `consultation.entity.spec.ts`.

### 5. Repository Layer (`apps/api/src/modules/consultations/repositories`)
- [x] Create `IVetProfileRepository` and `VetProfileRepository`:
  - `findByUserId(userId: string)`
  - `save(entity: VetProfileEntity)`
  - `findAllVetsWithProfiles()`
- [x] Update `IConsultationRepository` and `ConsultationRepository`:
  - `countActiveConsultationsByVet(vetId: string)`
  - `findConflictingConsultations(vetId: string, scheduledAt: Date, durationMinutes?: number)`
- [x] Add unit tests in `vet-profile.repository.spec.ts` and update `consultation.repository.spec.ts`.

### 6. Domain Service Layer (`apps/api/src/modules/consultations/services`)
- [x] Create `IVetAssignmentService` and `VetAssignmentService`:
  - Multi-criteria matching algorithm computing `specialtyScore` (0-50), `workloadScore` (0-30), `availabilityScore` (0-20).
  - `getRankedCandidates(consultationId: string)`
  - `assignToVet(consultationId: string, dto: AssignConsultationDto, assignedByUserId: string, traceId?: string)`
  - `autoAssign(consultationId: string, dto: AutoAssignConsultationDto, assignedByUserId: string, traceId?: string)`
  - `getVetAvailabilityList()`
  - `getVetProfile(vetId: string)`
  - `updateVetProfile(vetId: string, dto: UpdateVetProfileDto, requestingUserId: string, requestingRole: UserRole, traceId?: string)`
- [x] Add unit tests in `vet-assignment.service.spec.ts`.

### 7. Controller & Module Wiring (`apps/api/src/modules/consultations`)
- [x] Add assignment and scheduling endpoints to `ConsultationTriageController`:
  - `GET /consultations/triage/queue/:id/candidates`: ranked candidate recommendations.
  - `POST /consultations/triage/queue/:id/assign`: manual assignment.
  - `POST /consultations/triage/queue/:id/auto-assign`: automated smart assignment.
- [x] Create `VetAvailabilityController` at `consultations/vets`:
  - `GET /consultations/vets/availability`: clinic availability overview.
  - `GET /consultations/vets/:id/availability`: single vet profile.
  - `PUT /consultations/vets/:id/availability`: update vet profile.
- [x] Register new controllers and providers in `ConsultationsModule`.
- [x] Add unit tests in `consultation-triage.controller.spec.ts` and `vet-availability.controller.spec.ts`.

### 8. Verification & Test Execution
- [x] Run test suite: `pnpm --filter api test -- src/modules/consultations`.
- [x] Verify build: `pnpm --filter api build`.

### 9. Documentation & Human-in-the-Loop Gate
- [x] Mark checklist items complete in this `plan.md`.
- [x] Mark Task 12.3 complete in `ROADMAP.md`.
- [ ] Present completion summary, test results, and suggested conventional commit message.
- [ ] STOP and wait for human confirmation.
