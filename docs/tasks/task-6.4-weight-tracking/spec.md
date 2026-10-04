# SPEC-604: Livestock Weight Tracking History & Automated Growth Curve Calculation Engine

## 1. Feature Overview & Objective
Animal body weight is one of the most critical health, nutritional, and economic indicators in livestock farming. In both dairy and beef production, weight progression directly determines:
- Feed Conversion Efficiency (FCE) and diet adequacy.
- Age-to-weight breeding readiness (heifers must reach ~55-60% of mature body weight before insemination).
- Early disease and parasite detection (a sudden drop in weight is the earliest clinical marker of illness before visible symptoms).
- Market readiness and carcass yield valuation for beef, goat, and sheep farming.

### Core Problems Solved:
1. **Historical Weight Ledger:** Maintain an immutable, tenant-isolated time-series record of body weight measurements (`weightKg`, `recordedAt`, `notes`, `recordedBy`).
2. **Automated Growth Curve & ADG Computation:** Calculate interval and overall **Average Daily Gain (ADG)**:
   $$\text{ADG} = \frac{W_{\text{end}} - W_{\text{start}}}{\text{Days between measurements}}$$
3. **Age-to-Weight Trajectory:** Correlate weigh-ins against animal age in days/months from `date_of_birth` to render growth curve trajectories.
4. **Weight Loss & Growth Failure Anomaly Detection:** Automatically flag significant weight drops ($\ge 3\%$ or negative ADG), warning farmers of nutritional stress or subclinical disease.
5. **Real-Time Animal Synchronization:** Automatically synchronize the `Animal.weight_kg` current metric when a new weight is recorded or deleted.

---

## 2. Current State vs. Proposed State

### Current State
- `Animal` table has a static `weight_kg` column (`DECIMAL(6,2)`).
- Updating `weight_kg` via `PATCH /animals/:id` overwrites the current value, discarding historical progression.
- Farmers and veterinarians have no way to view growth trajectories, calculate daily gain, or detect health-related weight loss trends over time.

### Proposed State
- **New Database Table (`animal_weight_logs`):** Stores discrete weigh-in events with tenant isolation, foreign keys to `animals` and `users`, and composite time-series indexing.
- **Bi-directional Synchronization:** Recording a weight log automatically synchronizes the root `Animal.weight_kg` to reflect the latest measurement. If an erroneous entry is removed, `Animal.weight_kg` reverts to the preceding measurement.
- **Growth Curve Analytics Engine:** Computes:
  - Chronological weigh-in points with age in days.
  - Interval ADG (kg/day) between consecutive weigh-ins.
  - Overall ADG (kg/day) from birth or first measurement to current date.
  - Total weight gain (kg) and percentage change.
  - Growth trajectory status (`ACCELERATING`, `STEADY`, `SLOWING`, `WEIGHT_LOSS`).
  - Clinical alert flag when weight loss is detected.
- **REST Endpoints:**
  - `POST /api/v1/animals/:id/weights`: Record a weigh-in event.
  - `GET /api/v1/animals/:id/weights`: Retrieve chronological weigh-in history with pagination.
  - `GET /api/v1/animals/:id/growth-curve`: Retrieve calculated growth curve metrics and trajectory analysis.
  - `DELETE /api/v1/animals/:id/weights/:weightId`: Remove a mistaken weigh-in record.

---

## 3. Architectural & Design Trade-offs

| Criterion | Option A: In-table JSON Array on `Animal` | Option B: Normalized Time-Series Table `animal_weight_logs` (Selected) | Option C: TimescaleDB Hypertable Extension |
|---|---|---|---|
| **Data Integrity & 3NF** | **Poor.** Violates 1NF; unbounded array growth causes row bloat and locks the entire animal row on append. | **Superior.** 3NF normalized table; clean foreign keys, independent indexing, atomic writes. | Overkill for initial phase; introduces non-standard PostgreSQL extension dependencies. |
| **Query Performance** | Slow JSON filtering; difficult to paginate or index date ranges. | **Lightning fast.** Composite B-tree index `(animal_id, recorded_at DESC)` enables sub-millisecond lookups. | Excellent for billions of rows, unnecessary complexity for herd sizes < 100k. |
| **Auditability** | Difficult to track who recorded individual weigh-ins. | Every log entry records `recorded_by_id`, `created_at`, `notes`, and audit trail. | Good, but complex permissions. |
| **Concurrency** | Concurrent weigh-ins on different animals conflict on document write. | Discrete append-only rows; zero row contention. | Append-optimized. |

**Technical Justification for Option B:**
A normalized relational table with composite indexing `(animal_id, recorded_at)` fits the system's PostgreSQL 16 3NF schema, provides standard foreign key cascade behavior, and allows sub-5ms analytics calculation directly in application memory or window functions.

