# Task 12.1: Farmer Consultation Request Submission Specification

## 1. Feature Overview & Objective
Phase 5 introduces the Tele-Veterinary Telehealth & EHR Platform for VetraLink Pro. The entry point of this clinical workflow is **Farmer Consultation Request Submission** (Task 12.1).

Farmers encounter acute health issues, injuries, or herd health concerns and need an asynchronous ticket or live video consultation with a licensed veterinarian. This feature allows authenticated farm owners and herdsmen to submit a structured clinical consultation request containing:
- Specific tenant `farmId` and optional `animalId` (if targeting a specific animal registered in the ERP).
- `chiefComplaint`: Detailed description of the clinical signs, onset, duration, and behavior.
- `mediaUrls`: Optional uploaded photos or videos of lesions, symptoms, posture, or discharge.
- `type`: `ASYNC_TICKET` (standard asynchronous diagnosis/prescription) or `LIVE_VIDEO` (scheduled real-time video consult).
- Initial status: `SUBMITTED`.

---

## 2. Current State vs. Proposed State

### Current State
- Database schema in `schema.prisma` already defines the `Consultation` model with foreign keys to `farmer` (`User`), `vet` (`User`), `farm` (`Farm`), and `animal` (`Animal`), along with enums `ConsultationType` (`ASYNC_TICKET`, `LIVE_VIDEO`) and `ConsultationStatus` (`SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- Enums are defined in `packages/shared-types`.
- There is no NestJS `ConsultationsModule`, domain entity, repository, service, or controller for handling tele-vet consultation requests.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - `CreateConsultationRequestDto`: Client payload to initiate a consultation.
  - `ConsultationResponseDto`: Serialized consultation entity with relations (animal, farmer, vet).
  - `QueryFarmerConsultationsDto`: Pagination and filtering for consultation lists.
- **Domain Entity (`ConsultationEntity`)**:
  - Encapsulates domain invariants, status checks (`isSubmitted()`, `isInProgress()`, `canBeAssigned()`, `canBeCancelled()`), and state mutations.
- **Repository (`ConsultationRepository`)**:
  - Encapsulates database access using Prisma, with tenant scoping (`farmId`) and relations (`farmer`, `vet`, `animal`, `farm`).
- **Domain Service (`ConsultationService`)**:
  - Validates farm tenant membership via `TenantGuard`.
  - Validates animal existence within the tenant farm (preventing cross-tenant animal association).
  - Persists consultation with initial status `SUBMITTED`.
  - Records an audit log (`CONSULTATION_REQUEST_SUBMITTED`).
- **Controller (`ConsultationController`)**:
  - `POST /api/v1/consultations`: Create a consultation request.
  - `GET /api/v1/consultations`: List consultations for the current farm.
  - `GET /api/v1/consultations/:id`: Retrieve single consultation details.
  - Protected with `JwtAuthGuard`, `TenantGuard`, `SubscriptionReadOnlyGuard`.

---

## 3. Architectural & Design Trade-offs

### Option A: Store Consultation Requests directly inside Clinical Health module (`clinical-health`)
- *Pros*: Keeps animal health records in one module.
- *Cons*: Violates Single Responsibility and Clean Architecture. Tele-vet consultation involves triage, vet assignment, video room provisioning, doctor billing splits, and digitally signed prescriptions, which is a distinct bounded context from routine farm health logging (vaccinations/deworming).

### Option B: Dedicated `ConsultationsModule` (Selected Approach)
- *Pros*:
  - Matches the system architecture outlined in `ARCHITECTURE.md` (Section 3: `modules/consultations`).
  - Decouples tele-health workflow (triage, scheduling, video, prescriptions) from local farm ERP recording.
  - Allows clean scaling, specialized access control (VET role vs FARMER role), and independent unit testing.
- *Technical Justification*: Clean domain separation between on-farm routine medical logs (`clinical-health`) and remote doctor consultations (`consultations`).

---

## 4. Data Models & API Contracts

### Data Contracts (`@vetralink/shared-types`)

```typescript
export interface CreateConsultationRequestDto {
  farmId: string;
  animalId?: string;
  chiefComplaint: string;
  mediaUrls?: string[];
  type?: ConsultationType; // Defaults to ASYNC_TICKET
}

export interface ConsultationResponseDto {
  id: string;
  farmerId: string;
  vetId: string | null;
  farmId: string;
  animalId: string | null;
  chiefComplaint: string;
  mediaUrls: string[];
  type: ConsultationType;
  status: ConsultationStatus;
  roomSessionId: string | null;
  feeCents: number;
  createdAt: string;
  updatedAt: string;
  farmer?: { id: string; name: string; email: string } | null;
  vet?: { id: string; name: string; email: string } | null;
  animal?: { id: string; name: string; tagNumber: string; species: string } | null;
  farm?: { id: string; name: string } | null;
}

export interface QueryFarmerConsultationsDto {
  page?: number;
  limit?: number;
  status?: ConsultationStatus;
  animalId?: string;
  type?: ConsultationType;
}
```

---

## 5. Security & Edge Cases
- **Multi-Tenant Scoping**: All queries must enforce `farmId` matching the tenant context.
- **Cross-Tenant Animal Injection**: If `animalId` is supplied, the service must verify that `animal.farmId === request.farmId` and `animal.deletedAt === null`.
- **Subscription Access Restriction**: If the farm subscription is in `READ_ONLY` or `SUSPENDED` mode, mutating endpoint `POST /api/v1/consultations` is blocked via `SubscriptionReadOnlyGuard`.
- **Input Validation**:
  - `chiefComplaint`: Must be at least 10 characters and max 5,000 characters.
  - `mediaUrls`: Optional array of valid URL strings (max 10 attachments).
