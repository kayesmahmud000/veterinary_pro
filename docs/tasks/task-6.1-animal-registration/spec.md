# SPEC-601: Multi-Species Animal Registration Engine

## 1. Feature Overview & Objective
VETRALINK PRO provides an integrated, multi-tenant Farm SaaS ERP serving diverse agricultural operations across dairy, beef, small ruminants (goats/sheep), camelids, and poultry farming.

The primary objective of **Task 6.1** is to engineer the foundational **Animal Registry Engine** within `apps/api/src/modules/animals`. This engine enables farm owners, managers, herdsmen, and attending veterinary staff to register and catalog livestock across supported species:
- `COW` (Bovine)
- `BUFFALO` (Water Buffalo)
- `GOAT` (Caprine)
- `SHEEP` (Ovine)
- `CAMEL` (Camelid)
- `POULTRY` (Avian - Broiler / Layer / Breeder)
- `OTHER` (General livestock)

The engine guarantees strict tenant isolation (`farm_id`), enforces biological and pedigree invariants (e.g. sex verification for sire/dam lineage, date-of-birth reality checks, species validation), guarantees tag uniqueness within the active herd, and produces immutable audit records.

---

## 2. Current State vs. Proposed State

### Current State
1. **Database Schema**: The `animals` table and `AnimalSpecies`, `AnimalGender`, and `AnimalStatus` enums are defined in `apps/api/prisma/schema.prisma` and generated in initial migrations with foreign key constraints to `farms(id)`. A partial unique index `uq_active_farm_animal_tag` exists on `(farm_id, tag_number) WHERE deleted_at IS NULL`.
2. **Multi-Tenancy Infrastructure**: `TenantGuard`, `Tenant` decorator, `FarmRoles` decorator, and `CurrentFarm` decorator exist in `apps/api/src/common/` and evaluate farm memberships against `farm_members`.
3. **Application Modules**: No `animals` module exists in `apps/api/src/modules/`. There are no Animal DTOs in `@vetralink/shared-types`, no domain entity, no repository, no service, and no controller endpoints for registering or managing livestock.

### Proposed State
1. **Shared Contracts (`@vetralink/shared-types`)**:
   - DTOs: `RegisterAnimalDto`, `UpdateAnimalDto`, `AnimalResponseDto`, `AnimalQueryDto`, and `AnimalBatchSummaryDto`.
2. **Domain Layer (`apps/api/src/modules/animals`)**:
   - `AnimalEntity`: Pure domain entity with encapsulated biological rules (`isFemale`, `isMale`, `canProduceMilk`, `calculateAgeMonths`, `isActive`).
   - `IAnimalRepository`: Clean Architecture interface decoupled from ORM.
   - `IAnimalsService`: Domain service contract specifying registration, query, update, and soft-deletion operations.
3. **Data Access Layer**:
   - `AnimalRepository`: Prisma-backed data access layer ensuring mandatory `farmId` tenant filter on every query, enforcing soft-delete handling (`deletedAt IS NULL`), and supporting pagination and search filters.
4. **API Layer (`AnimalsController`)**:
   - `POST /api/v1/animals`: Register a new animal in the active farm tenant.
   - `GET /api/v1/animals`: Paginated query of farm animals with multi-criteria filtering (`species`, `gender`, `status`, `search`).
   - `GET /api/v1/animals/:id`: Retrieve full animal profile including sire/dam pedigree summary.
   - `PATCH /api/v1/animals/:id`: Update animal fields.
   - `DELETE /api/v1/animals/:id`: Soft-delete animal (archive) preserving historical health and milk records.
