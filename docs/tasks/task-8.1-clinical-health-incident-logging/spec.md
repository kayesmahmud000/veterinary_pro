# SPEC-801: Clinical Health Incident Logging (Symptoms, Diagnosis, Treatments, Costs)

## 1. Feature Overview & Objective
Livestock health management is critical to animal welfare, farm productivity, biosecurity, and economic survival. In dairy, beef, and mixed livestock farming, timely documentation of clinical symptoms, veterinary diagnoses, drug treatments, and associated costs is required to:
1. Prevent disease progression and herd contagion through early intervention and clinical tracking.
2. Establish a complete, tamper-evident Electronic Health Record (EHR) for each individual animal throughout its lifecycle.
3. Quantify clinical care and treatment costs, directly feeding the enterprise financial ledger and profit & loss (P&L) calculations.
4. Support veterinary triage and tele-health consultations by providing attending veterinarians with real-time access to past medical history.
5. Fulfill food safety and regulatory requirements regarding drug withdrawal intervals and animal disease reporting.

**Objective**:
Implement an enterprise-grade, multi-tenant Clinical Health Incident Logging engine in VETRALINK PRO that enables farm personnel and attending veterinarians to record, track, update, resolve, and audit clinical incidents (`ILLNESS`, `INJURY`, `SURGERY`, `ROUTINE_CHECK`, `BREEDING_EXAM`) with severity grading, treatment plans, cost accounting, optimistic concurrency, and strict multi-tenant data isolation.

---

## 2. Current State vs. Proposed State

### Current State
- `apps/api/prisma/schema.prisma` defines the `HealthRecord` model, `HealthEventType` enum (`ILLNESS`, `INJURY`, `SURGERY`, `ROUTINE_CHECK`, `BREEDING_EXAM`), and `SeverityLevel` enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `packages/shared-types` exports `HealthEventType` and `SeverityLevel` enums, but no DTOs, query contracts, or serialized response types for clinical health events.
- `apps/api/src/modules/health/` currently houses Terminus infrastructure probes (`/api/v1/health`), but no domain module exists for veterinary clinical health.
- No repository, domain service, or REST API endpoints exist for logging or managing clinical health records.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - `CreateHealthIncidentRequestDto`: DTO for recording a new health event.
  - `UpdateHealthIncidentRequestDto`: DTO for updating diagnosis, treatment, symptoms, severity, and vet assignment.
  - `ResolveHealthIncidentRequestDto`: DTO for concluding an event with resolution notes, final cost, and resolution date.
  - `HealthIncidentQueryDto`: Filtering and pagination contracts (animalId, eventType, severity, resolution status, date range).
  - `HealthIncidentResponseDto` & `PaginatedHealthIncidentsDto`: Type-safe serialized response envelopes with animal and veterinarian metadata.
- **Database Layer**:
  - Add composite indexes on `health_records` (`[farmId, animalId, createdAt]`, `[farmId, severity, resolvedAt]`, `[farmId, eventType, createdAt]`) to support low-latency multi-tenant filtering and reporting.
