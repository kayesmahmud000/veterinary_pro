# PLAN-801: Clinical Health Incident Logging Step-by-Step Execution Plan

## Prerequisites
- Working Docker Compose environment (PostgreSQL 16, Redis 7).
- Existing `HealthRecord` model and enums in Prisma schema.
- All pre-existing test suites passing (96/96 suites passing).

---

## Granular Implementation Checklist

### Step 1: Type Contracts & DTOs in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/clinical-health/create-health-incident.dto.ts`
- [x] Create `packages/shared-types/src/dto/clinical-health/update-health-incident.dto.ts`
- [x] Create `packages/shared-types/src/dto/clinical-health/resolve-health-incident.dto.ts`
- [x] Create `packages/shared-types/src/dto/clinical-health/health-incident-query.dto.ts`
- [x] Create `packages/shared-types/src/dto/clinical-health/health-incident-response.dto.ts`
- [x] Export all DTOs from `packages/shared-types/src/dto/clinical-health/index.ts` and `packages/shared-types/src/dto/index.ts`
- [x] Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`)

### Step 2: Database Schema & Composite Indexes
- [x] Update `apps/api/prisma/schema.prisma` with composite indexes on `health_records`:
  - `@@index([farmId, animalId, createdAt])`
  - `@@index([farmId, severity, resolvedAt])`
  - `@@index([farmId, eventType, createdAt])`
- [x] Create migration script `apps/api/prisma/migrations/20260913070000_add_health_records_composite_indexes/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Implement `HealthRecordEntity` in `apps/api/src/modules/clinical-health/entities/health-record.entity.ts` with business invariants
- [x] Write unit tests for `HealthRecordEntity` in `apps/api/src/modules/clinical-health/entities/health-record.entity.spec.ts`
- [x] Define `IHealthRecordRepository` interface in `apps/api/src/modules/clinical-health/repositories/health-record.repository.interface.ts`
- [x] Implement `HealthRecordRepository` with Prisma wrapping in `apps/api/src/modules/clinical-health/repositories/health-record.repository.ts`
- [x] Write unit tests for `HealthRecordRepository` in `apps/api/src/modules/clinical-health/repositories/health-record.repository.spec.ts`

### Step 4: API DTOs (Validation & Swagger)
- [x] Create class-validator DTOs with `@ApiProperty()` in `apps/api/src/modules/clinical-health/dto/`:
  - `create-health-incident.dto.ts`
  - `update-health-incident.dto.ts`
  - `resolve-health-incident.dto.ts`
  - `health-incident-query.dto.ts`

### Step 5: Domain Service & Business Logic
- [x] Define `IClinicalHealthService` interface in `apps/api/src/modules/clinical-health/services/clinical-health.service.interface.ts`
- [x] Implement `ClinicalHealthService` in `apps/api/src/modules/clinical-health/services/clinical-health.service.ts`:
  - Multi-tenant boundary checks
  - Animal existence and soft-delete verification
  - Attending veterinarian validation
  - Optimistic concurrency control via `syncVersion`
  - ACID transactions with `AuditLog` records for `CREATE`, `UPDATE`, `RESOLVE`, `DELETE`
- [x] Write comprehensive unit tests for `ClinicalHealthService` in `apps/api/src/modules/clinical-health/services/clinical-health.service.spec.ts`

### Step 6: Controller & API Routing
- [x] Implement `ClinicalHealthController` in `apps/api/src/modules/clinical-health/clinical-health.controller.ts`:
  - `POST /api/v1/clinical-health/incidents`
  - `GET /api/v1/clinical-health/incidents`
  - `GET /api/v1/clinical-health/incidents/:id`
  - `PATCH /api/v1/clinical-health/incidents/:id`
  - `PATCH /api/v1/clinical-health/incidents/:id/resolve`
  - `DELETE /api/v1/clinical-health/incidents/:id`
  - Guards: `JwtAuthGuard`, `TenantGuard`, `RolesGuard`
- [x] Write unit tests for `ClinicalHealthController` in `apps/api/src/modules/clinical-health/clinical-health.controller.spec.ts`
- [x] Wire `ClinicalHealthModule` in `apps/api/src/modules/clinical-health/clinical-health.module.ts` and register in `apps/api/src/app.module.ts`

### Step 7: Verification & Acceptance Testing
- [x] Execute Jest test suites across the monorepo (`pnpm --filter @vetralink/api test` - 100/100 suites passed, 932 tests passed)
- [x] Run build checks (`pnpm build` - all 3 packages built successfully)
- [x] Mark checklist items complete in `plan.md` and update `ROADMAP.md`
