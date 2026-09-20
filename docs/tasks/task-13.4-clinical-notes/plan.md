# Task 13.4 Execution Plan: Private Internal Clinical Notes (Accessible Only to Attending Veterinarians)

## 1. Prerequisites

- Phase 5 Sprint 12 and Tasks 13.1, 13.2, 13.3 completed and verified.
- `ConsultationRepository`, `AuditLogRepository`, and `PrismaService` available.

---

## 2. Implementation Steps

### Step 1: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `ClinicalNoteCategory` enum (`SOAP_NOTE`, `DIFFERENTIAL_DIAGNOSIS`, `INTERNAL_OBSERVATION`, `FOLLOW_UP_PLAN`, `GENERAL`).
  - Add `ConsultationClinicalNote` model with foreign keys to `Consultation` and `User`.
  - Add `clinicalNotes ConsultationClinicalNote[]` to `Consultation`.
  - Add `authoredClinicalNotes ConsultationClinicalNote[]` to `User`.
- [x] Create migration SQL script `20260920220000_add_consultation_clinical_notes/migration.sql`.
- [x] Regenerate Prisma Client (`pnpm --filter @vetralink/api db:generate`).

### Step 2: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Update `packages/shared-types`:
  - Add `ClinicalNoteCategory` enum to `src/enums/index.ts`.
  - Add DTOs in `src/dto/consultations/clinical-notes.dto.ts`:
    - `ClinicalNoteDto`
    - `CreateClinicalNoteDto`
    - `UpdateClinicalNoteDto`
    - `QueryClinicalNotesDto`
  - Export from `src/dto/consultations/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### Step 3: Domain Entity & Repository Layer
- [x] Create `ConsultationClinicalNoteEntity` in `apps/api/src/modules/consultations/entities/consultation-clinical-note.entity.ts`:
  - Invariant rules: title trimming, non-empty content, author validation, update mutators.
- [x] Create `IConsultationClinicalNoteRepository` interface in `apps/api/src/modules/consultations/repositories/consultation-clinical-note.repository.interface.ts`:
  - `create(entity: ConsultationClinicalNoteEntity): Promise<ConsultationClinicalNoteEntity>`
  - `findById(id: string): Promise<ConsultationClinicalNoteEntity | null>`
  - `findByConsultation(consultationId: string, category?: ClinicalNoteCategory, page?: number, limit?: number): Promise<{ items: ConsultationClinicalNoteEntity[]; total: number }>`
  - `update(entity: ConsultationClinicalNoteEntity): Promise<ConsultationClinicalNoteEntity>`
  - `delete(id: string): Promise<boolean>`
  - Token: `CONSULTATION_CLINICAL_NOTE_REPOSITORY`
- [x] Implement `ConsultationClinicalNoteRepository` in `apps/api/src/modules/consultations/repositories/consultation-clinical-note.repository.ts`.

### Step 4: Domain Service Layer
- [x] Create `IConsultationClinicalNoteService` interface in `apps/api/src/modules/consultations/services/consultation-clinical-note.service.interface.ts`:
  - `createNote(consultationId: string, author: JwtPayload, dto: CreateClinicalNoteDto, traceId?: string): Promise<ClinicalNoteDto>`
  - `getNotesByConsultation(consultationId: string, requestingUser: JwtPayload, query: QueryClinicalNotesDto): Promise<{ items: ClinicalNoteDto[]; total: number; page: number; limit: number }>`
  - `getNoteById(consultationId: string, noteId: string, requestingUser: JwtPayload): Promise<ClinicalNoteDto>`
  - `updateNote(consultationId: string, noteId: string, requestingUser: JwtPayload, dto: UpdateClinicalNoteDto, traceId?: string): Promise<ClinicalNoteDto>`
  - `deleteNote(consultationId: string, noteId: string, requestingUser: JwtPayload, traceId?: string): Promise<void>`
  - Token: `CONSULTATION_CLINICAL_NOTE_SERVICE`
- [x] Implement `ConsultationClinicalNoteService` in `apps/api/src/modules/consultations/services/consultation-clinical-note.service.ts`:
  - Strict doctor access validation (vet must be assigned vet, or admin/super_admin).
  - Explicit rejection of farmers / non-authorized users (`ForbiddenOperationException`).
  - Author-only or admin-only update and delete checks.
  - Audit logging for `CLINICAL_NOTE_CREATED`, `CLINICAL_NOTE_UPDATED`, `CLINICAL_NOTE_DELETED`.

### Step 5: REST Controller & Module Wiring
- [x] Create `ConsultationClinicalNotesController` in `apps/api/src/modules/consultations/controllers/consultation-clinical-notes.controller.ts`:
  - `GET /consultations/:id/clinical-notes`: list notes.
  - `POST /consultations/:id/clinical-notes`: create note.
  - `GET /consultations/:id/clinical-notes/:noteId`: get note by ID.
  - `PATCH /consultations/:id/clinical-notes/:noteId`: update note.
  - `DELETE /consultations/:id/clinical-notes/:noteId`: delete note.
  - Guards: `JwtAuthGuard`, `RolesGuard`.
  - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`.
  - OpenAPI Swagger documentation.
- [x] Update `ConsultationsModule` (`apps/api/src/modules/consultations/consultations.module.ts`):
  - Register `ConsultationClinicalNoteRepository` (`CONSULTATION_CLINICAL_NOTE_REPOSITORY`).
  - Register `ConsultationClinicalNoteService` (`CONSULTATION_CLINICAL_NOTE_SERVICE`).
  - Register `ConsultationClinicalNotesController`.
  - Export repository and service.

### Step 6: Unit & Integration Tests Verification
- [x] Write `consultation-clinical-note.entity.spec.ts`.
- [x] Write `consultation-clinical-note.repository.spec.ts`.
- [x] Write `consultation-clinical-note.service.spec.ts`.
- [x] Write `consultation-clinical-notes.controller.spec.ts`.
- [x] Run test suite (`pnpm test`) and build verification (`pnpm build`).

---

## 3. Verification & Acceptance Criteria

- [x] All unit test suites pass with >80% coverage.
- [x] Strict doctor confidentiality verified (farmers cannot create, list, read, update, or delete clinical notes).
- [x] Unassigned veterinarians cannot access another doctor's clinical notes.
- [x] Author or admin can update and delete notes with complete audit trails.
- [x] Full build succeeds with zero TypeScript errors.
