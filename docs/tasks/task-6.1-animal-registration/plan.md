# PLAN-601: Step-by-Step Execution Plan for Multi-Species Animal Registration

## 1. Prerequisites & Dependencies
- [x] Ensure Prisma schema has `Animal` model and `uq_active_farm_animal_tag` partial index.
- [x] Ensure `FarmsModule`, `AuditModule`, `TenantGuard`, and `@CurrentFarm` decorator are functional.
- [x] Clean build of `@vetralink/shared-types`.

---

## 2. Implementation Checklist

### Step 1: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/animals/register-animal.dto.ts`:
  - `RegisterAnimalDto` with validation constraints (tagNumber, species, breed, gender, dateOfBirth, weightKg, status, sireId, damId, metadata).
- [x] Create `packages/shared-types/src/dto/animals/update-animal.dto.ts`:
  - `UpdateAnimalDto` with optional fields.
- [x] Create `packages/shared-types/src/dto/animals/animal-query.dto.ts`:
  - `AnimalQueryDto` for filtering and pagination.
- [x] Create `packages/shared-types/src/dto/animals/animal-response.dto.ts`:
  - `AnimalResponseDto` and `PaginatedAnimalsDto`.
- [x] Export new DTOs from `packages/shared-types/src/dto/animals/index.ts`, `packages/shared-types/src/dto/index.ts`, and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Domain Entity & Repository Layer (`apps/api`)
- [x] Create `apps/api/src/modules/animals/entities/animal.entity.ts`:
  - Pure domain entity `AnimalEntity` with factory `create()` and `reconstitute()`.
  - Encapsulate domain rules: `isActive()`, `isFemale()`, `isMale()`, `canProduceMilk()`, `calculateAgeMonths()`.
- [x] Create `apps/api/src/modules/animals/repositories/animal.repository.interface.ts`:
  - Define `IAnimalRepository`, `ANIMAL_REPOSITORY` injection token, and query filter interfaces.
- [x] Create `apps/api/src/modules/animals/repositories/animal.repository.ts`:
  - Implement `IAnimalRepository` via `PrismaService`.
  - Ensure all database queries enforce `farmId` tenant scoping and soft-deletion filtering (`deletedAt: null`).

### Step 3: Domain Service Layer
- [x] Create `apps/api/src/modules/animals/services/animals.service.interface.ts`:
  - Define `IAnimalsService` and `ANIMALS_SERVICE` injection token.
- [x] Create `apps/api/src/modules/animals/services/animals.service.ts`:
  - Implement animal registration with tag uniqueness pre-check, pedigree validation (sire/dam biological gender and farm matching), and audit log recording.
  - Implement paginated querying, single animal retrieval with lineage preview, updates, and soft-delete/archival.

### Step 4: Controller Layer & Module Wiring
- [x] Create `apps/api/src/modules/animals/animals.controller.ts`:
  - Protected by `JwtAuthGuard` and `TenantGuard`.
  - Endpoints:
    - `POST /api/v1/animals`: Register animal with `@FarmRoles(OWNER, MANAGER, HERDSMAN, VET_STAFF)`.
    - `GET /api/v1/animals`: Paginated query with filters.
    - `GET /api/v1/animals/:id`: Single animal profile.
    - `PATCH /api/v1/animals/:id`: Update animal.
    - `DELETE /api/v1/animals/:id`: Soft delete / archive animal with `@FarmRoles(OWNER, MANAGER)`.
- [x] Create `apps/api/src/modules/animals/animals.module.ts`:
  - Import `PrismaModule`, `AuditModule`, `FarmsModule`.
  - Register providers and export `ANIMALS_SERVICE`, `ANIMAL_REPOSITORY`.
- [x] Create `apps/api/src/modules/animals/index.ts`.
- [x] Update `apps/api/src/app.module.ts`:
  - Import `AnimalsModule`.

### Step 5: Unit & Integration Tests
- [x] Create `apps/api/src/modules/animals/entities/animal.entity.spec.ts`:
  - Test domain entity rules (milk production eligibility, age calculation, status checks).
- [x] Create `apps/api/src/modules/animals/repositories/animal.repository.spec.ts`:
  - Unit test repository mapping, tenant scoping, and soft-delete filtering.
- [x] Create `apps/api/src/modules/animals/services/animals.service.spec.ts`:
  - Test registration validations (duplicate tag error, invalid sire/dam gender error, audit emission).
- [x] Create `apps/api/src/modules/animals/animals.controller.spec.ts`:
  - Controller unit tests validating HTTP status codes and parameter mapping.
- [x] Create `apps/api/src/modules/animals/animals.int.spec.ts`:
  - Integration tests with `TenantGuard`, simulating member vs non-member and role restrictions.

### Step 6: Full Verification & Roadmap Update
- [x] Run test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 6.1 in `ROADMAP.md` and present conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **Multi-Species Support**: Successfully registers livestock across `COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`, `POULTRY`.
2. **Tenant Isolation**: Attempts to access or create an animal for a farm where the user is not a member return `403 Forbidden`. Queries for animals belonging to other farms return `404 Not Found`.
3. **Duplicate Tag Prevention**: Registering two active animals with the same `tagNumber` on the same farm returns `409 Conflict`. Registering the same `tagNumber` after an animal is soft-deleted succeeds.
4. **Pedigree Invariants**: Specifying a female animal as `sireId` or a male animal as `damId` returns `422 Unprocessable Entity`. Specifying a sire or dam from another farm returns `404 Not Found`.
5. **Zero Regression**: 100% test pass rate across all new and existing test suites.
