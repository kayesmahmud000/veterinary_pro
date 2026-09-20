# Task 14.1 Specification: Structured Prescription Editor

## 1. Feature Overview & Objective

In veterinary medicine and telemedicine, prescribing medications requires rigorous clinical structure to prevent dosing errors, ensure pharmacological efficacy, and protect public health through food safety compliance (meat and milk withdrawal periods).

This feature establishes the **Structured Prescription Editor** for attending veterinarians. It enables doctors to create and maintain comprehensive, structured digital prescriptions during or after tele-veterinary consultations.

Key Objectives:
1. **Structured Medication Schema**: Enforce structured fields for each prescribed medication:
   - Drug Name / Active Ingredient
   - Formulation (`INJECTABLE`, `ORAL_SUSPENSION`, `BOLUS_TABLET`, `TOPICAL_SPRAY`, `INTRAMAMMARY`, `POWDER`, `EYE_DROPS`, `OTHER`)
   - Dosage (e.g., `20 mg/kg` or `10 ml`)
   - Frequency (e.g., `Once daily (SID)`, `Twice daily (BID)`, `Single administration`)
   - Duration in days (e.g., `5 days`)
   - Route of administration (`INTRAMUSCULAR`, `SUBCUTANEOUS`, `INTRAVENOUS`, `ORAL`, `TOPICAL`, `INTRAMAMMARY`, `OTHER`)
   - Meat & Milk withdrawal periods in days (critical for food-producing animals)
   - Specific clinical administration instructions / notes
2. **Prescription Lifecycle State Machine**:
   - `DRAFT`: Initial editable state created by the attending veterinarian.
   - `SIGNED`: Cryptographically signed with digital signature (Task 14.3). Immutable once signed.
   - `REVOKED`: Cancelled or superseded by a revised prescription.
3. **Role-Based Access Control**:
   - **Creation & Editing**: Strictly restricted to the assigned attending veterinarian (`consultation.vetId === requestingUser.sub`) or clinic administrators.
   - **Viewing**: Attending veterinarians and admins can view draft and signed prescriptions. Client farmers can view signed prescriptions for their consultations (drafts remain hidden).
4. **Auditability**: Complete audit trail for prescription creation, edits, and status transitions.

---

## 2. Current State vs. Proposed State

### Current State
- `Prescription` model exists in `schema.prisma` with basic fields: `id`, `consultationId`, `vetId`, `diagnosis`, `medications` (unvalidated JSON), `pdfS3Key` (non-nullable), `digitalSignatureHash` (non-nullable), `signedAt` (non-nullable).
- There is NO domain entity, repository, or service dedicated to managing prescriptions.
- `pdfS3Key`, `digitalSignatureHash`, and `signedAt` being non-nullable prevents saving a draft prescription before signing or before generating a PDF.
- No structured DTOs or enums for medication formulation, route, dosage, or withdrawal days.

### Proposed State
- **Prisma Schema & Database**:
  - Add enums: `PrescriptionStatus` (`DRAFT`, `SIGNED`, `REVOKED`), `MedicationFormulation`, `MedicationRoute`.
  - Update `Prescription` model:
    - Add `status: PrescriptionStatus @default(DRAFT)`.
    - Add `notes: String? @db.Text`.
    - Make `pdfS3Key`, `digitalSignatureHash`, `signedAt` nullable (`String?`, `DateTime?`).
    - Add `updatedAt: DateTime @default(now()) @updatedAt`.
    - Add index on `status`.
  - Migration script created and Prisma client regenerated.
- **Shared Types (`packages/shared-types`)**:
  - Enums: `PrescriptionStatus`, `MedicationFormulation`, `MedicationRoute`.
  - DTOs:
    - `StructuredMedicationItemDto`: Item-level contract.
    - `PrescriptionDto`: Complete prescription contract.
    - `CreatePrescriptionDto`: Request payload for creating a prescription.
    - `UpdatePrescriptionDto`: Request payload for editing a draft prescription.
- **Domain Layer**:
  - `PrescriptionEntity`: Encapsulates invariants (must have diagnosis, at least one medication, valid positive duration and non-negative withdrawal days; prevents editing once SIGNED).
  - `IPrescriptionRepository` & `PrescriptionRepository`: Data access layer for prescriptions.
- **Service Layer**:
  - `IPrescriptionService` & `PrescriptionService`:
    - Validates consultation existence and doctor assignment.
    - Manages prescription draft creation, updates, and retrieval.
    - Records audit logs (`PRESCRIPTION_DRAFTED`, `PRESCRIPTION_UPDATED`).
