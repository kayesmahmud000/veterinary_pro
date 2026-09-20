# Task 11.2: 3-Stage Automated Dunning Retry Notifications (Day 1, Day 3, Day 7) Specification

## 1. Feature Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech SaaS platform combining Livestock ERP, LMS/Digital Assets Store, and Tele-Veterinary Telehealth. Subscriptions renew automatically on a recurring basis (`MONTHLY` or `ANNUAL`). When a recurring renewal payment fails (e.g. expired credit card, insufficient funds, or payment gateway decline), the subscription enters a `PAST_DUE` status (implemented in Task 11.1).

Without an automated, structured dunning engine, failed payments quickly lead to involuntary churn, operational confusion for farm managers, and lost SaaS revenue. 

**Task 11.2** implements a robust, multi-tenant **3-Stage Automated Dunning Retry Notification Engine** powered by BullMQ distributed scheduling, multi-channel email templating, and idempotent tracking:

1. **Stage 1: Day 1 Notification (First Notice / Grace Period Active)**:
   - **Timing**: Triggered immediately upon initial `invoice.payment_failed` webhook or within 24 hours (Day 1).
   - **Tone & Message**: Courteous and reassuring. Informs the subscriber that their automatic renewal payment was unsuccessful. Emphasizes that their **3-day grace period is active** and farm operations remain fully uninterrupted.
   - **Call-to-Action (CTA)**: Direct secure link to the Stripe Customer Portal or payment method update page.

2. **Stage 2: Day 3 Notification (Second Notice / Grace Period Expiring)**:
   - **Timing**: Triggered on Day 3 (72 hours post-failure).
   - **Tone & Message**: Urgent advisory. Alerts the farm owner/manager that today is the final day of the 3-day grace period. Warns that failure to update billing details within 24 hours will place the account into restricted / read-only access (Task 11.3).
   - **CTA**: Prominent warning with direct payment link and instructions to prevent account interruption.

3. **Stage 3: Day 7 Notification (Final Notice / Pre-Suspension Notice)**:
   - **Timing**: Triggered on Day 7 (168 hours post-failure).
   - **Tone & Message**: Critical final notice. Informs the subscriber that the grace period has lapsed, account access is restricted, and the subscription is scheduled for cancellation/suspension if not settled immediately.
   - **CTA**: Final resolution link and customer support escalation contact.

4. **Distributed BullMQ Queue & Cron Architecture**:
   - Dedicated Redis queue `subscription-dunning` with repeatable daily cron execution at 07:00 UTC.
   - Immediate asynchronous dispatch triggered by `invoice.payment_failed` webhook for instant Day 1 notification delivery.
   - Two-stage worker pattern: Scanner (evaluates past-due durations and enqueues eligible notifications) -> Dispatcher (asynchronously renders HTML email, communicates with email provider, and persists audit records).

5. **Deduplication & Idempotency**:
   - `SubscriptionDunningLog` table with composite unique constraint `(subscription_id, stage, channel, dispatched_date)` ensuring zero duplicate notifications for the same stage on any given day.
   - Full historical audit trail of all dunning attempts, delivery statuses, error messages, and gateway invoice IDs.

---

## 2. Current State vs. Proposed State

### Current State
- **Task 11.1**: Webhook listener (`SubscriptionWebhookService`) catches Stripe `invoice.payment_failed`, marks the subscription `PAST_DUE`, and logs an audit record.
- Subscriptions in `PAST_DUE` remain in that state without automated customer outreach.
- No background queue or cron exists to monitor how long a subscription has been in `PAST_DUE`.
- Farmers receive no automated emails or alerts explaining why their payment failed or how to update their card.
- No tracking exists for dunning attempts or stages.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `DunningStage` (`DAY_1`, `DAY_3`, `DAY_7`).
  - `DunningChannel` (`EMAIL`, `SMS`, `IN_APP`).
  - `DunningStatus` (`PENDING`, `SENT`, `FAILED`, `SKIPPED`).
  - DTOs: `SubscriptionDunningLogDto`, `TriggerDunningScanDto`, `DunningScanResultDto`, `QueryDunningLogsDto`, `DunningJobPayload`.
- **Database Schema (`apps/api/prisma`)**:
  - `SubscriptionDunningLog` model with relations to `Subscription`, `User`, and `Farm`.
  - Composite unique constraint `unique_subscription_dunning_daily` on `(subscription_id, stage, channel, dispatched_date)`.
  - Migration script `20260920170000_add_subscription_dunning_logs`.
- **Domain Layer (`apps/api/src/modules/subscriptions`)**:
  - `SubscriptionDunningLogEntity` domain entity with lifecycle mutations.
  - Enhanced `SubscriptionEntity` with `calculateDunningStage(now: Date): DunningStage | null`.
- **Repository Layer**:
  - `ISubscriptionDunningLogRepository` and `SubscriptionDunningLogRepository`.
  - Enhanced `ISubscriptionRepository` with `findPastDueSubscriptions()`.
- **Email Templating (`apps/api/src/modules/subscriptions/templates`)**:
  - `dunning-email.template.ts`: Responsive, branded HTML and plaintext templates for Day 1, Day 3, and Day 7.
- **Service & Queue Layer**:
  - `SubscriptionDunningService`: Business logic for scanning past-due subscriptions, evaluating stages, dispatching notifications, and recording logs.
  - `SubscriptionDunningQueueService`: BullMQ producer with daily cron at 07:00 UTC and on-demand dispatch.
  - `SubscriptionDunningProcessor`: BullMQ consumer processing scan and dispatch jobs.
  - Integration with `SubscriptionWebhookService`: Instant Day 1 dunning enqueue upon receiving `invoice.payment_failed`.