5. **Security & Audit Integration**:
   - All mutations emit structured audit events (`ANIMAL_REGISTERED`, `ANIMAL_UPDATED`, `ANIMAL_ARCHIVED`) via `AuditService`.
   - Access restricted to authenticated tenant members with appropriate farm roles (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`).

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Single Table Inheritance vs. Class Table Inheritance (Per-Species Tables)
- **Option A (Separate Tables per Species, e.g. `cows`, `goats`, `poultry`)**:
  - *Pros*: Columns can be completely bespoke to species (e.g. `egg_laying_rate` vs `lactation_stage`).
  - *Cons*: High schema complexity, fragmented relationships with `health_records`, `vaccine_records`, and `milk_logs`, difficult to run cross-species farm queries.
- **Option B (Single Unified `animals` Table with JSONB `metadata`) [RECOMMENDED]**:
  - *Pros*: Normalized 3NF core attributes (`id`, `farm_id`, `tag_number`, `species`, `breed`, `gender`, `date_of_birth`, `weight_kg`, `status`, `sire_id`, `dam_id`), while species-specific traits (e.g. poultry flock size, fleece quality for sheep, hump conformation for camels) are stored in indexed JSONB `metadata`. Clean foreign key links from health, milk, and vaccination tables.
  - *Technical Justification*: Follows established schema in `schema.prisma`. Maximizes query reusability and simplifies multi-tenant reporting across diverse agricultural enterprises.

### Trade-off 2: Ear Tag Uniqueness — Global vs. Tenant-Scoped Partial Index
- **Option A (Globally Unique Tag Numbers across all farms)**:
  - *Cons*: Unrealistic in agriculture; government ear tag formats (e.g. 8-digit or 12-digit visual tags) or farm-specific RFID numbers frequently collide across different farms and countries.
- **Option B (Tenant-Scoped Partial Unique Index: `(farm_id, tag_number) WHERE deleted_at IS NULL`) [RECOMMENDED]**:
  - *Pros*: Allows independent farms to number animals (e.g. Tag `#101`) without collision. Allows recycling or re-registration of tags if an old animal record was soft-deleted.
  - *Technical Justification*: Already specified in `0_init/migration.sql` (`uq_active_farm_animal_tag`). Service layer performs proactive pre-check for clean user error messaging (`Duplicate tagNumber in active herd`).

### Trade-off 3: Pedigree Validation Strategy (Synchronous vs. Deferred)
- **Option A (Deferred / Unchecked Sire & Dam UUIDs)**:
  - *Cons*: Allows invalid lineages (e.g. assigning a female animal as sire, or a sire from a different farm tenant).
- **Option B (Synchronous Invariant Check in Domain Service) [RECOMMENDED]**:
  - *Pros*:
    1. Ensures `sireId !== animalId` and `damId !== animalId`.
    2. Ensures sire and dam exist and belong to the same `farm_id`.
    3. Enforces biological gender: `sire.gender === AnimalGender.MALE` and `dam.gender === AnimalGender.FEMALE`.
    4. Ensures sire/dam species is compatible with offspring species.
  - *Technical Justification*: Guarantees data integrity before insertion, preventing corrupted pedigree trees in Sprint 6 Task 6.3.

---

## 4. Data Models & Contracts

### 4.1 Database Model (`apps/api/prisma/schema.prisma`)
```prisma
model Animal {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId      String        @map("farm_id") @db.Uuid
  tagNumber   String        @map("tag_number") @db.VarChar(50)
  name        String?       @db.VarChar(100)
  species     AnimalSpecies
  breed       String?       @db.VarChar(100)
  gender      AnimalGender
  dateOfBirth DateTime?     @map("date_of_birth") @db.Date
  weightKg    Decimal?      @map("weight_kg") @db.Decimal(6, 2)
  status      AnimalStatus  @default(ACTIVE)
  sireId      String?       @map("sire_id") @db.Uuid
  damId       String?       @map("dam_id") @db.Uuid
  metadata    Json          @default("{}")
  syncVersion Int           @default(1) @map("sync_version")
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime?     @map("deleted_at") @db.Timestamptz(6)

  farm           Farm            @relation(fields: [farmId], references: [id], onDelete: Restrict)
  sire           Animal?         @relation("SirePedigree", fields: [sireId], references: [id], onDelete: SetNull)
  dam            Animal?         @relation("DamPedigree", fields: [damId], references: [id], onDelete: SetNull)
  sireOffspring  Animal[]        @relation("SirePedigree")
  damOffspring   Animal[]        @relation("DamPedigree")
  healthRecords  HealthRecord[]
  vaccineRecords VaccineRecord[]
  milkLogs       MilkLog[]
  consultations  Consultation[]

  @@index([farmId, tagNumber])
  @@index([farmId, status])
  @@index([farmId, species])
  @@index([farmId, updatedAt])
  @@map("animals")
}
```

### 4.2 Data Transfer Objects (`@vetralink/shared-types`)

#### `RegisterAnimalDto`
```typescript
export class RegisterAnimalDto {
  tagNumber: string;         // Required, 1-50 chars, trimmed, uppercase-normalized
  name?: string;             // Optional, 1-100 chars
  species: AnimalSpecies;    // Required enum: COW | BUFFALO | GOAT | SHEEP | CAMEL | POULTRY | OTHER
  breed?: string;            // Optional, 1-100 chars
  gender: AnimalGender;      // Required enum: MALE | FEMALE
  dateOfBirth?: string;      // Optional ISO 8601 date (YYYY-MM-DD), cannot be in future
  weightKg?: number;         // Optional positive number, max 9999.99
  status?: AnimalStatus;     // Optional enum, default: ACTIVE
  sireId?: string;           // Optional UUID
  damId?: string;            // Optional UUID
  metadata?: Record<string, unknown>; // Optional JSON metadata
}
```

#### `UpdateAnimalDto`
```typescript
export class UpdateAnimalDto {
  tagNumber?: string;
  name?: string;
  species?: AnimalSpecies;
  breed?: string;
  gender?: AnimalGender;
  dateOfBirth?: string;
  weightKg?: number;
  status?: AnimalStatus;
  sireId?: string;
  damId?: string;
  metadata?: Record<string, unknown>;
}
```

#### `AnimalResponseDto`
```typescript
export interface AnimalResponseDto {
  id: string;
  farmId: string;
  tagNumber: string;
  name: string | null;
  species: AnimalSpecies;
  breed: string | null;
  gender: AnimalGender;
  dateOfBirth: string | null;
  ageMonths: number | null;
  weightKg: number | null;
  status: AnimalStatus;
  sireId: string | null;
  damId: string | null;
  sire?: { id: string; tagNumber: string; name: string | null } | null;
  dam?: { id: string; tagNumber: string; name: string | null } | null;
  metadata: Record<string, unknown>;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

#### `AnimalQueryDto`
```typescript
export class AnimalQueryDto {
  species?: AnimalSpecies;
  gender?: AnimalGender;
  status?: AnimalStatus;
  search?: string;           // Matches tagNumber or name (case-insensitive substring)
  page?: number;             // Default 1
  limit?: number;            // Default 20, max 100
  sortBy?: "tagNumber" | "name" | "createdAt" | "dateOfBirth" | "weightKg";
  sortOrder?: "asc" | "desc";
}
```

### 4.3 API Endpoints
| HTTP Method | Route | Description | Required Roles |
|:---|:---|:---|:---|
| `POST` | `/api/v1/animals` | Register a new animal in current farm tenant | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `GET` | `/api/v1/animals` | List animals with filtering, pagination & search | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `GET` | `/api/v1/animals/:id` | Get single animal details with lineage summary | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `PATCH` | `/api/v1/animals/:id` | Update animal fields | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `DELETE` | `/api/v1/animals/:id` | Soft delete / archive animal | `OWNER`, `MANAGER` |

---

## 5. Security & Edge Cases

1. **Multi-Tenant Leakage Prevention**:
   - `TenantGuard` strictly enforces that the calling user is an authorized member of the target `farm_id`.
   - All repository queries filter strictly by `farm_id`. Even if a user crafts an animal UUID from another farm, the query returns 404 Not Found.
2. **Tag Number Collisions & Race Conditions**:
   - Service checks if an active animal with the same `tagNumber` exists in the tenant farm before insert.
   - DB partial index `uq_active_farm_animal_tag` serves as an atomic backstop against concurrency race conditions.
3. **Biological Invariants**:
   - `dateOfBirth` cannot be in the future.
   - `weightKg` must be strictly positive (> 0 and <= 9999.99).
   - If `sireId` is provided: must exist in the farm, must be `AnimalGender.MALE`, and must match species compatibility.
   - If `damId` is provided: must exist in the farm, must be `AnimalGender.FEMALE`, and must match species compatibility.
   - An animal cannot be its own sire or dam.
4. **Soft Deletion Semantics**:
   - Soft-deleted animals have `deleted_at = NOW()`.
   - Historical health records, milk logs, and vaccine records retain foreign key integrity to the animal.
   - Soft-deleted animals do not block new registrations using the same `tagNumber`.
