# SPEC-802: Multi-Species Vaccination and Deworming Schedule Tracker

## 1. Feature Overview & Objective
Preventative herd health programs—specifically scheduled vaccination (immunization against epidemic viral and bacterial contagions) and deworming (strategic anthelmintic parasite management)—are fundamental to livestock survival, bio-security, reproductive success, and food safety.

Across diverse livestock species (cattle, buffalo, sheep, goats, camels, and poultry), disease challenges and treatment frequencies vary dramatically:
- **Cattle & Buffalo**: High-risk viral contagions (Foot and Mouth Disease / FMD every 6 months, Lumpy Skin Disease / LSD annually), clostridial/bacterial threats (Anthrax, Blackleg / Clostridium chauvoei, Brucellosis), and strategic gastrointestinal parasite deworming (biannual or seasonal).
- **Goats & Sheep**: High susceptibility to Peste des Petits Ruminants (PPR, annual), Enterotoxemia / Pulpy Kidney (biannual), and frequent Haemonchus contortus (barber pole worm) burdens requiring quarterly anthelmintic rotations.
- **Poultry**: Rigorous early-life flock schedules (Newcastle Disease / Ranikhet, Infectious Bursal Disease / Gumboro, Fowl Pox) administered via drinking water, eye drops, or wing-web stab.
- **Camels**: Hemorrhagic Septicemia (Pasteurellosis), Camel Pox, Trypanosomiasis control, and periodic broad-spectrum deworming.

Without automated schedule tracking:
1. Boosters are missed, resulting in vaccine failure, catastrophic outbreaks, and herd quarantine.
2. Parasite resistance escalates from haphazard, unrecorded dewormer applications.
3. Farms face regulatory penalties or milk/meat dumping due to unmonitored drug withdrawal periods.

**Objective**:
Implement an enterprise-grade, multi-tenant Multi-Species Vaccination and Deworming Schedule Tracker in VETRALINK PRO. This subsystem enables farm managers, herdsmen, and veterinarians to:
1. Record administered vaccinations and deworming treatments with batch numbers, dosages, costs, and calculated next due dates.
2. Query herd-wide preventative health schedules, highlighting upcoming, due soon, and overdue booster/deworming milestones.
3. Access verified, species-specific baseline protocols and guidelines (`COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`, `POULTRY`).
4. Maintain tamper-evident audit logging for regulatory certification and food safety compliance.
5. Provide the underlying scheduling query engine that powers automated BullMQ reminders (Task 8.3).

---

## 2. Current State vs. Proposed State

### Current State
- `apps/api/prisma/schema.prisma` contains a basic `VaccineRecord` table with `farmId`, `animalId`, `administeredById`, `vaccineName`, `batchNumber`, `doseAmount`, `doseUnit`, `administeredAt`, `nextDueDate`, and `createdAt`.
- No distinguishing field exists to differentiate between protective vaccines (`VACCINATION`) and anthelmintic dewormers (`DEWORMING`).
- The model lacks financial cost tracking (`cost`), clinical notes (`notes`), optimistic concurrency versioning (`syncVersion`), and audit timestamps (`updatedAt`).
- `packages/shared-types` has no enums or DTO contracts for vaccination/deworming scheduling, status categorization, or multi-species guidelines.
- No repository, domain entity, service, or API endpoints exist for managing preventative health schedules.

### Proposed State
- **Database Schema Updates**:
  - Add `VaccineRecordType` enum: `VACCINATION`, `DEWORMING`.
  - Add `record_type`, `cost`, `notes`, `sync_version`, and `updated_at` columns to `vaccine_records`.
  - Add composite indexes on `[farmId, recordType, nextDueDate]`, `[farmId, animalId, recordType]`, and `[farmId, administeredAt]`.
- **Shared Types (`packages/shared-types`)**:
  - `VaccineRecordType` enum (`VACCINATION`, `DEWORMING`).
  - `PreventativeScheduleStatus` enum (`UPCOMING`, `DUE_SOON`, `OVERDUE`, `COMPLETED`).
  - DTOs: `CreateVaccineRecordRequestDto`, `UpdateVaccineRecordRequestDto`, `VaccineRecordQueryDto`, `VaccineRecordResponseDto`, `VaccineScheduleSummaryDto`, and `SpeciesVaccineProtocolDto`.
