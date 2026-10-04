# SPEC-804: Escalation Worker for Unresolved Critical and High Severity Illnesses

## 1. Feature Overview & Objective
In livestock operations, acute health incidents classified with `CRITICAL` or `HIGH` severity (such as anthrax, acute ruminal acidosis, severe mastitis, bloat, respiratory distress, and dystocia) present catastrophic risks of herd-wide contagion, animal mortality, and economic collapse if left unattended or unresolved.

The objective of Task 8.4 is to implement an automated **BullMQ Escalation Engine** that:
1. **Identifies Stale Unresolved Critical Cases**: Continuously evaluates open incidents (`resolvedAt: null`, `isResolved: false`) where `severity IN (CRITICAL, HIGH)` and animal status is not inactive (`ACTIVE`, `QUARANTINE`).
2. **Multi-Tier SLA Escalation Protocol**:
   - **Level 1 (`LEVEL_1_STAFF_ALERT`)**:
     - *Threshold*: `CRITICAL` unresolved for >= 24 hours, `HIGH` unresolved for >= 48 hours.
     - *Action*: Dispatches urgent SMS & Push alerts to attending vet and herdsman/manager.
   - **Level 2 (`LEVEL_2_OWNER_ALERT`)**:
     - *Threshold*: `CRITICAL` unresolved for >= 48 hours, `HIGH` unresolved for >= 72 hours.
     - *Action*: Escalates directly to Farm Owner & Head Veterinary Officer with critical warning.
   - **Level 3 (`LEVEL_3_EMERGENCY_INTERVENTION`)**:
     - *Threshold*: `CRITICAL` unresolved for >= 72 hours.
     - *Action*: Triggers high-priority emergency flags, automatic recommendation for livestock quarantine, and tele-veterinary emergency consult prompts.
3. **Idempotency & Escalation Audit Trail**:
   - Maintains an immutable `HealthIncidentEscalationLog` table with unique constraint `(healthRecordId, level, channel)` ensuring zero duplicate spamming of the same escalation tier.
   - Updates `escalationLevel` and `lastEscalatedAt` on the `HealthRecord` entity for real-time visibility in dashboard lists.
4. **On-Demand & Background Execution**:
   - Recurring BullMQ cron scanner (`HEALTH_ESCALATION_QUEUE`) running hourly/daily.
   - On-demand admin/manager sweep endpoint (`POST /api/v1/clinical-health/incidents/escalations/scan`).
   - Query endpoint to inspect active escalations and audit logs (`GET /api/v1/clinical-health/incidents/escalations`).

---

## 2. Current State vs. Proposed State

### Current State
- `HealthRecord` exists in database and API with `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `symptoms`, `diagnosis`, `treatment`, `cost`, `resolvedAt`.
- Incident resolution is tracked manually (`PATCH /api/v1/clinical-health/incidents/:id/resolve`).
- If an attending vet logs an illness as `CRITICAL` and walks away, the system never follows up, never alerts the farm owner, and never escalates stale cases.

### Proposed State
- An automated BullMQ escalation worker (`HealthEscalationProcessor`) periodically audits open health incidents against SLA thresholds.
- Multi-tier escalation with automated SMS and Push notification dispatch to attending vets, herdsmen, and farm owners.
- Direct database audit tracking via `HealthIncidentEscalationLog` and status reflection on `HealthRecord`.
- REST API endpoints for monitoring escalated cases and triggering on-demand sweeps.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Synchronous In-Process Escalation vs. Distributed BullMQ Queue
- **Option A (In-Process loop or `@Cron`)**:
  - *Cons*: Duplicate escalations if running multiple API instances in production; lacks retry mechanisms if external SMS fails.
- **Option B (BullMQ Distributed Queue with Worker Pattern - SELECTED)**:
  - *Pros*: Distributed locking in Redis, horizontal scalability, retry backoff on SMS/Push network drops, durable job persistence.
  - *Justification*: Matches VETRALINK PRO platform architecture and resilience standards.

### Trade-off 2: Ephemeral Flag vs. Immutable Audit Log
- **Option A (Only integer flag on `health_records` without log table)**:
  - *Cons*: Cannot track which staff member was notified, what channel was used, what error occurred, or when each tier was triggered.
- **Option B (Dedicated `HealthIncidentEscalationLog` + denormalized `escalationLevel` on `HealthRecord` - SELECTED)**:
  - *Pros*: Complete medical auditability, legal compliance for AgTech/veterinary oversight, fast dashboard filtering via denormalized level on `health_records`.
  - *Justification*: Required by Guardrail-07 (Audit Logging on sensitive mutations) and Section 2 Clean Architecture standards.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema
```prisma
enum HealthEscalationLevel {
  LEVEL_1_STAFF_ALERT
  LEVEL_2_OWNER_ALERT
  LEVEL_3_EMERGENCY_INTERVENTION
}

