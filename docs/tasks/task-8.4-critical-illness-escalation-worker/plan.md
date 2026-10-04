# PLAN-804: Escalation Worker for Unresolved Critical and High Severity Illnesses Step-by-Step Execution Plan

## Prerequisites
- Working database and Redis containers.
- Existing `HealthRecord` table and repository from Task 8.1.
- All existing test suites passing (109/109 suites passing, 1004 tests passing).

---

## Granular Implementation Checklist

### Step 1: Shared Enums, Types & DTO Contracts (`packages/shared-types`)
- [x] Add `HealthEscalationLevel` (`LEVEL_1_STAFF_ALERT`, `LEVEL_2_OWNER_ALERT`, `LEVEL_3_EMERGENCY_INTERVENTION`) in `packages/shared-types/src/enums/`
- [x] Add `HealthEscalationAction` (`NOTIFY_VET_HERDSMAN`, `NOTIFY_FARM_OWNER`, `RECOMMEND_QUARANTINE`) in `packages/shared-types/src/enums/`
- [x] Export enums in `packages/shared-types/src/enums/index.ts`
- [x] Create DTOs in `packages/shared-types/src/dto/clinical-health/`:
  - `health-escalation-job-payload.dto.ts`
  - `escalation-scan-result.dto.ts`
  - `trigger-escalation-scan.dto.ts`
  - `health-escalation-log-response.dto.ts`
  - `health-escalation-log-query.dto.ts`
- [x] Export DTOs from `packages/shared-types/src/dto/clinical-health/index.ts` and rebuild `@vetralink/shared-types`

### Step 2: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add enums: `HealthEscalationLevel`, `HealthEscalationAction`
  - Update `HealthRecord` model: add `escalationLevel Int @default(0)`, `lastEscalatedAt DateTime?`, `escalations HealthIncidentEscalationLog[]`
  - Add model: `HealthIncidentEscalationLog`
  - Add reverse relations on `Farm`, `Animal`, `User`
  - Add composite unique index `@@unique([healthRecordId, level, channel])`
  - Add composite indexes: `@@index([farmId, dispatchedAt])`, `@@index([healthRecordId])`
- [x] Author migration SQL `apps/api/prisma/migrations/20260913100000_add_health_incident_escalations/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Update `HealthRecordEntity`: support `escalationLevel` and `lastEscalatedAt`
- [x] Implement `HealthEscalationLogEntity` in `apps/api/src/modules/clinical-health/entities/health-escalation-log.entity.ts`
- [x] Write unit tests for `HealthEscalationLogEntity` in `apps/api/src/modules/clinical-health/entities/health-escalation-log.entity.spec.ts`
- [x] Define `IHealthEscalationLogRepository` in `apps/api/src/modules/clinical-health/repositories/health-escalation-log.repository.interface.ts`
- [x] Implement `HealthEscalationLogRepository` in `apps/api/src/modules/clinical-health/repositories/health-escalation-log.repository.ts`
- [x] Write unit tests for `HealthEscalationLogRepository` in `apps/api/src/modules/clinical-health/repositories/health-escalation-log.repository.spec.ts`
- [x] Extend `IHealthRecordRepository` and `HealthRecordRepository` with query for unresolving critical/high incidents: `findUnresolvedCriticalCases(farmId?, asOfDate?)`

### Step 4: Escalation Domain Service
- [x] Define `IHealthEscalationService` in `apps/api/src/modules/clinical-health/services/health-escalation.service.interface.ts`
- [x] Implement `HealthEscalationService` in `apps/api/src/modules/clinical-health/services/health-escalation.service.ts`:
  - SLA determination: hours unresolved vs severity thresholds
  - Escalation tier evaluation (`LEVEL_1`, `LEVEL_2`, `LEVEL_3`)
  - Recipient resolution: attending vet, herdsman, farm owner
  - Multi-channel notification dispatch via SMS & Push providers
  - Escalation record persistence and `HealthRecord` escalation level update
  - Query methods for active escalations and historical logs
- [x] Write unit tests for `HealthEscalationService` in `apps/api/src/modules/clinical-health/services/health-escalation.service.spec.ts`

### Step 5: BullMQ Queue Service & Processor
- [x] Define `IHealthEscalationQueueService` in `apps/api/src/modules/clinical-health/services/health-escalation-queue.service.interface.ts`
- [x] Implement `HealthEscalationQueueService` in `apps/api/src/modules/clinical-health/services/health-escalation-queue.service.ts`:
  - Register repeatable cron schedule (`0 */6 * * *` every 6 hours)
  - Method `dispatchFarmEscalationScan(farmId, ...)`
  - Method `dispatchAllFarmsEscalationScan(...)`
- [x] Implement `HealthEscalationProcessor` in `apps/api/src/modules/clinical-health/processors/health-escalation.processor.ts`:
  - Handles `SCAN_ALL_FARMS` and `SCAN_FARM`
- [x] Write unit tests for `HealthEscalationQueueService` and `HealthEscalationProcessor`

### Step 6: Controller & API Routing
- [x] Implement DTOs in `apps/api/src/modules/clinical-health/dto/`:
  - `trigger-escalation-scan.dto.ts`
  - `health-escalation-log-query.dto.ts`
- [x] Add endpoints to `ClinicalHealthController`:
  - `POST /api/v1/clinical-health/incidents/escalations/scan`
  - `GET /api/v1/clinical-health/incidents/escalations/logs`
  - `GET /api/v1/clinical-health/incidents/escalations/active`
- [x] Register BullMQ queue, services, repositories, and processor in `ClinicalHealthModule`
- [x] Write controller unit tests

### Step 7: Verification & Acceptance Testing
- [x] Run full test suites (`pnpm --filter @vetralink/api test`: 114/114 suites, 1042/1042 tests passed)
- [x] Run monorepo build (`pnpm build`: 3/3 packages built cleanly)
- [x] Update `plan.md` and `ROADMAP.md`
