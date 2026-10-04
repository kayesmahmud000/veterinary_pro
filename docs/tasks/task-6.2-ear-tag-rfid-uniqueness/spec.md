# SPEC-602: Ear Tag & RFID Electronic Identification Uniqueness Engine

## 1. Feature Overview & Objective
In modern commercial livestock production and precision dairy/beef farming, animal identification relies on a dual-tier mechanism:
1. **Visual Ear Tag Number (`tagNumber`)**: Printed visual identifier (e.g., `COW-104`, `US-12345678`) read by herdsmen and barn staff during daily visual inspections.
2. **Electronic RFID / EID Number (`rfidNumber`)**: Radio-frequency identification transponder (e.g., 15-digit ISO 11784/11785 FDX-B/HDX ear tags, electronic boluses, or microchips) read automatically by automated milking parlors, electronic concentrate feeders, sorting gates, and handheld Bluetooth wand readers.

The objective of **Task 6.2** is to establish an enterprise-grade **Ear Tag & RFID Uniqueness and Fast-Lookup Engine** within `apps/api/src/modules/animals`.

Key business capabilities include:
- **Tenant-Scoped Partial Uniqueness**: Enforce that both `tagNumber` and `rfidNumber` are uniquely assigned within an active farm herd (`deleted_at IS NULL`), preventing duplicate assignments in active inventory while permitting tag recycling once an animal has been archived/culled.
- **Fast RFID/Tag Scan-to-Lookup Endpoint**: Provide sub-10ms O(1) indexed resolution (`/api/v1/animals/lookup/:identifier`) allowing automated milking stalls, sort gates, and handheld wand scanners to instantly fetch animal records upon scanning either visual tag or electronic RFID.
- **Proactive Tag & RFID Availability Verification**: Provide a non-mutating endpoint (`/api/v1/animals/check-tag`) allowing mobile apps and barn tablets to check whether a given tag or RFID is currently available before physical ear-tagging or RFID bolus insertion.

---

## 2. Current State vs. Proposed State

### Current State
1. **Database Schema**: The `animals` table contains `tag_number VARCHAR(50)` with partial index `uq_active_farm_animal_tag` (`WHERE deleted_at IS NULL`). There is no dedicated `rfid_number` column; RFID values could only be stored inside unstructured JSONB `metadata`, which lacks database-level uniqueness and fast B-tree index scans.
2. **Domain Entity & DTOs**: `AnimalEntity`, `RegisterAnimalDto`, and `UpdateAnimalDto` only accept `tagNumber`. They do not model `rfidNumber` or validate RFID electronic transponder format rules.
3. **API & Lookups**: Animals can only be queried by internal UUID (`GET /animals/:id`) or listed with filters (`GET /animals`). There is no endpoint for rapid scan-to-lookup via RFID/tag, and no availability pre-check endpoint.

### Proposed State
1. **Database Schema**:
   - Add nullable column `rfid_number VARCHAR(50)` to `animals` table.
   - Add partial unique index:
     `CREATE UNIQUE INDEX "uq_active_farm_animal_rfid" ON "animals"("farm_id", "rfid_number") WHERE "deleted_at" IS NULL AND "rfid_number" IS NOT NULL;`
   - Add composite B-tree index on `(farm_id, rfid_number)` for ultra-low latency index lookups.
2. **Shared Types (`@vetralink/shared-types`)**:
   - Update `RegisterAnimalRequestDto`, `UpdateAnimalRequestDto`, and `AnimalResponseDto` with `rfidNumber?: string | null`.
   - Introduce `CheckTagAvailabilityDto` and `TagAvailabilityResponseDto`.
3. **Domain Layer (`apps/api/src/modules/animals`)**:
   - `AnimalEntity`: Add `rfidNumber` property with uppercase normalization, trimming, null-coalescing of empty strings, and validation (1-50 chars alphanumeric/hyphens).
   - `IAnimalRepository`: Add `findByRfidNumber()`, `findByIdentifier()`, `existsActiveRfid()`.
   - `AnimalRepository`: Implement Prisma queries with partial unique violation handling for both tag and RFID.
4. **Service & Controller Layer**:
   - `AnimalsService`: Implement dual-uniqueness pre-checks for both `tagNumber` and `rfidNumber`.
   - `GET /api/v1/animals/lookup/:identifier`: O(1) unified lookup endpoint matching either visual `tagNumber` or electronic `rfidNumber`.
   - `GET /api/v1/animals/check-tag`: Query tag availability and suggest alternative recommendations if taken.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Dedicated `rfid_number` Column vs. JSONB Metadata Storage
- **Option A (Store RFID inside `metadata->>'rfidNumber'`)**:
  - *Cons*: Cannot be easily protected by standard Prisma uniqueness decorators; requires complex expression indexes; high JSON parsing overhead during high-frequency milking parlor scan queries (hundreds of scans/hour).
- **Option B (Dedicated `rfid_number VARCHAR(50)` Column with Partial Unique Index) [RECOMMENDED]**:
  - *Pros*: O(1) B-tree indexed lookups; atomic PostgreSQL database constraint ensuring no two active animals ever share an RFID transponder; clean OpenAPI Swagger typing; native Prisma Client type safety.
  - *Technical Justification*: Automated milking parlors query by RFID on every cow entry. Dedicated indexing guarantees < 5ms response time even with 100,000+ animal records.

