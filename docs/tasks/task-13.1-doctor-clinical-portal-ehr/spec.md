# Task 13.1 Specification: Doctor Clinical Portal — Comprehensive Animal Electronic Health Record (EHR) View

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, when a veterinarian enters a clinical consultation (either an active `LIVE_VIDEO` appointment or an `ASYNC_TICKET` triage case), they require immediate, deep visibility into the animal's full longitudinal health history. 

A standard electronic medical record in veterinary medicine is multi-dimensional. Unlike human medicine, veterinary EHR must incorporate:
1. **Animal Master Data & Pedigree**: Ear tag / RFID, species, breed, gender, date of birth, age, current weight, sire/dam lineage (to detect inherited disorders or inbreeding risks).
2. **Clinical Incident History**: Chronological records of illnesses, injuries, surgeries, routine checks, and breeding examinations with symptoms, diagnoses, treatments, costs, and lesion/wound photo attachments.
3. **Preventative Health & Immunization Ledger**: Full vaccination and deworming administration records with batch numbers, dosages, administration dates, next due dates, and overdue status flags.
4. **Biometric Growth & Weight Trajectory**: Historical weight logs with calculated weight changes and growth trends.
5. **Lactation & Production Metrics (Dairy Species)**: Daily and session milk yields, 7-day and 30-day moving averages, and historical milk anomaly alerts (e.g. sudden drop >20%).
6. **Tele-Veterinary Encounter History**: Chronological log of past consultations, attending doctors, chief complaints, and session outcomes.
7. **Pharmacological History & Food Safety Withdrawal Warnings**:
   - Complete record of past prescriptions and administered medications.
   - **Active Drug Withdrawal Alert Engine**: Calculates remaining withdrawal days for milk and meat consumption based on medication withdrawal periods (`withdrawalDays`). This is critical for food safety compliance on commercial dairy and beef farms.
8. **Clinical Summary & KPI Highlights**:
   - Total lifetime health spend.
   - Count of active unresolved clinical conditions.
   - Count of overdue vaccines/dewormings.
   - Count of active drug withdrawal periods.

---

## 2. Current State vs. Proposed State

### Current State
- `ConsultationService.getTriageCaseDetail` returns basic `TriageCaseDetailDto` with at most 5 recent health records and 5 recent vaccine records.
- There is no unified, comprehensive EHR view that aggregates:
  - Lineage and pedigree details (sire and dam tags).
  - Complete clinical health history with image attachments and resolved status.
  - Complete vaccination and deworming schedule with overdue alerts.
  - Historical weight logs and growth curves.
  - Milk production yields and anomaly history.
  - Past prescriptions and **active food safety withdrawal period alerts**.
  - Clinical KPI highlights.
- No dedicated doctor clinical portal endpoint exists to load the full EHR for an animal or an active consultation room session.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - Add comprehensive EHR DTO contracts:
    - `AnimalEhrResponseDto`: Complete aggregated electronic health record.
    - `EhrAnimalSummaryDto`: Master animal info with pedigree and age.
    - `EhrClinicalIncidentDto`: Diagnostic health record with attachments and attending vet.
    - `EhrPreventativeRecordDto`: Vaccination/deworming record with overdue status.
    - `EhrWeightRecordDto`: Weight trajectory record.
    - `EhrMilkProductionSummaryDto`: Yield averages, recent logs, and anomalies.
    - `EhrConsultationHistoryDto`: Past tele-vet sessions.
    - `EhrPrescriptionHistoryDto`: Past prescriptions with medications.
    - `EhrActiveWithdrawalAlertDto`: Food safety milk/meat withdrawal warnings.
    - `EhrClinicalHighlightsDto`: Aggregated clinical KPIs.
- **Domain Service & Repository**:
  - `IAnimalEhrService` and `AnimalEhrService`:
    - Aggregates data from `Animal`, `HealthRecord`, `VaccineRecord`, `AnimalWeightLog`, `MilkLog`, `MilkYieldAnomaly`, `Consultation`, and `Prescription`.
    - Computes age, growth rate, milk yield averages, and active food safety withdrawal periods.
    - Audits every EHR access via `AuditLogRepository` (`ANIMAL_EHR_VIEWED`).
- **REST Endpoints**:
  - `GET /consultations/:consultationId/ehr`: Tailored EHR view for active consultation rooms (verifies vet/farmer/admin access).
  - `GET /consultations/animals/:animalId/ehr`: Direct animal EHR inspection endpoint with farm tenant isolation.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **EHR Aggregation Strategy** | Multiple separate REST calls from frontend (`/health`, `/vaccines`, `/milk`, `/prescriptions`). | Single consolidated EHR aggregator endpoint (`GET /consultations/:consultationId/ehr`). | **Selected: Option B**. Consultation rooms (especially live video WebRTC) require instant, complete clinical context in a single round-trip. Multiple HTTP requests introduce network waterfall latency and inconsistent clinical state during live telemedicine triage. |
| **Withdrawal Alert Calculation** | Pre-computed in a background cron worker and stored in DB. | Dynamically computed on-the-fly from active prescriptions during EHR retrieval. | **Selected: Option B**. Guarantees 100% real-time accuracy based on exact retrieval timestamp. Lightweight date math (`signedAt + withdrawalDays > now`) avoids stale cache risks for critical food safety compliance. |
| **Access Control Boundary** | Allow any authenticated veterinarian to view any animal's EHR across the entire platform. | Strict multi-tenant isolation: Vet must be assigned to consultation, or user must be farm member, or user has admin role. | **Selected: Option B**. Enforces tenant privacy, HIPAA/GDPR-equivalent medical data confidentiality, and prevents unauthorized browsing of commercial farm livestock records. |