---

## 4. Growth Curve Analytics & Mathematical Models

### 4.1 Average Daily Gain (ADG)
For consecutive measurements $(t_1, W_1)$ and $(t_2, W_2)$ where $t_2 > t_1$:
$$\text{Days} = \frac{t_2 - t_1}{86,400,000 \text{ ms}}$$
$$\text{Interval ADG} = \begin{cases} \frac{W_2 - W_1}{\text{Days}} & \text{if } \text{Days} \ge 1 \\ 0 & \text{if } \text{Days} < 1 \end{cases}$$

### 4.2 Overall ADG
$$\text{Overall ADG} = \frac{W_{\text{latest}} - W_{\text{earliest}}}{\text{Total Days}}$$

### 4.3 Growth Trajectory Classification
- `ACCELERATING`: Latest interval ADG is $> 10\%$ higher than overall ADG.
- `STEADY`: Latest interval ADG is within $\pm 10\%$ of overall ADG.
- `SLOWING`: Latest interval ADG is $> 10\%$ lower than overall ADG, but positive.
- `WEIGHT_LOSS`: Latest interval ADG $< 0$ (weight decrease).

---

## 5. Data Models & Contracts

### 5.1 Database Schema (`apps/api/prisma/schema.prisma`)
```prisma
model AnimalWeightLog {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId       String   @map("farm_id") @db.Uuid
  animalId     String   @map("animal_id") @db.Uuid
  recordedById String   @map("recorded_by_id") @db.Uuid
  weightKg     Decimal  @map("weight_kg") @db.Decimal(6, 2)
  recordedAt   DateTime @map("recorded_at") @db.Timestamptz(6)
  notes        String?  @db.Text
  syncVersion  Int      @default(1) @map("sync_version")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm       Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)
  animal     Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  recordedBy User   @relation("WeightRecordedBy", fields: [recordedById], references: [id], onDelete: Restrict)

  @@index([farmId, animalId, recordedAt])
  @@index([animalId, recordedAt])
  @@index([farmId, recordedAt])
  @@map("animal_weight_logs")
}
```

### 5.2 Shared DTOs (`@vetralink/shared-types`)
```typescript
export enum GrowthTrajectory {
  ACCELERATING = "ACCELERATING",
  STEADY = "STEADY",
  SLOWING = "SLOWING",
  WEIGHT_LOSS = "WEIGHT_LOSS",
}

export interface RecordWeightDto {
  readonly weightKg: number;
  readonly recordedAt: string; // ISO 8601
  readonly notes?: string;
}

export interface AnimalWeightLogDto {
  readonly id: string;
  readonly animalId: string;
  readonly farmId: string;
  readonly weightKg: number;
  readonly recordedAt: string;
  readonly notes: string | null;
  readonly recordedById: string;
  readonly recordedByName: string | null;
  readonly ageDays: number | null;
  readonly createdAt: string;
}

export interface GrowthCurvePointDto {
  readonly logId: string;
  readonly recordedAt: string;
  readonly weightKg: number;
  readonly ageDays: number | null;
  readonly intervalDays: number;
  readonly weightChangeKg: number;
  readonly intervalAdgKg: number; // kg/day
}

export interface GrowthCurveAnalyticsDto {
  readonly animalId: string;
  readonly tagNumber: string;
  readonly species: AnimalSpecies;
  readonly birthDate: string | null;
  readonly currentAgeDays: number | null;
  readonly currentWeightKg: number | null;
  readonly startingWeightKg: number | null;
  readonly totalGainKg: number | null;
  readonly overallAdgKg: number | null; // Overall kg/day
  readonly trajectory: GrowthTrajectory;
  readonly hasWeightLossAlert: boolean;
  readonly points: GrowthCurvePointDto[];
}
```

---

## 6. Security, Multi-Tenancy & Edge Cases
1. **Tenant Isolation (`GUARDRAIL-05`):** All repository queries strictly filter by `farm_id = :farmId`. Cross-tenant weight logging is rejected with `403 Forbidden` / `404 Not Found`.
2. **Zero or Negative Weight Validation:** Weights must be strictly positive ($> 0$ kg) and within biological limits for the species (e.g., $\le 2000$ kg for cattle, $\le 300$ kg for sheep/goats).
3. **Future Dates:** `recordedAt` cannot be in the future.
4. **Single-Measurement Handling:** If an animal only has 1 recorded weight, `points` has 1 item, interval and overall ADG are `0.0`, and trajectory is `STEADY`.
5. **Soft-Deleted Animal:** Weigh-ins cannot be added to soft-deleted animals (`404 Not Found`).
