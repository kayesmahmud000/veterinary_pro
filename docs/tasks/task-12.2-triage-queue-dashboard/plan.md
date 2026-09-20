# Task 12.2 Execution Plan: Triage Queue Dashboard for Triage Officers and Clinic Administrators

## Prerequisites
- [x] Task 12.1 complete and verified (`ConsultationEntity`, `ConsultationRepository`, `ConsultationService`, `ConsultationsModule`).
- [x] Shared types package built and linked (`@vetralink/shared-types`).

---

## Implementation Steps

### 1. Shared Types & Contracts (`packages/shared-types`)
- [x] Add triage contracts to `packages/shared-types/src/dto/consultations/consultation.dto.ts`:
  - `TriageQueueItemDto`
  - `TriageMetricsDto`
  - `TriageRecentHealthRecordDto`
  - `TriageRecentVaccineRecordDto`
  - `TriageCaseDetailDto`
  - `QueryTriageQueueDto`
  - `CancelTriageCaseDto`
- [x] Rebuild `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### 2. NestJS DTOs (`apps/api/src/modules/consultations/dto`)
- [x] Create `apps/api/src/modules/consultations/dto/query-triage-queue.dto.ts` with `class-validator` and Swagger decorators:
  - `page`, `limit`, `status`, `type`, `species`, `farmId`, `search`, `startDate`, `endDate`, `sortBy`, `sortOrder`.
- [x] Create `apps/api/src/modules/consultations/dto/cancel-triage-case.dto.ts`:
  - `reason` (min 5, max 500 chars).
- [x] Export new DTOs in `apps/api/src/modules/consultations/dto/index.ts`.

### 3. Repository Layer (`apps/api/src/modules/consultations/repositories`)
- [x] Update `IConsultationRepository` in `consultation.repository.interface.ts`:
  - `findTriageQueue(query: QueryTriageQueueDto): Promise<{ items: ConsultationEntity[]; total: number }>`
  - `getTriageMetrics(): Promise<TriageMetricsDto>`
  - `findTriageCaseDetail(id: string): Promise<TriageCaseDetailDto | null>`
- [x] Implement methods in `ConsultationRepository` (`consultation.repository.ts`):
  - `findTriageQueue`: multi-criteria filtering, search, pagination, and sorting.
  - `getTriageMetrics`: aggregated counts (`SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED` today, `CANCELLED` today), type breakdown, species breakdown, and wait times.
  - `findTriageCaseDetail`: full consultation details with farmer, farm, animal, recent health records, and recent vaccine records.
- [x] Add unit tests in `consultation.repository.spec.ts`.

### 4. Domain Service Layer (`apps/api/src/modules/consultations/services`)
- [x] Update `IConsultationService` in `consultation.service.interface.ts`:
  - `getTriageQueue(query: QueryTriageQueueDto): Promise<{ items: TriageQueueItemDto[]; total: number; page: number; limit: number; totalPages: number }>`
  - `getTriageMetrics(): Promise<TriageMetricsDto>`
  - `getTriageCaseDetail(id: string): Promise<TriageCaseDetailDto>`
  - `cancelTriageCase(id: string, reason: string, cancelledByUserId: string, traceId?: string): Promise<ConsultationResponseDto>`
- [x] Implement methods in `ConsultationService` (`consultation.service.ts`):
  - Invariant checks, wait time calculation, and structured audit logging on cancellation (`CONSULTATION_CANCELLED_BY_TRIAGE`).
- [x] Add unit tests in `consultation.service.spec.ts`.

### 5. Controller & Module Wiring (`apps/api/src/modules/consultations`)
- [x] Create `ConsultationTriageController` in `apps/api/src/modules/consultations/controllers/consultation-triage.controller.ts`:
  - Decorated with `@ApiTags("Tele-Veterinary - Triage")`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.
  - Route: `consultations/triage`
  - `GET /consultations/triage/queue`: returns paginated triage queue.
  - `GET /consultations/triage/metrics`: returns triage dashboard summary metrics.
  - `GET /consultations/triage/queue/:id`: returns detailed case view with animal EHR.
  - `PATCH /consultations/triage/queue/:id/cancel`: cancels consultation with audit trail.
- [x] Register `ConsultationTriageController` in `ConsultationsModule` (`consultations.module.ts`).
- [x] Create unit tests in `consultation-triage.controller.spec.ts`.

### 6. Verification & Test Execution
- [x] Run test suite: `pnpm --filter api test -- src/modules/consultations`.
- [x] Verify build: `pnpm --filter api build`.

### 7. Documentation & Human-in-the-Loop Gate
- [x] Mark checklist items complete in this `plan.md`.
- [x] Mark Task 12.2 complete in `ROADMAP.md`.
- [ ] Present completion summary, test results, and suggested conventional commit message.
- [ ] STOP and wait for human confirmation.
