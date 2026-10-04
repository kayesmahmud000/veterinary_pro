# PLAN-602: Step-by-Step Execution Plan for Ear Tag & RFID Uniqueness Engine

## 1. Prerequisites & Dependencies
- [x] Task 6.1 completed and verified.
- [x] Prisma CLI and PostgreSQL connection active.
- [x] Turborepo workspace clean build.

---

## 2. Implementation Checklist

### Step 1: Database Schema & Migration (`apps/api`)
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `rfidNumber String? @map("rfid_number") @db.VarChar(50)` to `Animal` model.
  - Add `@@index([farmId, rfidNumber])` index.
- [x] Create Prisma migration SQL `apps/api/prisma/migrations/20260913000000_add_animal_rfid_uniqueness/migration.sql`:
  - `ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "rfid_number" VARCHAR(50);`
  - `CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_farm_animal_rfid" ON "animals"("farm_id", "rfid_number") WHERE "deleted_at" IS NULL AND "rfid_number" IS NOT NULL;`
  - `CREATE INDEX IF NOT EXISTS "animals_farm_id_rfid_number_idx" ON "animals"("farm_id", "rfid_number");`
- [x] Re-generate Prisma Client (`pnpm --filter @vetralink/api exec prisma generate`).

### Step 2: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Update `packages/shared-types/src/dto/animals/register-animal.dto.ts`:
  - Add `rfidNumber?: string | null;`
- [x] Update `packages/shared-types/src/dto/animals/update-animal.dto.ts`:
  - Add `rfidNumber?: string | null;`
- [x] Update `packages/shared-types/src/dto/animals/animal-response.dto.ts`:
  - Add `rfidNumber: string | null;`
- [x] Create `packages/shared-types/src/dto/animals/tag-availability.dto.ts`:
  - `CheckTagAvailabilityDto` and `TagAvailabilityResponseDto`.
- [x] Export new contracts in `packages/shared-types/src/dto/animals/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: Domain Entity Updates (`apps/api`)
- [x] Update `apps/api/src/modules/animals/entities/animal.entity.ts`:
  - Add `_rfidNumber: string | null;` property and getter `rfidNumber`.
  - Normalize `rfidNumber` (trim, uppercase, empty string coerced to null).
  - Add validation: if present, length 1-50 characters.
  - Update `create()`, `reconstitute()`, `updateDetails()`, and `toResponse()`.

### Step 4: Repository Layer Updates (`apps/api`)
- [x] Update `apps/api/src/modules/animals/repositories/animal.repository.interface.ts`:
  - Add `findByRfidNumber(rfidNumber: string, farmId: string, tx?: Prisma.TransactionClient): Promise<AnimalEntity | null>;`
  - Add `findByIdentifier(identifier: string, farmId: string, tx?: Prisma.TransactionClient): Promise<AnimalEntity | null>;`
  - Add `existsActiveRfid(rfidNumber: string, farmId: string, excludeId?: string, tx?: Prisma.TransactionClient): Promise<boolean>;`
- [x] Update `apps/api/src/modules/animals/repositories/animal.repository.ts`:
  - Implement `findByRfidNumber`, `findByIdentifier` (checks tagNumber OR rfidNumber), and `existsActiveRfid`.
  - In `create` and `update`: persist `rfidNumber` and catch P2002 constraint violations for `uq_active_farm_animal_rfid`.

### Step 5: Domain Service Layer Updates (`apps/api`)
- [x] Update `apps/api/src/modules/animals/services/animals.service.interface.ts`:
  - Add `lookupByIdentifier(identifier: string, farmId: string): Promise<AnimalResponseDto>;`
  - Add `checkTagAvailability(farmId: string, dto: CheckTagAvailabilityDto): Promise<TagAvailabilityResponseDto>;`
- [x] Update `apps/api/src/modules/animals/services/animals.service.ts`:
  - In `registerAnimal`: if `dto.rfidNumber` provided, check `existsActiveRfid(dto.rfidNumber, farmId)`. Throw `EntityConflictException` if taken.
  - In `updateAnimal`: if `dto.rfidNumber` changed, check `existsActiveRfid(dto.rfidNumber, farmId, id)`. Throw `EntityConflictException` if taken.
  - Implement `lookupByIdentifier`: query `findByIdentifier(identifier, farmId)`. If not found, throw `EntityNotFoundException`.
  - Implement `checkTagAvailability`: check both `tagNumber` and `rfidNumber` availability in tenant farm herd.

### Step 6: Controller Layer & API Endpoints (`apps/api`)
- [x] Update `apps/api/src/modules/animals/dto/register-animal.dto.ts` & `update-animal.dto.ts`:
  - Add `@ApiPropertyOptional()` and `@IsString()`, `@MaxLength(50)` for `rfidNumber`.
- [x] Create `apps/api/src/modules/animals/dto/tag-availability.dto.ts`:
  - NestJS Swagger DTOs for `CheckTagAvailabilityDto`.
- [x] Update `apps/api/src/modules/animals/animals.controller.ts`:
  - Add `GET /api/v1/animals/check-tag`: Query tag availability.
  - Add `GET /api/v1/animals/lookup/:identifier`: Rapid scan-to-lookup endpoint.

### Step 7: Unit & Integration Tests
- [x] Update `animal.entity.spec.ts`: Test RFID normalization, validation, and serialization.
- [x] Update `animal.repository.spec.ts`: Test `findByRfidNumber`, `findByIdentifier`, `existsActiveRfid`, and RFID P2002 conflict handling.
- [x] Update `animals.service.spec.ts`: Test RFID duplicate checks, lookup, and availability responses.
- [x] Update `animals.controller.spec.ts`: Unit test lookup and check-tag endpoints.
- [x] Update `animals.int.spec.ts`: Supertest integration tests for `/animals/lookup/:identifier` and `/animals/check-tag`.

### Step 8: Full Verification & Roadmap Update
- [x] Run test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 6.2 in `ROADMAP.md` and present conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **RFID Field & Indexing**: Animals store `rfidNumber` with tenant-isolated partial unique constraint preventing duplicate active RFIDs on the same farm.
2. **Scan-to-Lookup**: `GET /api/v1/animals/lookup/:identifier` resolves an animal in O(1) time whether scanned with a visual ear tag (e.g., `COW-104`) or an electronic RFID transponder (e.g., `982000123456789`).
3. **Availability Verification**: `GET /api/v1/animals/check-tag` accurately reports `isAvailable: true/false` for both tags and RFIDs without modifying data.
4. **Collision Handling**: Attempting to register or update an animal with an RFID or ear tag already in use by an active animal returns `409 Conflict`.
5. **Archival Reusability**: After an animal is soft-deleted, its visual tag and electronic RFID can be successfully reassigned to a new animal.
6. **Zero Regression**: 100% test pass rate across all unit and integration test suites.