---

## 4. Data Models & Contracts

### Shared Types (`packages/shared-types`)

```typescript
export interface EhrActiveWithdrawalAlertDto {
  prescriptionId: string;
  medicationName: string;
  withdrawalDays: number;
  withdrawalType: "MILK" | "MEAT" | "BOTH";
  signedAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface EhrClinicalHighlightsDto {
  totalHealthIncidents: number;
  activeUnresolvedIncidents: number;
  totalVaccinationsAdministered: number;
  overduePreventativeCount: number;
  activeWithdrawalAlertsCount: number;
  lifetimeMedicalCostCents: number;
  lastWeightKg: number | null;
  lastYieldLiters: number | null;
}

export interface EhrAnimalSummaryDto {
  id: string;
  farmId: string;
  tagNumber: string;
  rfidNumber: string | null;
  name: string | null;
  species: AnimalSpecies;
  breed: string | null;
  gender: AnimalGender;
  dateOfBirth: string | null;
  ageFormatted: string;
  weightKg: number | null;
  status: AnimalStatus;
  sire?: { id: string; tagNumber: string; species: string } | null;
  dam?: { id: string; tagNumber: string; species: string } | null;
  farm: { id: string; name: string; farmType: string; country: string };
}

export interface EhrClinicalIncidentDto {
  id: string;
  eventType: HealthEventType;
  severity: SeverityLevel;
  symptoms: string;
  diagnosis: string | null;
  treatment: string | null;
  cost: number;
  resolvedAt: string | null;
  isResolved: boolean;
  recordedBy: { id: string; name: string };
  attendingVet?: { id: string; name: string } | null;
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    s3Key: string;
    caption: string | null;
  }[];
  createdAt: string;
}

export interface EhrPreventativeRecordDto {
  id: string;
  recordType: VaccineRecordType;
  vaccineName: string;
  batchNumber: string | null;
  doseAmount: number;
  doseUnit: string;
  cost: number;
  administeredAt: string;
  nextDueDate: string | null;
  isOverdue: boolean;
  administeredBy: { id: string; name: string };
}

export interface EhrWeightRecordDto {
  id: string;
  weightKg: number;
  recordedAt: string;
  notes: string | null;
  recordedBy: { id: string; name: string };
  weightChangeKg?: number | null;
}

export interface EhrMilkProductionSummaryDto {
  recentLogs: {
    id: string;
    session: MilkSession;
    yieldLiters: number;
    fatPercent: number | null;
    snfPercent: number | null;
    loggedDate: string;
  }[];
  avgYield7Days: number | null;
  avgYield30Days: number | null;
  anomalies: {
    id: string;
    loggedDate: string;
    currentYieldLiters: number;
    baselineYieldLiters: number;
    dropPercentage: number;
    severity: MilkAnomalySeverity;
    status: MilkAnomalyStatus;
    clinicalNotes: string | null;
  }[];
}

export interface EhrConsultationHistoryDto {
  id: string;
  type: ConsultationType;
  status: ConsultationStatus;
  chiefComplaint: string;
  vet?: { id: string; name: string } | null;
  feeCents: number;
  createdAt: string;
}

export interface EhrPrescriptionHistoryDto {
  id: string;
  consultationId: string;
  diagnosis: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    withdrawalDays?: number;
    notes?: string;
  }[];
  pdfS3Key: string;
  digitalSignatureHash: string;
  signedAt: string;
  vet: { id: string; name: string };
}

export interface AnimalEhrResponseDto {
  animal: EhrAnimalSummaryDto;
  highlights: EhrClinicalHighlightsDto;
  activeWithdrawalAlerts: EhrActiveWithdrawalAlertDto[];
  clinicalIncidents: EhrClinicalIncidentDto[];
  preventativeRecords: EhrPreventativeRecordDto[];
  weightHistory: EhrWeightRecordDto[];
  milkProduction?: EhrMilkProductionSummaryDto | null;
  consultationHistory: EhrConsultationHistoryDto[];
  prescriptionHistory: EhrPrescriptionHistoryDto[];
}
```

---

## 5. Security & Edge Cases

1. **Authorization & Privacy**:
   - `GET /consultations/:consultationId/ehr`:
     - Verifies user is either:
       a) Attending veterinarian (`vetId === user.sub`),
       b) Clinic triage officer / administrator (`ADMIN` or `SUPER_ADMIN`),
       c) Owner or manager of the farm owning the consultation.
   - Unauthorized access attempts throw `ForbiddenOperationException`.
2. **Consultation Without Linked Animal**:
   - If a consultation is an async ticket without a specific animal selected (e.g. whole-flock or barn inquiry), the endpoint returns a clear 404/validation error directing to whole-farm history or advising linking an animal.
3. **Food Safety Compliance (Withdrawal Calculation)**:
   - Evaluates each medication in `prescription.medications`.
   - If `withdrawalDays > 0`:
     - `expiresAt = signedAt + (withdrawalDays * 86,400,000 ms)`.
     - If `expiresAt > now`:
       - Emits an active alert with `daysRemaining = ceil((expiresAt - now) / 86400000)`.
4. **Audit Trail**:
   - Emits structured audit log `ANIMAL_EHR_VIEWED` with `animalId`, `consultationId`, `viewerUserId`, `viewerRole`, and `traceId`.
