# SPEC-701: Daily Milk Yield Logging Per Animal and Session

## 1. Feature Overview & Objective
In modern dairy and mixed livestock farming (cattle, buffalo, goat, sheep, camel), daily milk production tracking is the fundamental economic metric and the primary indicator of animal health and lactation performance.

Recording milk yield per milking session (`MORNING`, `AFTERNOON`, `EVENING`) enables farm managers and herdsmen to:
1. Accurately measure individual animal milk yields and lactation curves.
2. Capture milk quality parameters (Fat % and Solids-Not-Fat / SNF %) per session.
3. Rapidly identify health issues (such as clinical or subclinical mastitis, ketosis, or feed deficiencies) that manifest first as acute drops in session milk production.
4. Maintain historical production records to assess genetic value and breeding selection.

**Objective**:
Implement an enterprise-grade, multi-tenant Daily Milk Yield Logging engine in VETRALINK PRO that allows farm staff to record, query, update, and delete individual animal milk production records per session with strict multi-tenant scoping, biological validation rules, audit logging, and offline synchronization support.

---

## 2. Current State vs. Proposed State

### Current State
- `apps/api/prisma/schema.prisma` already defines the `MilkSession` enum (`MORNING`, `AFTERNOON`, `EVENING`) and the `MilkLog` model with relational links to `Farm`, `Animal`, and `User` (recorder).
- The `MilkLog` table has a composite unique constraint: `@@unique([farmId, animalId, loggedDate, session])`.
- `packages/shared-types` exports `MilkSession` enum, but no milk DTOs, response models, or query filters.
- No `MilkLogsModule`, `MilkLogRepository`, or `MilkLogService` currently exists in `apps/api/src/modules/`.
- No REST API endpoints exist for milk logging operations.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - `CreateMilkLogDto`: Individual animal yield, session, date, fat %, snf %.
  - `UpdateMilkLogDto`: Partial updates to session yield and quality attributes.
  - `MilkLogQueryDto`: Multi-tenant filtering (date range, animalId, session, pagination, sorting).
  - `MilkLogResponseDto` & `PaginatedMilkLogsDto`: Type-safe serialized response shapes matching the standard `ApiResponse<T>` envelope.
- **Backend Architecture (`apps/api/src/modules/milk-logs/`)**:
  - Following strict Clean Architecture: `Controller -> Service -> Domain -> Repository`.
  - `IMilkLogRepository`: Clean abstraction over Prisma data access, mapping raw rows to domain entities.
  - `IMilkLogService`: Business logic enforcing multi-tenant boundaries, biological validations (only active female mammals of milking species), optimistic locking (`syncVersion`), and audit log emission within atomic transactions.
  - `MilkLogsController`: Guarded REST API endpoints (`/api/v1/milk-logs`) protected by `JwtAuthGuard`, `TenantGuard`, and `RolesGuard` (`FARMER`, `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`).
  - Unit test suite for `MilkLogService` and `MilkLogsController`.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Idempotent Upsert vs. Strict Conflict Error on Existing Session Log
- **Option A (Silent Upsert / Overwrite)**:
  - If a log already exists for `[farmId, animalId, loggedDate, session]`, silently overwrite `yieldLiters`, `fatPercent`, and `snfPercent`.
  - *Cons*: High risk of accidental data overwrites if two milkers enter data concurrently or an operator selects the wrong session. Obscures audit trail of who made the original entry vs. subsequent edits.
- **Option B (Strict Conflict 409 with Explicit Update Endpoint - SELECTED)**:
  - If a log already exists for that animal, date, and session, reject the POST request with `409 Conflict` stating that a session log already exists. Require an explicit `PATCH /api/v1/milk-logs/:id` mutation.
  - *Pros*: Eliminates silent data corruption. Enforces intentional human reviews for production revisions. Complies with strict accounting and dairy certification audit standards.
  - *Justification*: In commercial dairy operations, adjusting milk logs must be auditable and deliberate, preventing accidental data erasure.

### Trade-off 2: Decimal Precision Storage vs. Integer Milliliters
- **Option A (Integer Milliliters)**:
  - Store yield as integer milliliters (e.g., `12500` ml instead of `12.500` L).
  - *Cons*: Incompatible with existing Prisma schema (`Decimal(8,3)`), requires application-level unit conversions across calculations, reports, and UI inputs.
- **Option B (Prisma Decimal(8, 3) - SELECTED)**:
  - Utilize the existing `Decimal(8, 3)` schema definition, representing liters up to 3 decimal places (1 ml accuracy).
  - *Pros*: Directly conforms to schema, matches global AgTech standards (kg/liters with decimal fractions), and cleanly handles high-volume bulk or small-species precision (e.g., goat/sheep producing 0.750 L).
  - *Justification*: Consistent with existing schema design and avoids conversion bugs.

### Trade-off 3: Biological and Physiological Validation at Service Layer
- **Option A (Permissive Acceptance)**:
  - Allow any animal ID in the farm to receive milk logs.
  - *Cons*: Creates corrupted datasets where male animals, deceased animals, or non-dairy species (e.g. poultry) have milk records, breaking farm analytics and reporting integrity.