- **REST Controller**:
  - `PrescriptionsController`:
    - `POST /consultations/:id/prescription`: Create/draft prescription.
    - `GET /consultations/:id/prescription`: Get prescription for consultation.
    - `PATCH /consultations/:id/prescription`: Update draft prescription.
    - Guards: `JwtAuthGuard`, `RolesGuard`.
    - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`, `FARMER` (with conditional visibility).

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A: Freeform Text / JSON | Option B: Strongly-Typed Medication Items (Chosen) | Justification |
| :--- | :--- | :--- | :--- |
| **Medication Item Representation** | Loose JSON with arbitrary keys | Strongly typed `StructuredMedicationItemDto` with validation decorators | Food safety compliance and automated withdrawal alerts (Task 14.2) require strict parsing of `withdrawalDaysMilk` and `withdrawalDaysMeat`. Strongly typed DTOs prevent malformed dosage and duration inputs. |
| **Lifecycle Representation** | Implied by presence of signature hash | Explicit `PrescriptionStatus` enum (`DRAFT`, `SIGNED`, `REVOKED`) | Allows clean decoupling: doctors can save work-in-progress drafts, perform reviews, and sign in a distinct cryptographic step. |
| **Multi-Item Support** | Single drug per consultation | Array of structured medication items | Real-world veterinary cases regularly require combination therapy (e.g., antibiotic + NSAID anti-inflammatory + electrolyte supplement). |

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema Changes

```prisma
enum PrescriptionStatus {
  DRAFT
  SIGNED
  REVOKED
}

enum MedicationFormulation {
  INJECTABLE
  ORAL_SUSPENSION
  BOLUS_TABLET
  TOPICAL_SPRAY
  INTRAMAMMARY
  POWDER
  EYE_DROPS
  OTHER
}

enum MedicationRoute {
  INTRAMUSCULAR
  SUBCUTANEOUS
  INTRAVENOUS
  ORAL
  TOPICAL
  INTRAMAMMARY
  OTHER
}

model Prescription {
  id                   String                @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId       String                @unique @map("consultation_id") @db.Uuid
  vetId                String                @map("vet_id") @db.Uuid
  status               PrescriptionStatus    @default(DRAFT)
  diagnosis            String                @db.Text
  notes                String?               @db.Text
  medications          Json                  // StructuredMedicationItem[]
  pdfS3Key             String?               @map("pdf_s3_key") @db.Text
  digitalSignatureHash String?               @map("digital_signature_hash") @db.Text
  signedAt             DateTime?             @map("signed_at") @db.Timestamptz(6)
  createdAt            DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime              @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  vet          User         @relation(fields: [vetId], references: [id], onDelete: Restrict)

  @@index([vetId])
  @@index([status])
  @@map("prescriptions")
}
```

### 4.2 Shared Types & DTOs

```typescript
export interface StructuredMedicationItemDto {
  name: string;
  formulation: MedicationFormulation;
  dosage: string;
  frequency: string;
  durationDays: number;
  route: MedicationRoute;
  withdrawalDaysMilk: number;
  withdrawalDaysMeat: number;
  instructions?: string;
}

export interface PrescriptionDto {
  id: string;
  consultationId: string;
  vetId: string;
  vetName: string;
  status: PrescriptionStatus;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  pdfS3Key?: string | null;
  digitalSignatureHash?: string | null;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrescriptionDto {
  diagnosis: string;
  notes?: string;
  medications: StructuredMedicationItemDto[];
}

export interface UpdatePrescriptionDto {
  diagnosis?: string;
  notes?: string;
  medications?: StructuredMedicationItemDto[];
}
```

---

## 5. Security & Edge Cases

1. **Strict Vet Assignment Gating**:
   - Only the assigned attending veterinarian (`consultation.vetId === requestingUser.sub`) or platform administrators can create or update a prescription.
2. **Draft Confidentiality**:
   - Farmers can only view prescriptions that have reached `SIGNED` status. Draft prescriptions are hidden from clients to prevent premature or dangerous drug administration before doctor review.
3. **Immutability of Signed Prescriptions**:
   - Once a prescription transitions to `SIGNED`, any attempt to modify its diagnosis or medications throws `ValidationDomainException("Cannot modify a signed prescription.")`.
4. **Validation Rules**:
   - `diagnosis` cannot be empty.
   - `medications` array must contain at least one valid medication item.
   - For each medication item:
     - `name`, `dosage`, `frequency` must be non-empty strings.
     - `durationDays` must be an integer >= 1.
     - `withdrawalDaysMilk` and `withdrawalDaysMeat` must be integers >= 0.
