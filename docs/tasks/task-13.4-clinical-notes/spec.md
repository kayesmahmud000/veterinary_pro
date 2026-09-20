# Task 13.4 Specification: Private Internal Clinical Notes (Accessible Only to Attending Veterinarians)

## 1. Feature Overview & Objective

During and following tele-veterinary consultations, attending veterinarians frequently need to record confidential, doctor-to-doctor clinical observations, preliminary differential working diagnoses, pharmacological hypotheses, follow-up instructions, and SOAP (Subjective, Objective, Assessment, Plan) notes.

These clinical notes must be strictly confidential:
1. **Confidentiality & Privacy**: Never exposed to client farmers, animal caretakers, or unauthorized tenant members.
2. **Access Control**: Accessible exclusively to the assigned attending veterinarian, clinic veterinarians, and platform administrators (`SUPER_ADMIN`, `ADMIN`, `VET`).
3. **Structured SOAP Support**: Support categorizing notes into SOAP notes, differential diagnoses, internal observations, and follow-up plans.
4. **Audit Trail**: Full traceability and audit logging for creation, modification, and deletion of internal clinical notes.
5. **EHR Linkage**: Seamlessly referenced within the consultation's clinical dossier without leaking into farmer-facing summaries or public prescriptions.

---

## 2. Current State vs. Proposed State

### Current State
- `Consultation` model records `chiefComplaint` and `mediaUrls` (submitted by the farmer).
- `Prescription` model stores official signed prescriptions (visible to both farmer and vet).
- `ConsultationMessage` (Task 13.3) records real-time communication visible to all consultation participants (vet, farmer, farm staff).
- There is currently **NO** dedicated mechanism for veterinarians to record private internal clinical notes that remain hidden from farmers and non-medical users.

### Proposed State
- **Prisma Schema & Database**:
  - Add `ClinicalNoteCategory` enum: `SOAP_NOTE`, `DIFFERENTIAL_DIAGNOSIS`, `INTERNAL_OBSERVATION`, `FOLLOW_UP_PLAN`, `GENERAL`.
  - Add `ConsultationClinicalNote` model mapped to `consultation_clinical_notes` table with UUID primary key, `consultationId`, `authorVetId`, `title`, `content` (Markdown/Text), `category`, `isConfidential` (default true), `createdAt`, and `updatedAt`.
  - Add composite index on `[consultationId, createdAt]` and index on `[authorVetId]`.
  - Add relation to `Consultation` (`clinicalNotes`) and `User` (`authoredClinicalNotes`).
  - Migration script created and Prisma client regenerated.
- **Shared Types (`packages/shared-types`)**:
  - `ClinicalNoteCategory` enum.
  - DTOs: `ClinicalNoteDto`, `CreateClinicalNoteDto`, `UpdateClinicalNoteDto`, `QueryClinicalNotesDto`.
- **Domain Layer**:
  - `ConsultationClinicalNoteEntity` encapsulating business invariants (mandatory title/content, author validation, update rules).
  - `IConsultationClinicalNoteRepository` and `ConsultationClinicalNoteRepository`.
- **Service Layer**:
  - `IConsultationClinicalNoteService` and `ConsultationClinicalNoteService`:
    - Strict role enforcement: Only `VET`, `ADMIN`, `SUPER_ADMIN` allowed.
    - Assignment verification: For `VET`, must be the assigned attending veterinarian (`consultation.vetId === requestingUser.sub`) or platform admin.
    - CRUD operations with audit logs: `CLINICAL_NOTE_CREATED`, `CLINICAL_NOTE_UPDATED`, `CLINICAL_NOTE_DELETED`.
