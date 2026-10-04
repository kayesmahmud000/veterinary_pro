# Task 12.1: Farmer Consultation Request Submission Execution Plan

## Prerequisites
- `@vetralink/shared-types` with `ConsultationType` and `ConsultationStatus` enums.
- Prisma schema with `model Consultation` and relations.
- `TenantGuard`, `SubscriptionReadOnlyGuard`, `AuditLogRepository`, and `PrismaService` functional.

---

## Implementation Steps

- [x] **Step 1: DTOs & Contracts in `@vetralink/shared-types`**
  - Define `CreateConsultationRequestDto`, `ConsultationResponseDto`, and `QueryFarmerConsultationsDto` in `packages/shared-types`.
  - Export from `packages/shared-types/src/index.ts`.
  - Build `@vetralink/shared-types`.

- [x] **Step 2: NestJS Input DTOs with Validation (`apps/api/src/modules/consultations/dto`)**
  - Create `CreateConsultationDto` with `class-validator` and Swagger decorators.
  - Create `QueryConsultationsDto` with pagination and filter validation.

- [x] **Step 3: Domain Entity (`apps/api/src/modules/consultations/entities`)**
  - Create `ConsultationEntity` encapsulating all fields, business invariants, status helpers (`isSubmitted()`, `isInProgress()`, `canBeAssigned()`, `canBeCancelled()`), and serialization.
  - Unit tests for `ConsultationEntity`.

- [x] **Step 4: Repository Layer (`apps/api/src/modules/consultations/repositories`)**
  - Define `IConsultationRepository` interface with symbol token `CONSULTATION_REPOSITORY`.
  - Implement `ConsultationRepository` using `PrismaService`:
    - `findById(id: string, farmId?: string): Promise<ConsultationEntity | null>`.
    - `create(entity: ConsultationEntity, tx?: Prisma.TransactionClient): Promise<ConsultationEntity>`.
    - `save(entity: ConsultationEntity, tx?: Prisma.TransactionClient): Promise<ConsultationEntity>`.
    - `findByFarm(farmId: string, query?: QueryFarmerConsultationsDto): Promise<{ items: ConsultationEntity[]; total: number }>`.
    - `findByFarmer(farmerId: string, query?: QueryFarmerConsultationsDto): Promise<{ items: ConsultationEntity[]; total: number }>`.
  - Unit tests for `ConsultationRepository`.

- [x] **Step 5: Domain Service Layer (`apps/api/src/modules/consultations/services`)**
  - Define `IConsultationService` interface with symbol token `CONSULTATION_SERVICE`.
  - Implement `ConsultationService`:
    - `createConsultation(farmerId: string, dto: CreateConsultationRequestDto, traceId?: string): Promise<ConsultationResponseDto>`.
      - Verifies farm tenant membership.
      - Verifies animal tenant isolation if `animalId` provided (via `IAnimalRepository` or direct check).
      - Persists entity and records audit log `CONSULTATION_REQUEST_SUBMITTED`.
    - `getConsultationById(id: string, farmId: string, userId: string): Promise<ConsultationResponseDto>`.
    - `getFarmerConsultations(farmerId: string, farmId: string, query: QueryFarmerConsultationsDto): Promise<{ items: ConsultationResponseDto[]; total: number }>`.
  - Unit tests for `ConsultationService`.

- [x] **Step 6: Controller & Module Wiring (`apps/api/src/modules/consultations`)**
  - Create `ConsultationController` with routes:
    - `POST /api/v1/consultations`
    - `GET /api/v1/consultations`
    - `GET /api/v1/consultations/:id`
    - Decorated with `JwtAuthGuard`, `TenantGuard`, `SubscriptionReadOnlyGuard`.
  - Create `ConsultationsModule` and register in `AppModule`.
  - Export module in `apps/api/src/modules/consultations/index.ts`.
  - Unit tests for `ConsultationController`.

- [x] **Step 7: Verification & Test Suite Execution**
  - Run test suite (`pnpm --filter api test -- src/modules/consultations`).
  - Run full build check (`pnpm --filter api build`).
  - Check off `[x]` items in `plan.md` and update `ROADMAP.md`.

---

## Verification & Acceptance Criteria
1. **Submission Validation**:
   - Submitting with invalid `farmId` or missing `chiefComplaint` (<10 chars) rejects with 400 ValidationDomainException.
   - Non-existent animal or animal from a different farm rejects with 404 / 403.
   - Request is created with status `SUBMITTED`.
2. **Tenant Scoping & Security**:
   - Access to consultation endpoints requires active JWT authentication and tenant membership in the target farm.
   - Non-members of the farm are denied with 403 Forbidden.
3. **Audit Trail**:
   - Every submitted consultation emits an audit log record with action `CONSULTATION_REQUEST_SUBMITTED`.