- **Option B (Strict Biological Validation - SELECTED)**:
  - At the service boundary:
    1. Verify animal belongs to target `farmId` and has `deletedAt === null`.
    2. Verify `status === ACTIVE` (not `SOLD`, `DECEASED`, or `CULLED`).
    3. Verify `gender === FEMALE`.
    4. Verify species is a mammalian dairy species (`COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`). Reject `POULTRY` and invalid types.
    5. Verify `yieldLiters > 0` and within physiological maximums per session (e.g., max 60.000 L/session for high-producing cows, max 10.000 L for small ruminants).
  - *Justification*: AgTech ERP platforms must maintain data credibility and prevent nonsensical telemetry.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema (`MilkLog`)
Existing model in `apps/api/prisma/schema.prisma`:
```prisma
model MilkLog {
  id           String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId       String      @map("farm_id") @db.Uuid
  animalId     String?     @map("animal_id") @db.Uuid
  recordedById String      @map("recorded_by_id") @db.Uuid
  session      MilkSession
  yieldLiters  Decimal     @map("yield_liters") @db.Decimal(8, 3)
  fatPercent   Decimal?    @map("fat_percentage") @db.Decimal(4, 2)
  snfPercent   Decimal?    @map("snf_percentage") @db.Decimal(4, 2)
  loggedDate   DateTime    @map("logged_date") @db.Date
  syncVersion  Int         @default(1) @map("sync_version")
  createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm       Farm    @relation(fields: [farmId], references: [id], onDelete: Restrict)
  animal     Animal? @relation(fields: [animalId], references: [id], onDelete: SetNull)
  recordedBy User    @relation(fields: [recordedById], references: [id], onDelete: Restrict)

  @@unique([farmId, animalId, loggedDate, session])
  @@index([farmId, loggedDate])
  @@index([farmId, updatedAt])
  @@index([animalId, loggedDate])
  @@map("milk_logs")
}
```

### 4.2 Data Transfer Objects (DTOs)
```typescript
// packages/shared-types/src/dto/milk-logs/create-milk-log.dto.ts
export interface CreateMilkLogRequest {
  animalId: string;
  session: MilkSession;
  yieldLiters: number;
  fatPercent?: number;
  snfPercent?: number;
  loggedDate: string; // YYYY-MM-DD
}

// packages/shared-types/src/dto/milk-logs/update-milk-log.dto.ts
export interface UpdateMilkLogRequest {
  yieldLiters?: number;
  fatPercent?: number | null;
  snfPercent?: number | null;
  session?: MilkSession;
}

// packages/shared-types/src/dto/milk-logs/milk-log-response.dto.ts
export interface MilkLogResponseDto {
  id: string;
  farmId: string;
  animalId: string | null;
  animalTagNumber?: string | null;
  animalName?: string | null;
  recordedById: string;
  recorderName?: string;
  session: MilkSession;
  yieldLiters: number;
  fatPercent: number | null;
  snfPercent: number | null;
  loggedDate: string;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

### 4.3 REST API Endpoints
All endpoints are scoped under `/api/v1/milk-logs`:

| Method | Path | Auth/Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/milk-logs` | JWT, Tenant, Roles (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) | Log session milk yield for an animal |
| `GET` | `/api/v1/milk-logs` | JWT, Tenant | Query milk logs with date/animal filters & pagination |
| `GET` | `/api/v1/milk-logs/:id` | JWT, Tenant | Get detailed session milk log by ID |
| `PATCH` | `/api/v1/milk-logs/:id` | JWT, Tenant, Roles (`OWNER`, `MANAGER`) | Update yield or milk quality parameters |
| `DELETE` | `/api/v1/milk-logs/:id` | JWT, Tenant, Roles (`OWNER`, `MANAGER`) | Remove an erroneous milk log entry |

---

## 5. Security & Edge Cases

### Security & Multi-Tenancy
- All queries MUST enforce `farmId` matching the tenant context from `x-farm-id` and verified by `TenantGuard`.
- Cross-tenant data leakage is strictly prevented at both the service and repository layers.
- Audit logging: Every Create, Update, and Delete operation generates an immutable `AuditLog` entry in the same transaction.

### Edge Cases
1. **Future Dates**: `loggedDate` cannot be in the future (compared to the farm's current local date).
2. **Duplicate Session Entry**: Attempting to log the same session twice for the same animal on the same date triggers `409 Conflict`.
3. **Invalid Animal ID**: Non-existent animal ID or animal belonging to another farm triggers `404 Not Found`.
4. **Physiological Checks**:
   - Male animals (`AnimalGender.MALE`) are rejected with `422 Unprocessable Entity`.
   - Inactive animals (`AnimalStatus.SOLD`, `DECEASED`, `CULLED`) are rejected with `422 Unprocessable Entity`.
   - Non-dairy species (e.g. `POULTRY`) are rejected with `422 Unprocessable Entity`.
   - Negative yield or yield > 100 liters triggers `400 Bad Request`.
5. **Quality Percentages**: Fat % and SNF % must fall between 0.00% and 20.00% if provided.