- **REST Controller**:
  - `ConsultationClinicalNotesController`:
    - `GET /consultations/:id/clinical-notes`: Paginated list of notes for the consultation.
    - `POST /consultations/:id/clinical-notes`: Create a new clinical note.
    - `GET /consultations/:id/clinical-notes/:noteId`: Retrieve a specific note.
    - `PATCH /consultations/:id/clinical-notes/:noteId`: Update note content/title/category.
    - `DELETE /consultations/:id/clinical-notes/:noteId`: Delete note (only by author vet or admin).
    - Secured with `JwtAuthGuard`, `RolesGuard`, restricting to `Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A: In-table JSON field on Consultation | Option B: Dedicated `ConsultationClinicalNote` Entity (Chosen) | Justification |
| :--- | :--- | :--- | :--- |
| **Data Modeling** | Add `clinicalNotes Json` to `consultations` table | Separate normalized table with FK to `consultations` and `users` | A normalized entity allows multiple timestamped notes per consultation (e.g. initial triage note, mid-call observation, post-call SOAP analysis), granular audit logs, indexed queries, and isolated row-level access control. |
| **Confidentiality Enforcement** | Filter out JSON keys in response interceptor | Controller and service level strict RBAC (Farmer role rejected) | Enforcing rejection at the controller/guard level prevents accidental data leakage in serialization, OpenAPI schemas, or bulk exports. |
| **Note Structure** | Unstructured free text | Categorized notes with category enum (SOAP, Differential Diagnosis, Follow-up) | Structured categorization enables veterinarians to organize complex medical observations according to clinical best practices (SOAP format). |

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema

```prisma
enum ClinicalNoteCategory {
  SOAP_NOTE
  DIFFERENTIAL_DIAGNOSIS
  INTERNAL_OBSERVATION
  FOLLOW_UP_PLAN
  GENERAL
}

model ConsultationClinicalNote {
  id             String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId String               @map("consultation_id") @db.Uuid
  authorVetId    String               @map("author_vet_id") @db.Uuid
  title          String               @db.VarChar(200)
  content        String               @db.Text
  category       ClinicalNoteCategory @default(GENERAL)
  isConfidential Boolean              @default(true) @map("is_confidential")
  createdAt      DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  authorVet    User         @relation("AuthoredClinicalNotes", fields: [authorVetId], references: [id], onDelete: Restrict)

  @@index([consultationId, createdAt])
  @@index([authorVetId])
  @@map("consultation_clinical_notes")
}
```

### 4.2 Shared Types & DTOs

```typescript
export enum ClinicalNoteCategory {
  SOAP_NOTE = "SOAP_NOTE",
  DIFFERENTIAL_DIAGNOSIS = "DIFFERENTIAL_DIAGNOSIS",
  INTERNAL_OBSERVATION = "INTERNAL_OBSERVATION",
  FOLLOW_UP_PLAN = "FOLLOW_UP_PLAN",
  GENERAL = "GENERAL",
}

export interface ClinicalNoteDto {
  id: string;
  consultationId: string;
  authorVetId: string;
  authorVetName: string;
  title: string;
  content: string;
  category: ClinicalNoteCategory;
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicalNoteDto {
  title: string;
  content: string;
  category?: ClinicalNoteCategory;
  isConfidential?: boolean;
}

export interface UpdateClinicalNoteDto {
  title?: string;
  content?: string;
  category?: ClinicalNoteCategory;
  isConfidential?: boolean;
}

export interface QueryClinicalNotesDto {
  category?: ClinicalNoteCategory;
  page?: number;
  limit?: number;
}
```

---

## 5. Security & Edge Cases

1. **Role Gating & Farmer Isolation**:
   - `Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)` applied to the controller class. Any request from a user with role `FARMER` or `BUYER` is rejected with `403 Forbidden` by `RolesGuard`.
2. **Attending Vet Verification**:
   - For veterinarians, `requestingUser.sub` must match `consultation.vetId` or the user must be `ADMIN`/`SUPER_ADMIN`. An unassigned veterinarian cannot inspect another doctor's internal consultation notes.
3. **Modification Protection**:
   - Only the original author veterinarian or an administrator can update or delete a clinical note.
4. **Audit Logging**:
   - Every creation, update, and deletion is recorded in `audit_logs` with the actor ID, entity ID, and trace ID.
