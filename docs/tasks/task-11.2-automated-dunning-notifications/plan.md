# Task 11.2: 3-Stage Automated Dunning Retry Notifications Plan

## Prerequisites
- Monorepo packages build cleanly (`@vetralink/shared-types`, `apps/api`).
- SubscriptionsModule, BullMQ, PrismaService, and MailModule operational.
- Task 11.1 (webhook handler marking subscriptions `PAST_DUE`) completed.

---

## Implementation Steps

- [x] **Step 1: Enums & DTOs in `@vetralink/shared-types`**
  - Define `DunningStage` (`DAY_1`, `DAY_3`, `DAY_7`).
  - Define `DunningChannel` (`EMAIL`, `SMS`, `IN_APP`).
  - Define `DunningStatus` (`PENDING`, `SENT`, `FAILED`, `SKIPPED`).
  - Define DTOs: `SubscriptionDunningLogDto`, `TriggerDunningScanDto`, `DunningScanResultDto`, `DunningScanDetailDto`, `QueryDunningLogsDto`, `DunningJobPayload`.
  - Export from `packages/shared-types` and run build.

- [x] **Step 2: Database Schema & Migration (`apps/api/prisma`)**
  - Update `schema.prisma` with `DunningStage`, `DunningChannel`, `DunningStatus` enums and `SubscriptionDunningLog` model.
  - Add relations to `Subscription`, `User`, `Farm`.
  - Create migration SQL: `20260920170000_add_subscription_dunning_logs/migration.sql`.

- [x] **Step 3: Domain Entities & Methods (`apps/api/src/modules/subscriptions/entities`)**
  - Create `SubscriptionDunningLogEntity` domain entity with validation and conversion methods.
  - Update `SubscriptionEntity` with `calculateDunningStage(now: Date): DunningStage | null`.
  - Unit tests for domain entity and stage calculation logic.

- [x] **Step 4: Repositories & Data Access (`apps/api/src/modules/subscriptions/repositories`)**
  - Create `ISubscriptionDunningLogRepository` interface and `SubscriptionDunningLogRepository` implementation.
  - Enhance `ISubscriptionRepository` and `SubscriptionRepository` with `findPastDueSubscriptions()`.

- [x] **Step 5: Email Templates (`apps/api/src/modules/subscriptions/templates`)**
  - Create `dunning-email.template.ts` with responsive HTML and plaintext generators for `DAY_1`, `DAY_3`, and `DAY_7`.

- [x] **Step 6: Dunning Services & BullMQ Queue (`apps/api/src/modules/subscriptions/services`)**
  - Create `ISubscriptionDunningService` and `SubscriptionDunningService`.
  - Create `ISubscriptionDunningQueueService` and `SubscriptionDunningQueueService` with repeatable daily cron (`0 7 * * *`).
  - Create `SubscriptionDunningProcessor` BullMQ worker.
  - Wire immediate Day 1 dispatch in `SubscriptionWebhookService` upon `invoice.payment_failed`.

- [x] **Step 7: Controller & Module Wiring (`apps/api/src/modules/subscriptions`)**
  - Create `SubscriptionDunningController` with endpoints:
    - `POST /api/v1/subscriptions/dunning/scan` (Manual scan)
    - `GET /api/v1/subscriptions/dunning/logs` (Query logs)
    - `POST /api/v1/subscriptions/dunning/dispatch` (Direct stage dispatch)
  - Register queue, services, processor, repository, controller in `SubscriptionsModule`.

- [x] **Step 8: Unit & Integration Tests Verification**
  - Write test suites for `SubscriptionDunningService`, `SubscriptionDunningQueueService`, `SubscriptionDunningController`, and `SubscriptionDunningProcessor`.
  - Run `pnpm test` across the monorepo to verify full pass.
  - Mark checklist items complete in `plan.md` and update `ROADMAP.md`.

---

## Verification & Acceptance Criteria

1. **Stage Calculation Accuracy**:
   - Day 1: 0–2 days past due -> `DAY_1`.
   - Day 3: 3–6 days past due -> `DAY_3`.
   - Day 7: >= 7 days past due -> `DAY_7`.
   - Non-past-due subscriptions -> `null`.
2. **Idempotency & Deduplication**:
   - Multiple scan executions on the same day do not dispatch duplicate emails for the same stage.
3. **Template Content**:
   - Day 1 email indicates grace period is active with Stripe Portal link.
   - Day 3 email indicates grace period expiring today with urgent warning.
   - Day 7 email indicates account suspension / final notice.
4. **Audit Logging**:
   - Emits `DUNNING_NOTIFICATION_SENT` / `DUNNING_NOTIFICATION_FAILED` with traceId.
