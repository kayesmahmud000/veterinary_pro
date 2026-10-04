# SPEC-704: Milk Yield Anomaly Detection Worker & Clinical Alert Engine

## 1. Feature Overview & Objective

In commercial dairy and livestock herds, milk yield is the most sensitive real-time physiological indicator of animal health, welfare, and metabolic status. A sudden drop in milk yield is frequently the earliest observable symptom of acute clinical conditions, including:
- **Subclinical and Clinical Mastitis:** Bacterial infection of the mammary gland causing immediate tissue inflammation and secretory cell shutdown.
- **Metabolic Disorders:** Ketosis, displaced abomasum (DA), or acute ruminal acidosis following nutritional changes.
- **Systemic Infections & Fever:** Ephemeral fever, foot rot, acute lameness, or metritis.
- **Nutritional or Water Deprivation:** Blocked drinking water lines, moldy silage, or feed bunk competition.

Research in veterinary epidemiology demonstrates that detecting milk yield drops $\ge 20\%$ within 12–24 hours allows intervention up to 2 days before irreversible udder parenchymal damage or herd-wide transmission occurs.

**Objective**:
Implement an autonomous, BullMQ-driven **Milk Yield Anomaly Detection Worker** and clinical alert subsystem in VETRALINK PRO that:
1. Automatically intercepts new individual milking records and dispatches background anomaly evaluation jobs (`MILK_ANOMALY_QUEUE`).
2. Calculates statistical baseline yield over the preceding 7 calendar days ($[T-7, T-1]$) with minimum active day thresholds.
3. Flags animals experiencing a $\ge 20\%$ sudden drop in daily milk production, classifying severity into `LOW` (20–29%), `MEDIUM` (30–49%), and `CRITICAL` ($\ge 50\%$).
4. Persists tamper-evident, unique anomaly records in a normalized `milk_yield_anomalies` table with lifecycle states (`DETECTED`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_POSITIVE`).
5. Provides farm managers and veterinarians with RESTful endpoints to query alerts, acknowledge/resolve them with clinical notes, and trigger on-demand farm-wide daily anomaly scans.

---

## 2. Current State vs. Proposed State

### Current State
- `MilkLog` records daily milking sessions (`MORNING`, `AFTERNOON`, `EVENING`) for individual animals and bulk collections.
- `MilkYieldAnalyticsCalculator` (Task 7.3) computes macro aggregations and 7-day Simple Moving Averages.
- No automated worker exists to monitor individual cows for sudden drops, leaving detection entirely to human manual inspection of log lists.
- No persistent clinical alert entity exists in PostgreSQL to track mastitis/metabolic alerts, vet acknowledgments, or diagnostic notes.

### Proposed State
- **Database Model & Migration (`apps/api/prisma/schema.prisma`)**:
  - New model `MilkYieldAnomaly` (`milk_yield_anomalies` table) with relations to `Farm`, `Animal`, and `User` (acknowledgedBy).
  - Uniqueness constraint: `@@unique([farmId, animalId, loggedDate])` preventing duplicate alarms on the same day.
  - Enums: `MilkAnomalySeverity` (`LOW`, `MEDIUM`, `CRITICAL`) and `MilkAnomalyStatus` (`DETECTED`, `ACKNOWLEDGED`, `RESOLVED`, `FALSE_POSITIVE`).
- **Shared Types (`packages/shared-types`)**:
  - DTOs: `MilkAnomalyResponseDto`, `MilkAnomalyQueryRequestDto`, `AcknowledgeMilkAnomalyRequestDto`, `ResolveMilkAnomalyRequestDto`, `TriggerAnomalyScanRequestDto`, `AnomalyScanResultDto`.
  - Enums exported in universal shared index.
- **BullMQ Distributed Worker Architecture**:
  - Queue `MILK_ANOMALY_QUEUE = "milk-anomaly-detection"`.
  - Queue producer `MilkAnomalyQueueService`.
  - Processor `MilkAnomalyProcessor`:
    - Handles `ANIMAL_DROP_CHECK` (event-driven from single log entry).
    - Handles `FARM_DAILY_SCAN` (batch scan of all active milking animals).
- **Service & Repository Layer**:
  - `IMilkYieldAnomalyRepository`: CRUD, composite filtering, status transitions, and deduplication.
  - `IMilkAnomalyService`: Domain orchestrator executing anomaly evaluation, baseline calculations, alert lifecycle state changes, and farm scans.
- **REST API Endpoints (`MilkLogsController` or dedicated routes)**:
  - `GET /api/v1/milk-logs/anomalies`: List and filter alerts.
  - `POST /api/v1/milk-logs/anomalies/scan`: Trigger on-demand farm scan.
  - `PATCH /api/v1/milk-logs/anomalies/:id/acknowledge`: Mark alert acknowledged with vet notes.
  - `PATCH /api/v1/milk-logs/anomalies/:id/resolve`: Mark alert resolved with resolution notes.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Synchronous In-Line Check vs. Asynchronous BullMQ Background Worker
- **Option A (Synchronous in `createMilkLog`)**:
  - Query 7 days of history and compute drop directly inside `createMilkLog` HTTP request.
  - *Cons*: Adds 20–50ms database latency to mobile parlour log entry in low-bandwidth rural barns. If baseline calculation errors out, it could fail the farmer's milk log creation.
- **Option B (Asynchronous BullMQ Worker - SELECTED)**:
  - `createMilkLog` writes the log, commits the transaction, and pushes a lightweight job to `MILK_ANOMALY_QUEUE`.
  - *Pros*: Completely decouples HTTP response time from analytical computation. Parlour operators get instant `<50ms` responses. Worker runs distributed, retries on transient errors, and can scale independently.
  - *Justification*: Mandated by Roadmap Task 7.4 ("Anomaly detection worker") and Section 2.1 Clean Architecture.

### Trade-off 2: Ephemeral Cache Alerts vs. Relational Persistence (`milk_yield_anomalies`)
- **Option A (Redis / Notification Stream Only)**:
  - Publish alert to Redis PubSub or WebSocket without relational persistence.
  - *Cons*: Alerts vanish if missed; no historical audit trail, no status lifecycle (`ACKNOWLEDGED` -> `RESOLVED`), and cannot be linked to Sprint 8 Electronic Health Records (EHR).
- **Option B (Normalized Relational Table in 3NF - SELECTED)**:
  - Store structured alerts in `milk_yield_anomalies` with foreign keys to `animals`, `farms`, and `users`.
  - *Pros*: Full veterinary compliance, permanent audit history, seamless integration with future Tele-Vet consultations (Phase 5) and Clinical Health Events (Sprint 8).
  - *Justification*: Core system architectural principle (ACID integrity and 3NF data modeling).

---

## 4. Mathematical Anomaly Detection Model

### 4.1 Target Date Yield
For animal $a$ on date $T$:
$$Y(T) = \sum_{s \in \{\text{MORNING}, \text{AFTERNOON}, \text{EVENING}\}} y(a, T, s)$$

### 4.2 Baseline Calculation
The baseline is derived from the preceding 7 calendar days $[T - 7\text{ days}, T - 1\text{ day}]$.
Let $D_{\text{active}} \subseteq [T - 7, T - 1]$ be the dates where animal $a$ had recorded milk logs.

**Eligibility Rule**:
To prevent false alarms during early lactation initiation or dry-off periods:
1. $|D_{\text{active}}| \ge 2$ (animal must have at least 2 active logging days in the trailing week).
2. $\text{Average Baseline Yield} \ge 2.0\text{ Liters}$ (filters out dry cows or weaning outliers).

When eligible:
$$B(T) = \frac{1}{|D_{\text{active}}|} \sum_{d \in D_{\text{active}}} Y(d)$$

### 4.3 Drop Percentage & Severity Gate
$$\Delta_{\text{drop}}\% = \frac{B(T) - Y(T)}{B(T)} \times 100$$

- If $\Delta_{\text{drop}}\% < 20\%$: **Normal Variance** (No alert generated).
- If $20\% \le \Delta_{\text{drop}}\% < 30\%$: **Alert Severity = `LOW`** (Monitor feeding / rumination).
- If $30\% \le \Delta_{\text{drop}}\% < 50\%$: **Alert Severity = `MEDIUM`** (Clinical exam recommended).
- If $\Delta_{\text{drop}}\% \ge 50\%$: **Alert Severity = `CRITICAL`** (Immediate veterinary intervention).

---

## 5. Data Models & Contracts

### 5.1 Prisma Schema Migration
```prisma
enum MilkAnomalySeverity {
  LOW
  MEDIUM
  CRITICAL
}

enum MilkAnomalyStatus {
  DETECTED
  ACKNOWLEDGED
  RESOLVED
  FALSE_POSITIVE
}

model MilkYieldAnomaly {
  id                  String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId              String              @map("farm_id") @db.Uuid
  animalId            String              @map("animal_id") @db.Uuid
  loggedDate          DateTime            @map("logged_date") @db.Date
  currentYieldLiters  Decimal             @map("current_yield_liters") @db.Decimal(8, 3)
  baselineYieldLiters Decimal             @map("baseline_yield_liters") @db.Decimal(8, 3)
  dropPercentage      Decimal             @map("drop_percentage") @db.Decimal(5, 2)
  severity            MilkAnomalySeverity @default(LOW)
  status              MilkAnomalyStatus   @default(DETECTED)
  acknowledgedById    String?             @map("acknowledged_by_id") @db.Uuid
  acknowledgedAt      DateTime?           @map("acknowledged_at") @db.Timestamptz(6)
  resolvedAt          DateTime?           @map("resolved_at") @db.Timestamptz(6)
  clinicalNotes       String?             @map("clinical_notes") @db.Text
  resolutionNotes     String?             @map("resolution_notes") @db.Text
  metadata            Json                @default("{}")
  createdAt           DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime            @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm           Farm    @relation(fields: [farmId], references: [id], onDelete: Restrict)
  animal         Animal  @relation(fields: [animalId], references: [id], onDelete: Cascade)
  acknowledgedBy User?   @relation("AnomalyAcknowledgedBy", fields: [acknowledgedById], references: [id], onDelete: SetNull)

  @@unique([farmId, animalId, loggedDate])
  @@index([farmId, status, loggedDate])
  @@index([animalId, loggedDate])
  @@map("milk_yield_anomalies")
}
```

### 5.2 Shared DTOs
```typescript
export interface MilkAnomalyResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly animalId: string;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly currentYieldLiters: number;
  readonly baselineYieldLiters: number;
  readonly dropPercentage: number;
  readonly severity: MilkAnomalySeverity;
  readonly status: MilkAnomalyStatus;
  readonly acknowledgedById: string | null;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
  readonly clinicalNotes: string | null;
  readonly resolutionNotes: string | null;
  readonly animal?: {
    readonly id: string;
    readonly tagNumber: string;
    readonly name: string | null;
    readonly species: string;
    readonly breed: string | null;
  } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

---

## 6. Security & Edge Cases
1. **Deduplication**: If an alert already exists for the same farm, animal, and date, updates re-evaluate the current day's latest cumulative yield and drop percentage rather than creating phantom duplicates.
2. **Multi-Tenancy**: All repository queries and alert modifications scope strictly to `farmId`.
3. **Session Timing**: If a morning log creates an apparent 50% drop because afternoon milk has not yet occurred, when the afternoon session is logged later that day, the re-check recalculates the full daily total, automatically resolving or updating the anomaly severity.
4. **Non-Milking Animals**: BullMQ job validates that the target animal is female and active before querying baselines.
