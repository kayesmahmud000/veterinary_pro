# PLAN-605: Step-by-Step Execution Plan for Bulk CSV/Excel Animal Import

## 1. Prerequisites & Dependencies
- [x] Task 6.4 completed and verified.
- [x] PostgreSQL connection and Prisma client active.
- [x] Redis 7 running and accessible by BullMQ.
- [x] Install `xlsx` (SheetJS) and `@types/multer` in `@vetralink/api`.

---

## 2. Implementation Checklist

### Step 1: Dependencies & Database Schema (`apps/api`)
- [x] Install dependencies in `apps/api`:
  - `xlsx` for CSV and Excel workbook parsing.
  - `@types/multer` in devDependencies for file upload typing.
- [x] Update `apps/api/prisma/schema.prisma`:
  - Define `enum ImportJobStatus { PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED }`.
  - Add `model AnimalImportJob` with fields, cascade deletes, and composite indexes.
  - Add relation `animalImportJobs AnimalImportJob[]` to `Farm` model.
  - Add relation `animalImportJobs AnimalImportJob[]` to `User` model.
- [x] Generate Prisma migration SQL `apps/api/prisma/migrations/20260913030000_add_animal_import_jobs/migration.sql`.
- [x] Regenerate Prisma Client (`pnpm --filter @vetralink/api exec prisma generate`).

### Step 2: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Update `packages/shared-types/src/enums/index.ts`:
  - Add `ImportJobStatus` enum.
- [x] Create `packages/shared-types/src/dto/animals/bulk-import.dto.ts`:
  - Define `AnimalImportRowErrorDto`, `AnimalImportJobDto`, `PaginatedImportJobsDto`, `AnimalImportRowDto`.
- [x] Export in `packages/shared-types/src/dto/animals/index.ts` and build `@vetralink/shared-types`.

### Step 3: Domain Entity & Import Job Repository (`apps/api`)
- [x] Create `apps/api/src/modules/animals/entities/animal-import-job.entity.ts`:
  - Domain invariants, progress calculation, and response serialization.
- [x] Create `apps/api/src/modules/animals/repositories/animal-import-job.repository.interface.ts`:
  - `create(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity>;`
  - `findById(id: string, farmId: string): Promise<AnimalImportJobEntity | null>;`
  - `findByFarmId(farmId: string, options?: { page?: number; limit?: number }): Promise<{ items: AnimalImportJobEntity[]; total: number }>;`
  - `update(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity>;`
- [x] Implement `apps/api/src/modules/animals/repositories/animal-import-job.repository.ts`.
- [x] Bind `ANIMAL_IMPORT_JOB_REPOSITORY` in `animals.module.ts`.

### Step 4: BullMQ Queue, Service & Background Processor (`apps/api`)
- [x] Define queue token `ANIMAL_IMPORT_QUEUE = "animal-import"`.
- [x] Register `BullModule.registerQueue({ name: ANIMAL_IMPORT_QUEUE })` in `animals.module.ts`.
- [x] Create `apps/api/src/modules/animals/services/animal-import-queue.service.interface.ts` and implementation:
  - `enqueueImportJob(jobId: string, farmId: string, filePath: string, actorUserId: string): Promise<void>;`
- [x] Create `apps/api/src/modules/animals/processors/animal-import.processor.ts`:
  - Parses CSV/Excel using `xlsx.readFile` or `xlsx.read(buffer)`.
  - Normalizes header names (case-insensitive, trims spaces).
  - Iterates rows with best-effort error collection:
    - Validates row fields (tag, species, gender, dob, weight, rfid).
    - Checks file-internal tag duplicates and database tag duplicates.
    - Resolves `sireTag` and `damTag` against active herd.
    - Creates `AnimalEntity` and calls `animalRepository.create(...)`.
    - If `weightKg` is provided, creates initial `AnimalWeightLogEntity`.
  - Updates progress and counts on `AnimalImportJobEntity`.
  - Sets final status (`COMPLETED`, `PARTIALLY_COMPLETED`, or `FAILED`).
  - Cleans up ephemeral upload file from staging disk.
  - Records `ANIMAL_BULK_IMPORTED` audit log.

### Step 5: AnimalsService & Controller Endpoints (`apps/api`)
- [x] Update `IAnimalsService` and `AnimalsService`:
  - `createImportJob(farmId: string, file: Express.Multer.File, actorUserId: string): Promise<AnimalImportJobDto>;`
  - `getImportJob(jobId: string, farmId: string): Promise<AnimalImportJobDto>;`
  - `getImportJobs(farmId: string, page?: number, limit?: number): Promise<PaginatedImportJobsDto>;`
  - `generateImportTemplate(): string;`
- [x] Update `AnimalsController`:
  - `POST /api/v1/animals/import` with `UseInterceptors(FileInterceptor('file'))`.
  - `GET /api/v1/animals/import/jobs`
  - `GET /api/v1/animals/import/jobs/:jobId`
  - `GET /api/v1/animals/import/template`

### Step 6: Unit & Integration Tests
- [x] Create `animal-import-job.entity.spec.ts`: Entity invariants, progress calculation, and response mapping.
- [x] Create `animal-import-job.repository.spec.ts`: Repository CRUD, status updates, and tenant scoping.
- [x] Create `animal-import.processor.spec.ts`: Processor tests (successful CSV/Excel import, row validation errors, duplicate tags within file, parent tag resolution).
- [x] Update `animals.service.spec.ts`: Test queue dispatch, job lookup, and template generation.
- [x] Update `animals.controller.spec.ts`: Unit test controller import endpoints.
- [x] Update `animals.int.spec.ts`: Supertest integration tests for file upload, job status, job list, and template download.

### Step 7: Verification & Build
- [x] Run test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run production build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 6.5 in `ROADMAP.md` and suggest conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **Multi-Format Support**: Ingests standard `.csv`, modern `.xlsx`, and legacy `.xls` files.
2. **Background Processing**: API responds immediately with `202 Accepted` and `jobId`; parsing runs asynchronously in BullMQ worker.
3. **Fault-Tolerant ("Best-Effort") Ingestion**: Valid animals are inserted even when other rows contain typos or constraint violations.
4. **Actionable Error Reporting**: Detailed error report indicates exact row number, column name, rejected value, and reason for failure.
5. **Strict Multi-Tenancy**: Uniqueness checks, parent pedigree lookups, and job access are strictly isolated by `farmId`.
6. **Zero Regression**: 100% test pass rate across all animal unit and integration tests.
