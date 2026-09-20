# Specification: Task 14.6 - Automatic Append of Prescription into Animal Permanent EHR Record

## 1. Feature Overview & Objective
In veterinary telemedicine, completing a consultation and signing a digital prescription must not leave prescription data isolated within the tele-consultation module. For continuity of clinical care, food safety compliance, farm audits, and animal health history, any signed prescription must automatically and atomically append into the animal's permanent Electronic Health Record (`HealthRecord` / EHR).

The objective of Task 14.6 is to:
1. Automatically create or link a permanent `HealthRecord` clinical incident entry when a prescription is digitally signed (`POST /consultations/:id/prescription/sign`).
2. Populate the permanent `HealthRecord` with complete clinical encounter data:
   - `farmId`: Farm tenant ID from consultation.
   - `animalId`: Target animal ID.
   - `recordedById`: Veterinarian user ID authoring/signing the prescription.
   - `attendingVetId`: Attending veterinarian ID.
   - `eventType`: `HealthEventType.ILLNESS` (or appropriate clinical category).
   - `severity`: `SeverityLevel.MEDIUM` (or determined based on urgency).
   - `symptoms`: Consultation chief complaint.
   - `diagnosis`: Prescription diagnosis.
   - `treatment`: Comprehensive formatted text of all prescribed medications (names, dosages, routes, frequencies, durations, and food safety withdrawal days).
   - `cost`: Consultation fee in standard currency units (`feeCents / 100`).
   - `resolvedAt`: `null` (active under treatment) to ensure the clinical incident remains tracked until completion.
3. Ensure seamless integration with `AnimalEhrService`:
   - Permanent health records appear in `clinicalIncidents`.
   - Prescription history appears in `prescriptionHistory`.
   - Active drug withdrawal periods for milk/meat consumption are tracked and reflected in `activeWithdrawalAlerts`.
   - Clinical highlights and lifetime medical costs accurately aggregate the consultation and prescription data.
4. Provide idempotency so re-signing or retried signing operations do not duplicate EHR entries.
5. Gracefully handle herd/flock-level consultations where `animalId` is null (skipping individual EHR append while logging audit records).

---

## 2. Current State vs. Proposed State

### Current State:
- `PrescriptionService.signPrescription` signs the prescription using RSA-SHA256, generates the dynamic PDF, uploads it to S3, and transitions the prescription status to `ISSUED`.
- `AnimalEhrService` queries `prisma.healthRecord` for `clinicalIncidents` and `prisma.prescription` (via `consultation.animalId`) for `prescriptionHistory` and `activeWithdrawalAlerts`.
- However, when a prescription is signed, no permanent `HealthRecord` entry is automatically generated in the `health_records` table. On-premise farm health event queries, farm management export logs, and clinical incident reports that only query `health_records` miss the tele-veterinary consultation diagnosis and prescribed treatments.

### Proposed State:
- When `PrescriptionService.signPrescription` executes:
  - If `consultation.animalId` is present, it constructs and persists a permanent `HealthRecord` entry atomically or transactionally.
  - The `HealthRecord` contains structured treatment details matching all prescribed medications, diagnosis, attending vet, and cost.
  - An audit log `PRESCRIPTION_EHR_APPENDED` is recorded.
  - `AnimalEhrService` immediately reflects the new incident in `clinicalIncidents`, updates `highlights.totalHealthIncidents`, and updates `highlights.lifetimeMedicalCostCents`.
  - If `consultation.animalId` is absent (flock/herd consultation), individual EHR append is safely bypassed with an informational log.

---

## 3. Architectural & Design Trade-offs

### Option A: Direct Prisma Transaction in `PrescriptionService` vs. Option B: Injecting `IHealthRecordRepository` / `ClinicalHealthService`
- **Option A (Direct Prisma / Repository Integration in `PrescriptionService`)**:
  - `PrescriptionService` already has `PrismaService` injected.
  - It can directly query/create the `HealthRecord` model via `prisma.healthRecord.create` or `HealthRecordEntity.create`.
  - Avoids circular dependency risks between `ConsultationsModule` and `ClinicalHealthModule`.
  - Transactional safety: Can be executed within a transaction alongside prescription signing.
- **Option B (Calling `ClinicalHealthService.createIncident`)**:
  - Requires importing `ClinicalHealthModule` into `ConsultationsModule`. While currently unidirectional, it increases coupling between the modules and introduces extraneous validation overhead (e.g. re-checking animal status, user profiles) that `PrescriptionService` has already validated.
- **Decision**: Use `PrismaService` (with `HealthRecordEntity` domain model validation if helpful) inside `PrescriptionService` to atomically create the permanent EHR `HealthRecord`. This guarantees zero circular dependency risk, maximum performance, and clean transactional consistency.

---

## 4. Data Models & Contracts

### HealthRecord Schema Mapping
```typescript
{
  id: crypto.randomUUID(),
  farmId: consultation.farmId,
  animalId: consultation.animalId,
  recordedById: author.sub,
  attendingVetId: vetId,
  eventType: HealthEventType.ILLNESS,
  severity: SeverityLevel.MEDIUM,
  symptoms: consultation.chiefComplaint || `Prescription issued for ${prescription.diagnosis}`,
  diagnosis: prescription.diagnosis,
  treatment: formattedTreatmentString,
  cost: new Prisma.Decimal(consultation.feeCents ? consultation.feeCents / 100 : 0),
  resolvedAt: null, // Active treatment regimen
  escalationLevel: 0,
  syncVersion: 1,
  createdAt: signDate,
  updatedAt: signDate,
}
```

### Formatted Treatment String Structure:
```text
Prescription #{prescriptionId} (Consultation #{consultationId}):
- Amoxicillin Trihydrate (15 mg/kg, Twice daily for 5 days) - Route: Intramuscular [Withdrawal: 14 days] - Instructions: Administer deep IM in neck muscle
- Meloxicam (0.5 mg/kg, Once daily for 3 days) - Route: Subcutaneous [Withdrawal: 5 days] - Instructions: With food
Clinical Notes: Re-evaluate if fever persists past 48 hours.
```

---

## 5. Security & Edge Cases
1. **Flock/Herd Consultations (`animalId == null`)**: Gracefully skip individual animal `HealthRecord` append; do not throw error.
2. **Idempotency**: If a `HealthRecord` with the same `consultationId` or `prescriptionId` in `treatment` already exists, update it instead of creating duplicates.
3. **Minimum Symptoms Length Invariant**: `HealthRecordEntity` requires symptoms to be at least 3 characters. Ensure fallback if `consultation.chiefComplaint` is empty or short.
4. **Audit Logging**: Record `PRESCRIPTION_EHR_APPENDED` with trace ID and detailed metadata.
5. **EHR Withdrawal Consistency**: Ensure `AnimalEhrService` correctly computes withdrawal expirations and days remaining when EHR is viewed.
