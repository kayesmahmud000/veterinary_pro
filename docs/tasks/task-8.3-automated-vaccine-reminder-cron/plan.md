# PLAN-803: Automated BullMQ Cron Task for Multi-Species Vaccine and Deworming Reminders Step-by-Step Execution Plan

## Prerequisites
- Working database and Redis containers.
- Existing `VaccineRecord` table and `VaccineScheduleService` from Task 8.2.
- All existing test suites passing (104/104 suites passing, 973 tests passing).

---

## Granular Implementation Checklist

### Step 1: Shared Enums, Types & DTO Contracts (`packages/shared-types`)
- [x] Add `ReminderChannel` (`SMS`, `PUSH`) in `packages/shared-types/src/enums/`
- [x] Add `ReminderMilestone` (`SEVEN_DAYS`, `THREE_DAYS`, `DUE_TODAY`, `OVERDUE`) in `packages/shared-types/src/enums/`
- [x] Add `ReminderStatus` (`PENDING`, `SENT`, `FAILED`, `SKIPPED`) in `packages/shared-types/src/enums/`
- [x] Export enums in `packages/shared-types/src/enums/index.ts`
- [x] Create DTOs in `packages/shared-types/src/dto/clinical-health/`:
  - `vaccine-reminder-job-payload.dto.ts`
  - `schedule-scan-result.dto.ts`
  - `trigger-reminder-scan.dto.ts`
  - `vaccine-reminder-log-response.dto.ts`
  - `vaccine-reminder-log-query.dto.ts`
- [x] Export DTOs from `packages/shared-types/src/dto/clinical-health/index.ts` and rebuild `@vetralink/shared-types`

### Step 2: Database Schema & Migration
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add enums: `ReminderChannel`, `ReminderMilestone`, `ReminderStatus`
  - Add model: `VaccineReminderLog`
  - Add reverse relations on `Farm`, `VaccineRecord`, `Animal`, and `User`
  - Add composite unique index `@@unique([vaccineRecordId, milestone, channel, dispatchedDate])`
  - Add composite indexes:
    - `@@index([farmId, dispatchedAt])`
    - `@@index([farmId, animalId])`
- [x] Author migration SQL `apps/api/prisma/migrations/20260913090000_add_vaccine_reminder_logs/migration.sql`
- [x] Run `prisma generate` in `apps/api`

### Step 3: Domain Entity & Data Access Repository
- [x] Implement `VaccineReminderLogEntity` in `apps/api/src/modules/clinical-health/entities/vaccine-reminder-log.entity.ts`
- [x] Write unit tests for `VaccineReminderLogEntity` in `apps/api/src/modules/clinical-health/entities/vaccine-reminder-log.entity.spec.ts`
- [x] Define `IVaccineReminderLogRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-reminder-log.repository.interface.ts`
- [x] Implement `VaccineReminderLogRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-reminder-log.repository.ts`
- [x] Write unit tests for `VaccineReminderLogRepository` in `apps/api/src/modules/clinical-health/repositories/vaccine-reminder-log.repository.spec.ts`

### Step 4: Notification Providers & Notification Service
- [x] Define `ISmsNotificationProvider` and `IPushNotificationProvider` in `apps/api/src/modules/clinical-health/providers/`
- [x] Implement `MockSmsNotificationProvider` and `MockPushNotificationProvider`
- [x] Define `IVaccineNotificationService` in `apps/api/src/modules/clinical-health/services/vaccine-notification.service.interface.ts`
- [x] Implement `VaccineNotificationService` in `apps/api/src/modules/clinical-health/services/vaccine-notification.service.ts`:
  - Message templating for SMS and Push notifications per species, milestone, and vaccine
  - Recipient resolution from active farm members
  - Idempotent dispatch check against `VaccineReminderLogRepository`
  - Recording of sent/failed/skipped logs
- [x] Write unit tests for `VaccineNotificationService` in `apps/api/src/modules/clinical-health/services/vaccine-notification.service.spec.ts`

### Step 5: BullMQ Queue Service & Processor (Worker & Repeatable Cron)
- [x] Define `IVaccineReminderQueueService` in `apps/api/src/modules/clinical-health/services/vaccine-reminder-queue.service.interface.ts`
- [x] Implement `VaccineReminderQueueService` in `apps/api/src/modules/clinical-health/services/vaccine-reminder-queue.service.ts`:
  - Register repeatable cron schedule (`0 6 * * *` daily at 06:00 UTC)
  - Method `dispatchFarmScan(farmId, ...)`
  - Method `dispatchAllFarmsScan(...)`
  - Method `dispatchIndividualReminder(...)`
- [x] Implement `VaccineReminderProcessor` in `apps/api/src/modules/clinical-health/processors/vaccine-reminder.processor.ts`:
  - Handles `SCAN_ALL_FARMS`, `SCAN_FARM`, and `DISPATCH_REMINDER`
- [x] Write unit tests for `VaccineReminderQueueService` and `VaccineReminderProcessor`

### Step 6: Controller & API Wiring
- [x] Implement DTOs in `apps/api/src/modules/clinical-health/dto/`:
  - `trigger-reminder-scan.dto.ts`
  - `vaccine-reminder-log-query.dto.ts`
- [x] Add endpoints to `VaccineScheduleController`:
  - `POST /api/v1/clinical-health/vaccinations/reminders/scan`
  - `GET /api/v1/clinical-health/vaccinations/reminders/logs`
- [x] Register BullMQ queue, providers, services, repositories, and processors in `ClinicalHealthModule`
- [x] Write controller unit tests

### Step 7: Verification & Acceptance Testing
- [x] Run full test suites (`pnpm --filter @vetralink/api test`)
- [x] Run monorepo build (`pnpm build`)
- [x] Update `plan.md` and `ROADMAP.md`
