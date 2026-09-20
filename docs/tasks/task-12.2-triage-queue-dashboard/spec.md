# Task 12.2 Specification: Triage Queue Dashboard for Triage Officers and Clinic Administrators

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, farmers submit clinical consultation requests (either asynchronous tickets or live video requests). Once submitted, cases enter a centralized clinical triage queue. 

The **Triage Queue Dashboard** provides triage officers (veterinarians) and clinic administrators (`VET`, `ADMIN`, `SUPER_ADMIN`) with a real-time, consolidated operational view to:
1. **Monitor and Prioritize Influx**: Inspect all pending consultation requests across farm tenants in a FIFO or priority-sorted triage queue.
2. **Filter and Search**: Rapidly filter cases by status (`SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), consultation type (`ASYNC_TICKET`, `LIVE_VIDEO`), animal species (`COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`, `POULTRY`, `OTHER`), farm, date range, or free-text search across complaints, farmer profiles, and animal tags.
3. **Inspect Real-Time Triage Metrics**: Monitor high-level KPIs including pending backlog count, assigned count, in-progress count, today's completion and cancellation volume, ticket vs. video breakdown, species distribution, and average/max wait times in minutes.
4. **Deep Clinical Intake Inspection**: Access comprehensive clinical context for a specific consultation, including the farmer's contact details, farm profile, affected animal demographics, and historical EHR records (recent health events and vaccination logs) to make informed triage decisions.
5. **Triage Action (Cancellation / Rejection)**: Cancel/reject inappropriate, duplicate, or out-of-scope requests with an audit-logged reason.

---

## 2. Current State vs. Proposed State

### Current State
- **Task 12.1 Completed**: Farmers can submit consultation requests (`POST /consultations`), view their own farm's consultations (`GET /consultations`), and retrieve consultation details (`GET /consultations/:id`) scoped by farm tenant (`TenantGuard`).
- The `ConsultationRepository` currently provides `findById`, `create`, `save`, `findByFarm`, and `findByFarmer`.
- All consultation endpoints require a farm tenant context (`TenantGuard`), which restricts access to users with farm membership.
- Triage officers and clinic administrators have no centralized cross-tenant endpoint to view the queue of incoming cases, inspect triage analytics, or review deep EHR history before assigning a vet.

### Proposed State
- **Role-Based Cross-Tenant Triage Access**: Provide dedicated triage endpoints guarded by `JwtAuthGuard` and `RolesGuard` permitting `VET`, `ADMIN`, and `SUPER_ADMIN`.
- **`GET /consultations/triage/queue`**: Paginated, filterable, and searchable triage queue with calculated wait times in minutes.
- **`GET /consultations/triage/metrics`**: Aggregated triage queue KPIs (pending, assigned, in-progress, completed today, cancelled today, avg wait time, oldest wait time, type breakdown, and species breakdown).
- **`GET /consultations/triage/queue/:id`**: Detailed triage case inspection with farmer contact details, farm profile, affected animal details, and recent health/vaccine history.
- **`PATCH /consultations/triage/queue/:id/cancel`**: Triage cancellation action with mandatory audit logging and reason.
- **Updated Shared Types**: Export `TriageQueueItemDto`, `TriageMetricsDto`, `TriageCaseDetailDto`, `QueryTriageQueueDto`, and `CancelTriageCaseDto` in `@vetralink/shared-types`.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Controller Placement** | Add triage endpoints into `ConsultationController` with method-level guard overrides. | Dedicated `ConsultationTriageController` (`/consultations/triage`) with class-level `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(SUPER_ADMIN, ADMIN, VET)`. | **Selected: Option B**. Single Responsibility Principle (SRP). `ConsultationController` is farm-tenant-scoped for farmers (`TenantGuard`, `SubscriptionReadOnlyGuard`), whereas triage is a clinical staff capability across tenants without farm tenant header requirements. |
| **Wait Time Computation** | Calculate wait times via database SQL expressions on every row fetch. | Compute `waitTimeMinutes` deterministically in the domain/DTO mapping layer from `createdAt` and current timestamp. | **Selected: Option B**. Clean architecture isolation, portable across databases/mock tests, and avoids dialect-specific SQL date math in Prisma. |
| **Queue Filtering Strategy** | In-memory filtering of all consultations in memory. | Push filtering (status, type, species, date, search, pagination) directly down to Prisma query conditions (`where`, `skip`, `take`, `orderBy`). | **Selected: Option B**. Essential for scalability and O(1) memory overhead even with thousands of consultation records. |
| **Animal EHR Context** | Fetch EHR records via a separate external HTTP call to health module. | Include recent health records and vaccine logs directly in the repository lookup query or dedicated aggregator. | **Selected: Option B**. Relational join with limit on recent events is fast, atomic, and avoids network hop overhead. |

---

## 4. Data Models & Contracts

### Shared Types (`packages/shared-types`)

```typescript
export interface TriageQueueItemDto {
  id: string;
  farmerId: string;
  vetId: string | null;
  farmId: string;
  animalId: string | null;
  chiefComplaint: string;
  mediaUrls: string[];
  type: ConsultationType;
  status: ConsultationStatus;
  feeCents: number;
  createdAt: string;
  updatedAt: string;
  waitTimeMinutes: number;
  farmer?: { id: string; name: string; email: string } | null;
  vet?: { id: string; name: string; email: string } | null;
  animal?: { id: string; name: string; tagNumber: string; species: string } | null;
  farm?: { id: string; name: string } | null;
}

export interface TriageMetricsDto {
  pendingCount: number;
  assignedCount: number;
  inProgressCount: number;
  completedTodayCount: number;
  cancelledTodayCount: number;
  typeBreakdown: {
    asyncTickets: number;
    liveVideos: number;
  };
  speciesBreakdown: Record<string, number>;
  avgWaitTimeMinutes: number;
  oldestPendingWaitMinutes: number;
}

export interface TriageRecentHealthRecordDto {
  id: string;
  eventType: string;
  severity: string;
  symptoms: string;
  diagnosis?: string | null;
  treatment?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface TriageRecentVaccineRecordDto {
  id: string;
  type: string;
  vaccineName: string;
  administeredDate: string;
  dosage?: string | null;
}

export interface TriageCaseDetailDto extends TriageQueueItemDto {
  farmerPhone?: string | null;
  farmType?: string | null;
  animalDetails?: {
    id: string;
    name: string | null;
    tagNumber: string;
    rfidNumber: string | null;
    species: string;
    breed: string | null;
    gender: string;
    dateOfBirth: string | null;
    weightKg: number | null;
    status: string;
  } | null;
  recentHealthRecords: TriageRecentHealthRecordDto[];
  recentVaccineRecords: TriageRecentVaccineRecordDto[];
}

export interface QueryTriageQueueDto {
  page?: number;
  limit?: number;
  status?: ConsultationStatus | "ALL";
  type?: ConsultationType;
  species?: AnimalSpecies;
  farmId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface CancelTriageCaseDto {
  reason: string;
}
```

---

## 5. Security & Edge Cases

1. **Role-Based Access Control**:
   - All `/consultations/triage` endpoints require `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.
   - Any access attempt by a `FARMER` or `BUYER` immediately throws `ForbiddenOperationException` (403).
2. **Soft-Deleted Data Protection**:
   - Animals or users with `deletedAt != null` are properly handled or excluded from active queries.
3. **Queue Sorting & FIFO Default**:
   - Default sorting is `createdAt: 'asc'`, prioritizing cases that have been waiting the longest.
4. **Cancellation Edge Cases**:
   - A consultation can only be cancelled if it has not already been completed (`COMPLETED`) or cancelled (`CANCELLED`).
   - Audit log emitted with action `CONSULTATION_CANCELLED_BY_TRIAGE`, storing `reason` and triage officer identity.
5. **Metrics Empty State**:
   - If no pending consultations exist, `avgWaitTimeMinutes` and `oldestPendingWaitMinutes` cleanly return `0`.
