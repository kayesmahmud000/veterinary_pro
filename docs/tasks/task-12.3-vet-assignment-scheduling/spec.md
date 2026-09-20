# Task 12.3 Specification: Vet Assignment and Scheduling Algorithm Based on Availability and Specialty

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, clinical consultations submitted by farmers must be matched with the most qualified and available veterinarian. 

The **Vet Assignment and Scheduling Engine** implements:
1. **Veterinarian Profiles & Availability**: Veterinarians have designated clinical specialties (species like `COW`, `BUFFALO`, `GOAT`, `SHEEP`, `POULTRY`, `CAMEL`, `OTHER`, or `GENERAL`), toggleable availability status (`isAvailable`), maximum concurrent active case capacity (default: 5), and weekly working hour schedules.
2. **Weighted Multi-Criteria Matching Algorithm**: A smart matching algorithm evaluates all active veterinarians against an incoming case and computes a composite match score (0 - 100):
   - **Specialty Match (0 - 50 pts)**: Exact species specialization (+50 pts), generalist (+25 pts), or mismatch (0 pts).
   - **Workload Balance (0 - 30 pts)**: Prioritizes veterinarians with the lowest active caseload ratio (`(1 - activeCases / maxCases) * 30`).
   - **Availability / Responsiveness (0 - 20 pts)**: Highest for on-duty vets with zero or low current caseload.
3. **Conflict Detection for Live Video**: For `LIVE_VIDEO` consultations with a requested appointment time (`scheduledAt`), checks that the slot falls within the vet's weekly working hours and has no conflicting appointments within 45 minutes.
4. **Candidate Inspection & Assignment**:
   - Triage officers can inspect ranked candidates (`GET /consultations/triage/queue/:id/candidates`).
   - Triage officers can manually assign a chosen vet (`POST /consultations/triage/queue/:id/assign`).
   - Automated auto-assignment picks the highest-ranked candidate (`POST /consultations/triage/queue/:id/auto-assign`).
5. **Vet Availability Management**: Endpoints for veterinarians and clinic administrators to view and update availability, caseload limits, and specialties (`GET /consultations/vets/availability`, `GET/PUT /consultations/vets/:id/availability`).

---

## 2. Current State vs. Proposed State

### Current State
- `Consultation` records have an optional `vetId` and a status `SUBMITTED`.
- In `ConsultationEntity`, `assignToVet(vetId)` transitions status to `ASSIGNED`, but without tracking `assignedAt`, `scheduledAt`, caseload limits, or specialty matching.
- There is no `VetProfile` model in the database, so veterinarian specialties, working hours, and availability cannot be persisted or evaluated.
- No recommendation or auto-assignment algorithm exists.

### Proposed State
- **Database Schema**:
  - Add `VetProfile` model to Prisma schema (`userId`, `specialties`, `isAvailable`, `maxActiveCases`, `workingHours`, `timezone`).
  - Add `scheduledAt` and `assignedAt` timestamps to `Consultation`.
- **Domain Entities**:
  - `VetProfileEntity`: manages vet specialties, working hours, availability, and caseload constraints.
  - Enhanced `ConsultationEntity`: stores `scheduledAt`, `assignedAt`, and enforces assignment invariants.
- **Assignment & Recommendation Engine**:
  - `findRankedCandidates`: retrieves, filters, and ranks candidate veterinarians with score breakdowns.
  - `assignToVet`: validates vet eligibility, updates consultation status, records timestamps, and emits structured audit logs (`CONSULTATION_MANUALLY_ASSIGNED` or `CONSULTATION_AUTO_ASSIGNED`).
- **REST Endpoints**:
  - `GET /consultations/triage/queue/:id/candidates`: retrieve ranked vet candidates for a case.
  - `POST /consultations/triage/queue/:id/assign`: manual vet assignment.
  - `POST /consultations/triage/queue/:id/auto-assign`: automated one-click assignment.
  - `GET /consultations/vets/availability`: clinic-wide vet availability overview.
  - `GET /consultations/vets/:id/availability`: get specific vet profile.
  - `PUT /consultations/vets/:id/availability`: update vet profile.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Vet Profile Storage** | Store specialties and working hours as unstructured JSON in `User.metadata`. | Dedicated `VetProfile` model with 1-to-1 relation to `User`. | **Selected: Option B**. Enforces relational integrity, type safety, indexing on `isAvailable`, and clean separation between general user auth and clinical veterinary profiles. |
