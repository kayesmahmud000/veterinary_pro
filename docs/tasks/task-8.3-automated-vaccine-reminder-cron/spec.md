# SPEC-803: Automated BullMQ Cron Task for Multi-Species Vaccine and Deworming Reminders

## 1. Feature Overview & Objective
Livestock preventative health (vaccination and deworming) requires strict adherence to biological booster intervals (e.g., FMD every 180 days, Anthrax every 365 days, routine deworming every 90 days). In real-world farm operations, missed vaccination and deworming schedules lead to preventable disease outbreaks, herd mortality, decreased milk production, and economic losses.

The objective of Task 8.3 is to build an automated, resilient, multi-tenant background reminder engine using **BullMQ**:
1. **Automated Cron Scanner**: Periodically (daily cron schedule) and on-demand, scans active farms for livestock preventative health events where `nextDueDate` falls within configured notification milestones:
   - **7 Days Prior (`SEVEN_DAYS`)**: Advance notice for restocking vaccines/drenches and planning labor.
   - **3 Days Prior (`THREE_DAYS`)**: Urgent preparation reminder.
   - **Due Today (`DUE_TODAY`)**: Actionable administration prompt.
   - **Overdue (`OVERDUE`)**: Critical alert for delayed immunizations.
2. **Multi-Channel Notification Dispatch**:
   - **SMS**: Direct SMS messages to farm managers/owners/herdsmen with animal tag number, species, preventative treatment, and due date.
   - **Push Notifications**: Mobile push notifications (FCM / Web Push payload format) for instant field alerts.
   - Pluggable provider architecture with mock providers in development/test and production adapters.
3. **Idempotency & Deduplication Log**:
   - Maintain a dedicated `VaccineReminderLog` table with composite uniqueness tracking `(vaccineRecordId, milestone, channel, dispatchedDate)` to ensure zero duplicate reminders are sent on the same day for the same milestone.
4. **On-Demand Admin & Manager Triggers**:
   - REST API endpoint for farm managers/owners to trigger on-demand schedule scans, preview upcoming alerts (`dryRun`), and view dispatched reminder logs.

---

## 2. Current State vs. Proposed State

### Current State
- `VaccineRecord` exists in database and domain layer with `recordType` (`VACCINATION` | `DEWORMING`), `nextDueDate`, `administeredAt`, `animalId`, and `farmId`.
- Schedules can be queried synchronously via `GET /api/v1/clinical-health/vaccinations/schedule`, returning summary counts and upcoming events.
- No automated background worker checks `nextDueDate`.
- No SMS or Push reminder dispatch exists for preventative health events.
- No reminder audit/history log exists to prevent alert storms or verify delivery.

### Proposed State
- A dedicated BullMQ queue `VACCINE_REMINDER_QUEUE` with:
  - Daily repeatable cron job (`SCAN_ALL_FARMS_REMINDERS`) scheduled at 06:00 UTC.
  - Per-farm scan jobs (`SCAN_FARM_REMINDERS`) for tenant isolation.
  - Granular dispatch jobs (`DISPATCH_SCHEDULE_REMINDER`) with automatic exponential backoff retry.
- A pluggable notification abstraction (`ISmsNotificationProvider`, `IPushNotificationProvider`) and orchestrator (`IVaccineNotificationService`).
- A `VaccineReminderLog` database entity and repository recording every dispatch attempt with delivery status, milestone, and timestamp.
- REST endpoints in `VaccineScheduleController` allowing authorized farm staff (`OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF`) to:
  - Trigger manual schedule scans (`POST /api/v1/clinical-health/vaccinations/reminders/scan`).
  - View sent reminder logs (`GET /api/v1/clinical-health/vaccinations/reminders/logs`).

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: In-Process Node Timers vs. BullMQ Distributed Queue
- **Option A (In-Process `setInterval` or `@nestjs/schedule`)**:
  - *Cons*: Fails on horizontal scaling (multiple API instances would run duplicate cron scans and double-send SMS), lacks durable persistence across service restarts, lacks backoff retries.
- **Option B (BullMQ Distributed Redis Queue - SELECTED)**:
  - *Pros*: Built-in distributed locking, job deduplication via repeatable jobs in Redis, concurrency control, progress tracking, automatic exponential retry, and observability.
  - *Justification*: Aligns with VETRALINK PRO's cloud-native architecture (existing Redis 7 / BullMQ stack).

### Trade-off 2: Immediate Monolithic Dispatch vs. Two-Stage Queue Pattern
- **Option A (Single monolithic job that scans and sends all SMS/Push synchronously)**:
  - *Cons*: If 50 animals are due on a large farm, an external SMS API timeout on animal #20 fails the entire job or blocks the worker thread for minutes.
- **Option B (Two-Stage Producer-Consumer Queue Pattern - SELECTED)**:
  - *Stage 1 (Scanner)*: Evaluates due dates and enqueues individual granular reminder jobs.
  - *Stage 2 (Dispatcher)*: Processes each reminder individually with specific retries and independent error tracking.
  - *Justification*: Maximizes throughput, fault isolation, and avoids worker timeouts.

