# PLAN-603: Step-by-Step Execution Plan for Animal Lineage Graph & Pedigree Traversal

## 1. Prerequisites & Dependencies
- [x] Task 6.2 completed, verified, and checked off.
- [x] PostgreSQL connection and Prisma client active.
- [x] Workspace builds cleanly with zero errors.

---

## 2. Implementation Checklist

### Step 1: Database Schema & Migration (`apps/api`)
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `@@index([farmId, sireId])` and `@@index([farmId, damId])` to `Animal` model.
- [x] Create Prisma migration SQL `apps/api/prisma/migrations/20260913010000_add_animal_pedigree_indexes/migration.sql`:
  - `CREATE INDEX IF NOT EXISTS "animals_farm_id_sire_id_idx" ON "animals"("farm_id", "sire_id");`
  - `CREATE INDEX IF NOT EXISTS "animals_farm_id_dam_id_idx" ON "animals"("farm_id", "dam_id");`
- [x] Re-generate Prisma Client (`pnpm --filter @vetralink/api exec prisma generate`).

### Step 2: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/animals/animal-lineage.dto.ts`:
  - Define `PedigreeNodeDto`, `OffspringSummaryDto`, `AnimalLineageDto`, `InbreedingRiskLevel`.
- [x] Export `animal-lineage.dto.ts` in `packages/shared-types/src/dto/animals/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: Repository Layer Updates (`apps/api`)
- [x] Update `apps/api/src/modules/animals/repositories/animal.repository.interface.ts`:
  - Add `findAncestors(id: string, farmId: string, maxGenerations: number, tx?: Prisma.TransactionClient): Promise<AncestorRecordRaw[]>;`
  - Add `findDirectOffspring(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<OffspringRecordRaw[]>;`
- [x] Update `apps/api/src/modules/animals/repositories/animal.repository.ts`:
  - Implement `findAncestors` using PostgreSQL Recursive CTE (`WITH RECURSIVE`).
  - Implement `findDirectOffspring` joining the other parent for name and tag details.

### Step 4: Domain Service Layer & Graph Assembler (`apps/api`)
- [x] Update `apps/api/src/modules/animals/services/animals.service.interface.ts`:
  - Add `getAnimalLineage(id: string, farmId: string, generations?: number): Promise<AnimalLineageDto>;`
- [x] Update `apps/api/src/modules/animals/services/animals.service.ts`:
  - Verify animal existence in tenant farm.
  - Call repository to fetch recursive ancestors and direct offspring.
  - Assemble hierarchical `PedigreeNodeDto` tree from flat ancestor rows with cycle protection.
  - Calculate Wright's Inbreeding Coefficient ($F_X$) and assign inbreeding risk category (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
  - Return complete `AnimalLineageDto`.

### Step 5: Controller & API Endpoint (`apps/api`)
- [x] Create `apps/api/src/modules/animals/dto/animal-lineage-query.dto.ts`:
  - Swagger & class-validator DTO for `generations` query param (default 3, min 1, max 5).
- [x] Update `apps/api/src/modules/animals/animals.controller.ts`:
  - Add `GET /api/v1/animals/:id/lineage` endpoint with `@Roles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.HERDSMAN, FarmRole.VET_STAFF)`.

### Step 6: Unit & Integration Tests
- [x] Update `animal.repository.spec.ts`:
  - Test `findAncestors` recursive CTE query and `findDirectOffspring`.
- [x] Update `animals.service.spec.ts`:
  - Test pedigree tree building, multi-generation mapping, cycle handling, inbreeding coefficient calculation, and offspring aggregation.
- [x] Update `animals.controller.spec.ts`:
  - Unit test `GET /animals/:id/lineage` route handler.
- [x] Update `animals.int.spec.ts`:
  - Supertest integration tests for `GET /animals/:id/lineage` (tenant check, query parameter limits, RBAC, successful 200 payload).

### Step 7: Verification & Build
- [x] Run test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 6.3 in `ROADMAP.md` and present conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **Multi-Generation Traversal:** Correctly traverses up to 5 generations of ancestors (parents, grandparents, great-grandparents).
2. **Hierarchical Graph Construction:** Returns nested `sire` and `dam` branches with accurate generation numbers and animal attributes.
3. **Inbreeding Calculation:** Computes accurate Wright's Inbreeding Coefficient ($F_X$) when common ancestors exist between sire and dam lines.
4. **Progeny Tracking:** Returns all direct offspring with other parent metadata and status.
5. **Cycle Guard:** Safeguards against infinite graph traversal if bad data or circular relationships exist.
6. **Zero Regression:** 100% test pass rate across all unit and integration test suites.