| **Scoring Engine Location** | Database-side stored procedure or complex SQL scoring query. | Domain Service layer algorithm in TypeScript (`VetAssignmentService`). | **Selected: Option B**. Business rules, weighting formulas, and conflict detection are easily unit-tested, debuggable, and maintainable without database-specific SQL functions. |
| **Capacity Enforcement** | Soft check without strict limits. | Strict check: vets with `activeCases >= maxActiveCases` are disqualified from auto-assignment, with manual override option for clinic administrators. | **Selected: Option B**. Prevents veterinarian burnout, ensures rapid response times for farmers, and maintains clinical quality of care. |

---

## 4. Data Models & Contracts

### Prisma Schema Additions

```prisma
model VetProfile {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String   @unique @map("user_id") @db.Uuid
  specialties     Json     @default("[]") // string[] representing AnimalSpecies or specializations
  isAvailable     Boolean  @default(true) @map("is_available")
  maxActiveCases  Int      @default(5) @map("max_active_cases")
  workingHours    Json     @default("[]") // [{ dayOfWeek: 1..7, startTime: "08:00", endTime: "17:00" }]
  timezone        String   @default("UTC") @db.VarChar(50)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([isAvailable])
  @@map("vet_profiles")
}
```

In `Consultation`:
```prisma
  scheduledAt    DateTime?          @map("scheduled_at") @db.Timestamptz(6)
  assignedAt     DateTime?          @map("assigned_at") @db.Timestamptz(6)
```

### Shared Types (`packages/shared-types`)

```typescript
export interface VetWorkingHoursDto {
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
}

export interface VetProfileDto {
  id: string;
  userId: string;
  specialties: string[];
  isAvailable: boolean;
  maxActiveCases: number;
  workingHours: VetWorkingHoursDto[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface UpdateVetProfileDto {
  specialties?: string[];
  isAvailable?: boolean;
  maxActiveCases?: number;
  workingHours?: VetWorkingHoursDto[];
  timezone?: string;
}

export interface VetCandidateScoreBreakdownDto {
  specialtyScore: number;
  workloadScore: number;
  availabilityScore: number;
}

export interface VetCandidateDto {
  vetId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  specialties: string[];
  isAvailable: boolean;
  currentActiveCases: number;
  maxActiveCases: number;
  totalScore: number;
  scoreBreakdown: VetCandidateScoreBreakdownDto;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export interface AssignConsultationDto {
  vetId: string;
  scheduledAt?: string;
  notes?: string;
}

export interface AutoAssignConsultationDto {
  scheduledAt?: string;
}

export interface VetAvailabilitySummaryDto {
  vetId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAvailable: boolean;
  specialties: string[];
  currentActiveCases: number;
  maxActiveCases: number;
  capacityUtilizationPercent: number;
  timezone: string;
}
```

---

## 5. Security & Edge Cases

1. **Role-Based Authorization**:
   - `GET /consultations/triage/queue/:id/candidates`, `POST .../assign`, and `POST .../auto-assign` are guarded by `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.
   - `PUT /consultations/vets/:id/availability` can only be called by the vet themselves or `ADMIN` / `SUPER_ADMIN`.
2. **Invalid / Inactive Target Vet**:
   - Assigning a user who does not have `role = VET` or whose status is `SUSPENDED` throws `ValidationDomainException`.
3. **No Eligible Candidates for Auto-Assign**:
   - If all veterinarians are off-duty or at full capacity, `autoAssign` throws a clear `ValidationDomainException` stating no eligible veterinarians are available.
4. **Already Completed / Cancelled Consultations**:
   - Attempting to assign an already completed or cancelled consultation throws `ValidationDomainException`.
5. **Audit Trail**:
   - Every assignment emits an audit log record with `oldValues: { vetId, status }` and `newValues: { vetId, status, assignedAt, scheduledAt }`.