### Trade-off 3: Tracking Sent Reminders via Flags on `VaccineRecord` vs. Dedicated Log Table
- **Option A (Adding `lastReminderSentAt` and `reminderMilestone` on `VaccineRecord`)**:
  - *Cons*: Overwrites previous reminder history; cannot distinguish between SMS vs Push delivery failure; violates audit trail standards.
- **Option B (Dedicated `VaccineReminderLog` table - SELECTED)**:
  - *Pros*: Full historical audit trail of every notification sent to every user/phone; captures failed delivery reasons; allows distinct deduplication per channel and milestone.
  - *Justification*: Required by AgTech compliance and Guardrail-07 (Audit Logging on sensitive mutations).

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Addition
```prisma
enum ReminderChannel {
  SMS
  PUSH
}

enum ReminderMilestone {
  SEVEN_DAYS
  THREE_DAYS
  DUE_TODAY
  OVERDUE
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}

model VaccineReminderLog {
  id              String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId          String            @map("farm_id") @db.Uuid
  vaccineRecordId String            @map("vaccine_record_id") @db.Uuid
  animalId        String            @map("animal_id") @db.Uuid
  recipientUserId String?           @map("recipient_user_id") @db.Uuid
  recipientPhone  String?           @map("recipient_phone") @db.VarChar(50)
  channel         ReminderChannel   @default(SMS)
  milestone       ReminderMilestone
  status          ReminderStatus    @default(SENT)
  message         String            @db.Text
  errorMessage    String?           @map("error_message") @db.Text
  dispatchedDate  String            @map("dispatched_date") @db.VarChar(10) // YYYY-MM-DD for fast date-level uniqueness
  dispatchedAt    DateTime          @default(now()) @map("dispatched_at") @db.Timestamptz(6)

  farm          Farm          @relation(fields: [farmId], references: [id], onDelete: Restrict)
  vaccineRecord VaccineRecord @relation(fields: [vaccineRecordId], references: [id], onDelete: Cascade)
  animal        Animal        @relation(fields: [animalId], references: [id], onDelete: Cascade)
  recipientUser User?         @relation(fields: [recipientUserId], references: [id], onDelete: SetNull)

  @@unique([vaccineRecordId, milestone, channel, dispatchedDate], name: "unique_vaccine_reminder_daily")
  @@index([farmId, dispatchedAt])
  @@index([farmId, animalId])
  @@index([vaccineRecordId])
  @@map("vaccine_reminder_logs")
}
```

### 4.2 Shared Types Contracts (`@vetralink/shared-types`)
- Enums: `ReminderChannel`, `ReminderMilestone`, `ReminderStatus`.
- Interfaces & DTOs:
  - `VaccineReminderJobPayload`:
    ```typescript
    export interface VaccineReminderJobPayload {
      jobType: "SCAN_ALL_FARMS" | "SCAN_FARM" | "DISPATCH_REMINDER";
      farmId?: string;
      asOfDate?: string; // YYYY-MM-DD
      daysAhead?: number;
      dryRun?: boolean;
      reminderDetails?: {
        farmId: string;
        vaccineRecordId: string;
        animalId: string;
        tagNumber: string;
        species: string;
        recordType: string;
        vaccineName: string;
        dueDate: string;
        milestone: ReminderMilestone;
        recipientUserId?: string;
        recipientPhone?: string;
      };
      traceId?: string;
    }
    ```
  - `ScheduleScanResultDto`:
    ```typescript
    export interface ScheduleScanResultDto {
      farmId: string;
      scanDate: string;
      totalScanned: number;
      dueWithinHorizon: number;
      remindersDispatched: number;
      remindersSkipped: number;
      remindersFailed: number;
      details: Array<{
        vaccineRecordId: string;
        tagNumber: string;
        vaccineName: string;
        milestone: ReminderMilestone;
        channel: ReminderChannel;
        status: ReminderStatus;
        reason?: string;
      }>;
    }
    ```

### 4.3 REST Endpoints
| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/clinical-health/vaccinations/reminders/scan` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | Trigger on-demand preventative schedule scan & reminder dispatch |
| `GET` | `/api/v1/clinical-health/vaccinations/reminders/logs` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | Query historical reminder dispatch audit logs |

---

## 5. Security & Edge Cases
1. **Tenant Isolation**: Scanner queries strictly filter by `farmId`. Reminder logs are always scoped to `farmId`.
2. **Alert Storm Prevention & Idempotency**:
   - Deduplication check against `VaccineReminderLog` on `(vaccineRecordId, milestone, channel, dispatchedDate)` ensures an animal will never trigger redundant alerts on the same calendar day.
3. **Graceful Provider Fallback**:
   - If SMS gateway fails or rate limits, the error is recorded in `errorMessage`, status marked `FAILED`, without crashing the BullMQ worker.
4. **Phone Encryption Respect**:
   - In production, user phone numbers stored as ciphertext are decrypted via existing cryptographic utilities before provider invocation; raw numbers are never leaked into logs.
5. **Inactive Animal Filter**:
   - Sold, culled, or deceased animals are excluded from scan processing even if legacy `nextDueDate` is set.