### Trade-off 2: Unified Lookup Endpoint (`/lookup/:identifier`) vs. Separate Endpoints (`/by-tag` and `/by-rfid`)
- **Option A (Separate Endpoints)**:
  - *Cons*: Handheld wand readers or barcode scanners would need to know whether the scanned payload is a visual tag or an RFID string before choosing the API endpoint.
- **Option B (Unified `/lookup/:identifier` Endpoint) [RECOMMENDED]**:
  - *Pros*: Scanners and wand readers simply transmit the raw read string. The backend resolves against both `(farm_id, tag_number)` and `(farm_id, rfid_number)` in a single indexed query.
  - *Technical Justification*: Greatly simplifies mobile and IoT client implementations while providing seamless fallback between visual tags and electronic microchips.

### Trade-off 3: Tenant-Scoped Partial Index vs. Global RFID Uniqueness
- **Option A (Global Uniqueness across all farms)**:
  - *Cons*: While ISO 11784/11785 transponders are intended to be globally unique 15-digit numbers, emerging-market farms and local breeding cooperatives frequently use reprogrammed tags, test tags, or 8-digit visual codes that collide across completely independent operations in different countries.
- **Option B (Tenant-Scoped Partial Index: `(farm_id, rfid_number) WHERE deleted_at IS NULL`) [RECOMMENDED]**:
  - *Pros*: Strict multi-tenant data isolation; prevents cross-tenant denial-of-service or tag hijacking; allows an archived/deceased animal's electronic tag to be sanitized and reassigned.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Migration (`apps/api/prisma/schema.prisma`)
```prisma
model Animal {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId      String        @map("farm_id") @db.Uuid
  tagNumber   String        @map("tag_number") @db.VarChar(50)
  rfidNumber  String?       @map("rfid_number") @db.VarChar(50)
  name        String?       @db.VarChar(100)
  // ... other existing fields
  
  @@index([farmId, tagNumber])
  @@index([farmId, rfidNumber])
  @@index([farmId, status])
  @@index([farmId, species])
  @@index([farmId, updatedAt])
  @@map("animals")
}
```

### 4.2 Raw SQL Migration (`apps/api/prisma/migrations/1_add_animal_rfid_uniqueness/migration.sql`)
```sql
-- AlterTable: Add rfid_number column to animals
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "rfid_number" VARCHAR(50);

-- CreateIndex: Partial Unique Index for Active RFID transponders per farm
CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_farm_animal_rfid" 
ON "animals"("farm_id", "rfid_number") 
WHERE "deleted_at" IS NULL AND "rfid_number" IS NOT NULL;

-- CreateIndex: B-Tree lookup index for farm RFID scanning
CREATE INDEX IF NOT EXISTS "animals_farm_id_rfid_number_idx" 
ON "animals"("farm_id", "rfid_number");
```

### 4.3 Data Transfer Objects (`@vetralink/shared-types`)

#### `CheckTagAvailabilityDto`
```typescript
export interface CheckTagAvailabilityDto {
  tagNumber?: string;
  rfidNumber?: string;
  excludeAnimalId?: string;
}
```

#### `TagAvailabilityResponseDto`
```typescript
export interface TagAvailabilityResponseDto {
  tagNumber?: {
    value: string;
    isAvailable: boolean;
    conflictingAnimalId?: string;
  };
  rfidNumber?: {
    value: string;
    isAvailable: boolean;
    conflictingAnimalId?: string;
  };
}
```

### 4.4 API Endpoints
| HTTP Method | Route | Description | Required Roles |
|:---|:---|:---|:---|
| `GET` | `/api/v1/animals/check-tag` | Check availability of tagNumber and/or rfidNumber | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `GET` | `/api/v1/animals/lookup/:identifier` | Scan-to-lookup animal profile by visual tag OR electronic RFID | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `POST` | `/api/v1/animals` | Register animal with validated unique `tagNumber` and optional `rfidNumber` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |
| `PATCH` | `/api/v1/animals/:id` | Update animal including `tagNumber` and/or `rfidNumber` with collision pre-check | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` |

---

## 5. Security & Edge Cases

1. **Empty String Normalization**:
   - An empty string `""` or whitespace-only string for `rfidNumber` must be normalized to `null` before database insertion. Multiple `null` entries are permitted in PostgreSQL partial unique indexes, whereas empty strings would violate the unique constraint.
2. **Concurrency Race Conditions**:
   - While the domain service performs a pre-insert availability check, simultaneous registrations of the same RFID or ear tag within milliseconds are caught by PostgreSQL's `uq_active_farm_animal_tag` and `uq_active_farm_animal_rfid` constraints, mapped to a clean HTTP 409 Conflict.
3. **Cross-Tenant Isolation**:
   - A wand scanner scanning an RFID tag that exists on Farm B while logged into Farm A will return `404 Not Found`. Scanners can never view or modify animals outside their active tenant farm context.
4. **Tag Re-use After Archival**:
   - If an animal with RFID `982000123456789` is soft-deleted (`deletedAt IS NOT NULL`), the partial index allows a new animal on the same farm to be registered with that exact RFID transponder.