- **Backend Architecture (`apps/api/src/modules/clinical-health/`)**:
  - Following Clean Architecture: `Controller -> Service -> Domain -> Repository`.
  - `HealthRecordEntity`: Pure domain entity with business invariants (cost >= 0, valid severity and event types, non-empty symptoms, resolution timestamp validation).
  - `IHealthRecordRepository` & `HealthRecordRepository`: Clean abstraction wrapping Prisma, returning domain entities.
  - `IClinicalHealthService` & `ClinicalHealthService`: Orchestrates tenant validation, animal verification, vet verification, audit log emission, and ACID transactions.
  - `ClinicalHealthController`: Protected REST endpoints under `/api/v1/clinical-health/incidents` guarded with `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.
  - Comprehensive unit test suite with 100% logic coverage across entities, repositories, service, and controller.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Standalone Resolution Endpoint vs. Generic PATCH Update
- **Option A (Generic PATCH Only)**:
  - Allow updating `resolvedAt` as an optional field in `PATCH /api/v1/clinical-health/incidents/:id`.
  - *Cons*: Weak semantics. Farmers and vets often perform a distinct clinical "discharge / case closed" action that needs to record the resolution timestamp, final treatment outcome, and total costs simultaneously.
- **Option B (Dedicated Resolution Sub-resource / Action Endpoint - SELECTED)**:
  - Expose `PATCH /api/v1/clinical-health/incidents/:id/resolve` alongside standard `PATCH`.
  - *Pros*: Explicit domain event modeling. Ensures `resolvedAt` defaults to `now()` if omitted, validates that an incident cannot be resolved before its incident date, and emits a dedicated `RESOLVE` action in the audit log for clinical auditability.
  - *Justification*: Clean DDD pattern separating general case edits from clinical discharge/resolution milestones.

### Trade-off 2: Module Naming (`health` vs. `clinical-health`)
- **Option A (Rename existing `modules/health/` or overload it)**:
  - Merge veterinary health events into `apps/api/src/modules/health/`.
  - *Cons*: Clashes with NestJS Terminus infrastructure health probes (`@nestjs/terminus`, `HealthCheckService`, `HealthController`), violating Single Responsibility Principle and confusing DevOps ingress monitoring with business domain logic.
- **Option B (Dedicated `modules/clinical-health/` - SELECTED)**:
  - Retain `modules/health/` strictly for Terminus system liveness/readiness probes, and introduce `modules/clinical-health/` for animal EHR and clinical event tracking.
  - *Pros*: Clear separation of concerns, zero route or class name collisions (`/api/v1/health` vs. `/api/v1/clinical-health/incidents`).
  - *Justification*: Standard enterprise practice for separating infrastructure monitoring from core business domain services.

### Trade-off 3: Decimal vs. Integer Currency for Medical Costs
- **Option A (Integer Cents)**:
  - Store veterinary costs in cents.
  - *Cons*: Incompatible with existing Prisma schema (`Decimal(10,2)`), requiring manual conversions across ERP ledger modules.
- **Option B (Prisma Decimal(10, 2) mapped to Number in DTOs - SELECTED)**:
  - Keep `Decimal(10, 2)` matching the database schema and financial transaction ledger, serializing to standard decimal numbers with two decimal places in API responses.
  - *Pros*: Consistent with schema and financial reporting requirements.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Definition
```prisma
model HealthRecord {
  id             String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId         String          @map("farm_id") @db.Uuid
  animalId       String          @map("animal_id") @db.Uuid
  recordedById   String          @map("recorded_by_id") @db.Uuid
  attendingVetId String?         @map("attending_vet_id") @db.Uuid
  eventType      HealthEventType @map("event_type")
  severity       SeverityLevel   @default(LOW)
  symptoms       String          @db.Text
  diagnosis      String?         @db.Text
  treatment      String?         @db.Text
  cost           Decimal         @default(0) @db.Decimal(10, 2)
  resolvedAt     DateTime?       @map("resolved_at") @db.Timestamptz(6)
  syncVersion    Int             @default(1) @map("sync_version")
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm         Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)
  animal       Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  recordedBy   User   @relation("RecordedBy", fields: [recordedById], references: [id], onDelete: Restrict)
  attendingVet User?  @relation("AttendingVet", fields: [attendingVetId], references: [id], onDelete: SetNull)

  @@index([farmId, createdAt])
  @@index([farmId, updatedAt])
  @@index([farmId, animalId, createdAt])
  @@index([farmId, severity, resolvedAt])
  @@index([farmId, eventType, createdAt])
  @@index([animalId, eventType])
  @@map("health_records")
}
```

### 4.2 API Contracts (Packages: `@vetralink/shared-types`)
- **`CreateHealthIncidentRequestDto`**:
  - `animalId`: string (UUID, required)
  - `eventType`: `HealthEventType` (required)
  - `severity`: `SeverityLevel` (optional, default `LOW`)
  - `symptoms`: string (min 3 chars, required)
  - `diagnosis`: string (optional)
  - `treatment`: string (optional)
  - `cost`: number (optional, min 0, default 0)
  - `attendingVetId`: string (UUID, optional)
  - `resolvedAt`: string (ISO 8601, optional)
- **`UpdateHealthIncidentRequestDto`**:
  - Partial fields of `CreateHealthIncidentRequestDto` plus optional `syncVersion` for concurrency control.
- **`ResolveHealthIncidentRequestDto`**:
  - `resolvedAt`: string (ISO 8601, optional, defaults to now)
  - `treatment`: string (optional, appends/updates final treatment)
  - `diagnosis`: string (optional, updates final clinical diagnosis)
  - `cost`: number (optional, final cost update)
- **`HealthIncidentResponseDto`**:
  - Comprehensive response containing id, farmId, animalId, recordedById, attendingVetId, eventType, severity, symptoms, diagnosis, treatment, cost, resolvedAt, syncVersion, createdAt, updatedAt, and embedded summaries for animal, recorder, and attending vet.

---

## 5. Security & Multi-Tenancy

1. **Strict Multi-Tenant Scoping**:
   - The active tenant ID is extracted from `x-farm-id` or the authenticated context and validated via `TenantGuard`.
   - All repository queries filter strictly by `farmId`.
   - Animal and vet records are validated to belong to the tenant before establishing foreign key relations.
2. **Role-Based Access Control**:
   - Recording clinical events: `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`.
   - Updating/Resolving clinical events: `OWNER`, `MANAGER`, `VET_STAFF`.
   - Viewing health records: All authenticated farm members (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`).
   - Deleting health records: `OWNER`, `MANAGER` only.
3. **Audit Trail**:
   - All mutations (`CREATE`, `UPDATE`, `RESOLVE`, `DELETE`) emit structured `AuditLog` records in the same transaction client.
4. **Validation & Edge Cases**:
   - `cost < 0` triggers `400 Bad Request`.
   - Animal belonging to another tenant or non-existent triggers `404 Not Found`.
   - Soft-deleted animal (`deletedAt !== null`) cannot receive new clinical records (`422 Unprocessable Entity`).
   - `resolvedAt` before incident `createdAt` triggers `422 Unprocessable Entity`.
   - Concurrency mismatch (`syncVersion`) triggers `409 Conflict`.