enum HealthEscalationAction {
  NOTIFY_VET_HERDSMAN
  NOTIFY_FARM_OWNER
  RECOMMEND_QUARANTINE
}

model HealthIncidentEscalationLog {
  id              String                 @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId          String                 @map("farm_id") @db.Uuid
  healthRecordId  String                 @map("health_record_id") @db.Uuid
  animalId        String                 @map("animal_id") @db.Uuid
  level           HealthEscalationLevel
  actionTaken     HealthEscalationAction @map("action_taken")
  recipientUserId String?                @map("recipient_user_id") @db.Uuid
  recipientPhone  String?                @map("recipient_phone") @db.VarChar(50)
  channel         ReminderChannel        @default(SMS)
  status          ReminderStatus         @default(SENT)
  notes           String?                @db.Text
  hoursUnresolved Int                    @map("hours_unresolved")
  dispatchedAt    DateTime               @default(now()) @map("dispatched_at") @db.Timestamptz(6)

  farm         Farm         @relation(fields: [farmId], references: [id], onDelete: Restrict)
  healthRecord HealthRecord @relation(fields: [healthRecordId], references: [id], onDelete: Cascade)
  animal       Animal       @relation(fields: [animalId], references: [id], onDelete: Cascade)
  recipientUser User?       @relation(fields: [recipientUserId], references: [id], onDelete: SetNull)

  @@unique([healthRecordId, level, channel], name: "unique_health_incident_escalation_level")
  @@index([farmId, dispatchedAt])
  @@index([healthRecordId])
  @@map("health_incident_escalations")
}
```

On `model HealthRecord`:
```prisma
  escalationLevel Int       @default(0) @map("escalation_level")
  lastEscalatedAt DateTime? @map("last_escalated_at") @db.Timestamptz(6)
  escalations     HealthIncidentEscalationLog[]
```

### 4.2 Shared Types & Contracts (`@vetralink/shared-types`)
- Enums: `HealthEscalationLevel`, `HealthEscalationAction`.
- DTOs:
  - `HealthEscalationJobPayload`
  - `EscalationScanResultDto`
  - `TriggerEscalationScanDto`
  - `HealthEscalationLogResponseDto`
  - `HealthEscalationLogQueryDto`

### 4.3 REST Endpoints
| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/clinical-health/incidents/escalations/scan` | `OWNER`, `MANAGER`, `VET_STAFF` | Trigger on-demand critical illness escalation scan |
| `GET` | `/api/v1/clinical-health/incidents/escalations/logs` | `OWNER`, `MANAGER`, `VET_STAFF` | Query historical escalation audit logs |
| `GET` | `/api/v1/clinical-health/incidents/escalations/active` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | List currently active escalated unresolved cases |

---

## 5. Security & Edge Cases
1. **Tenant Isolation**: Escalation scans and queries strictly filter by `farmId`.
2. **Deceased/Sold Guard**: Inactive animals (`SOLD`, `DECEASED`, `CULLED`) are never escalated.
3. **Resolved Incidents Guard**: An incident marked resolved (`resolvedAt != null`) will immediately abort any pending escalation.
4. **Idempotency**: Unique constraint `(healthRecordId, level, channel)` prevents double notifications for the same escalation tier.
5. **Channel Failure Fault-Tolerance**: If an SMS gateway is down, the Push channel still dispatches, the failure is recorded in log with `ReminderStatus.FAILED`, and worker does not crash.