- **Backend Architecture (`apps/api/src/modules/clinical-health/`)**:
  - `VaccineRecordEntity`: Domain entity encapsulating business invariants (positive dose, non-negative cost, valid administered date, next due date chronologically after administration).
  - `IVaccineRecordRepository` & `VaccineRecordRepository`: Multi-tenant data access layer with schedule filtering, overdue detection, and relational hydration.
  - `IVaccineScheduleService` & `VaccineScheduleService`: Business logic orchestrating animal existence, tenant validation, protocol recommendation generation, schedule aggregation metrics, and transactional mutations with audit logs.
  - `VaccineScheduleController`: Guarded REST API endpoints under `/api/v1/clinical-health/vaccinations` protected by `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.
  - Comprehensive unit test suite with 100% logic coverage across entities, repositories, service, and controller.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Single Unified Entity vs. Separate `VaccineRecord` and `DewormingRecord` Tables
- **Option A (Separate Tables)**:
  - Create a dedicated `deworming_records` table and keep `vaccine_records` separate.
  - *Cons*: Duplicate table schemas, duplicate repositories, duplicate controllers, and fragmented schedule dashboards. Both domains share identical semantics: animal, administrator, compound name, batch, dosage, administration date, and next due date.
- **Option B (Unified `VaccineRecord` with `recordType: VACCINATION | DEWORMING` - SELECTED)**:
  - Reuse and enrich `vaccine_records` with a discriminator enum `recordType`.
  - *Pros*: Unified schedule query engine, unified overdue alerts, consolidated reporting, and reduced schema bloat while allowing clean filtering via query parameters (`?recordType=DEWORMING`).
  - *Justification*: Prevents schema duplication and simplifies herd-wide preventative health calendars.

### Trade-off 2: Static Species Protocols vs. Dynamic Database-driven Protocol Configuration
- **Option A (Full Dynamic Database Protocol Engine)**:
  - Create `vaccine_protocols` and `protocol_steps` database tables where farm admins configure custom schedules.
  - *Cons*: Over-engineering for this milestone, requires complex UI builders and admin management before core scheduling is functional.
- **Option B (Domain-level Standard Protocols Catalog with Dynamic Due Dates - SELECTED)**:
  - Maintain authoritative, doctor-verified standard protocols as domain catalog objects (e.g. FMD every 180 days, Anthrax every 365 days, PPR annual, Deworming every 90 days), with the ability for farmers to customize the exact `nextDueDate` on each record.
  - *Pros*: Out-of-the-box guidance for every species supported by VETRALINK PRO, zero setup friction for farmers, and extensible to future user-defined templates.
  - *Justification*: Balances rapid usability with enterprise AgTech domain standards.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema
```prisma
enum VaccineRecordType {
  VACCINATION
  DEWORMING
}

model VaccineRecord {
  id             String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId         String            @map("farm_id") @db.Uuid
  animalId       String            @map("animal_id") @db.Uuid
  administeredBy String            @map("administered_by_id") @db.Uuid
  recordType     VaccineRecordType @default(VACCINATION) @map("record_type")
  vaccineName    String            @map("vaccine_name") @db.VarChar(150)
  batchNumber    String?           @map("batch_number") @db.VarChar(100)
  doseAmount     Decimal           @map("dose_amount") @db.Decimal(6, 2)
  doseUnit       String            @default("ml") @map("dose_unit") @db.VarChar(20)
  cost           Decimal           @default(0) @db.Decimal(10, 2)
  notes          String?           @db.Text
  administeredAt DateTime          @map("administered_at") @db.Timestamptz(6)
  nextDueDate    DateTime?         @map("next_due_date") @db.Date
  syncVersion    Int               @default(1) @map("sync_version")
  createdAt      DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime          @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm     Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)
  animal   Animal @relation(fields: [animalId], references: [id], onDelete: Cascade)
  recorder User   @relation("AdministeredBy", fields: [administeredBy], references: [id], onDelete: Restrict)

  @@index([farmId, nextDueDate])
  @@index([farmId, recordType, nextDueDate])
  @@index([farmId, animalId, recordType])
  @@index([farmId, administeredAt])
  @@index([animalId])
  @@map("vaccine_records")
}
```

### 4.2 REST Endpoints (`/api/v1/clinical-health/vaccinations`)
| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/clinical-health/vaccinations` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | Record vaccination or deworming event |
| `GET` | `/api/v1/clinical-health/vaccinations` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | List/filter immunization records |
| `GET` | `/api/v1/clinical-health/vaccinations/schedule` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | Get herd-wide preventative health schedule & summary |
| `GET` | `/api/v1/clinical-health/vaccinations/protocols` | All Authenticated | Get standard species-specific vaccination & deworming protocols |
| `GET` | `/api/v1/clinical-health/vaccinations/:id` | `OWNER`, `MANAGER`, `HERDSMAN`, `VET_STAFF` | Get single record details |
| `PATCH` | `/api/v1/clinical-health/vaccinations/:id` | `OWNER`, `MANAGER`, `VET_STAFF` | Update record parameters |
| `DELETE` | `/api/v1/clinical-health/vaccinations/:id` | `OWNER`, `MANAGER` | Delete erroneous record |

---

## 5. Security & Edge Cases
1. **Multi-Tenancy**: All queries enforce strict `farmId` tenant context matching `x-farm-id`.
2. **Chronology Check**: `nextDueDate` must be strictly on or after `administeredAt`.
3. **Future Administration**: `administeredAt` cannot be in the future beyond current date.
4. **Dose & Cost Non-Negativity**: `doseAmount > 0`, `cost >= 0`.
5. **Animal Status Guard**: Animals marked `SOLD`, `DECEASED`, or `CULLED` cannot receive preventative treatments.
6. **Audit Trail**: Every mutation emits an `AuditLog` entry inside the transaction.