- **Controller Layer**:
  - `SubscriptionDunningController`: Exposes admin endpoints for manual scan triggers, test dispatches, and log queries.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Cron-Only Scanner vs. Hybrid Event-Driven + Daily Cron
- **Option A (Cron-Only Scanner)**:
  - Subscriptions only receive Day 1 notification during the next daily cron cycle (could be up to 23 hours later).
  - *Cons*: Delayed notice to customer, during which payment might have failed while user is actively using the system.
- **Option B (Hybrid Event-Driven + Daily Cron - SELECTED)**:
  - Immediate Day 1 notification enqueued directly when `invoice.payment_failed` webhook arrives.
  - Daily BullMQ cron scanner at 07:00 UTC catches all past-due subscriptions for Day 1 (if missed), Day 3, and Day 7 stages.
  - *Justification*: Provides immediate user feedback on card failures while maintaining resilient background sweeps.

### Trade-off 2: Tracking Sent Stages via Fields on `Subscription` vs Dedicated `SubscriptionDunningLog` Table
- **Option A (Adding `lastDunningStage` and `lastDunningDate` to `Subscription` model)**:
  - *Cons*: Overwrites previous stage history; cannot audit failed vs sent deliveries; cannot track multi-channel attempts (e.g. Email + SMS); violates Guardrail-07.
- **Option B (Dedicated `SubscriptionDunningLog` Table - SELECTED)**:
  - *Pros*: Complete historical audit trail of every notification sent, email address, message preview, error diagnostics, and invoice metadata. Composite unique constraint prevents duplicate notifications.
  - *Justification*: Complies with Enterprise SaaS auditing standards and Clean Architecture.

### Trade-off 3: Email Generation In-Process vs Template Abstraction
- **Option A (Hardcoded email strings in service)**:
  - *Cons*: Poor maintainability, messy string interpolation, no responsive HTML styling.
- **Option B (Dedicated Template Generator - SELECTED)**:
  - Clean `dunning-email.template.ts` with distinct stage visual headers (Day 1: Info Blue, Day 3: Warning Amber, Day 7: Urgent Red), button CTAs, and plaintext fallbacks.

---

## 4. Data Models & Contracts

### 4.1 Shared Types (`packages/shared-types`)

```typescript
export enum DunningStage {
  DAY_1 = "DAY_1",
  DAY_3 = "DAY_3",
  DAY_7 = "DAY_7",
}

export enum DunningChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  IN_APP = "IN_APP",
}

export enum DunningStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

export interface SubscriptionDunningLogDto {
  id: string;
  subscriptionId: string;
  userId: string;
  farmId: string | null;
  stage: DunningStage;
  channel: DunningChannel;
  status: DunningStatus;
  recipientEmail: string;
  subject: string;
  message: string;
  errorMessage: string | null;
  attemptCount: number;
  gatewayInvoiceId: string | null;
  dispatchedDate: string;
  dispatchedAt: string;
}
```

### 4.2 Prisma Schema Model

```prisma
model SubscriptionDunningLog {
  id               String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  subscriptionId   String         @map("subscription_id") @db.Uuid
  userId           String         @map("user_id") @db.Uuid
  farmId           String?        @map("farm_id") @db.Uuid
  stage            DunningStage
  channel          DunningChannel @default(EMAIL)
  status           DunningStatus  @default(SENT)
  recipientEmail   String         @map("recipient_email") @db.VarChar(255)
  subject          String         @db.VarChar(255)
  message          String         @db.Text
  errorMessage     String?        @map("error_message") @db.Text
  attemptCount     Int            @default(1) @map("attempt_count")
  gatewayInvoiceId String?        @map("gateway_invoice_id") @db.VarChar(255)
  dispatchedDate   String         @map("dispatched_date") @db.VarChar(10)
  dispatchedAt     DateTime       @default(now()) @map("dispatched_at") @db.Timestamptz(6)

  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Restrict)
  farm         Farm?        @relation(fields: [farmId], references: [id], onDelete: SetNull)

  @@unique([subscriptionId, stage, channel, dispatchedDate], name: "unique_subscription_dunning_daily")
  @@index([subscriptionId, stage])
  @@index([userId, dispatchedAt])
  @@index([farmId, dispatchedAt])
  @@map("subscription_dunning_logs")
}
```

---

## 5. Security, Edge Cases & Guardrails

1. **Idempotency & Duplicate Protection**:
   - The unique constraint `(subscription_id, stage, channel, dispatched_date)` combined with service-level checks prevents multiple emails on the same day for the same stage.
2. **Grace Period Boundary Safety**:
   - `SubscriptionEntity.canAccessService()` ensures farm managers can continue entering milk yields and livestock data during Days 1–3 without artificial obstruction.
3. **Recovery After Successful Payment**:
   - When Stripe emits `invoice.payment_succeeded`, the subscription transitions to `ACTIVE`, naturally halting further dunning scans.
4. **Audit Logging (Guardrail-07)**:
   - Every sent or failed dunning notification writes an immutable `AuditLog` record (`DUNNING_NOTIFICATION_SENT` / `DUNNING_NOTIFICATION_FAILED`) containing the traceId and payload metadata.
5. **Multi-Tenant Isolation (Guardrail-05)**:
   - Dunning queries and logs are scoped by `farmId` and `userId`.
