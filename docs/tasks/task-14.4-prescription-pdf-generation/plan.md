# Task 14.4 Execution Plan: Dynamic Prescription PDF Generation

## 1. Prerequisites

- Task 14.1 (Structured prescription editor), Task 14.2 (Withdrawal period alerts), and Task 14.3 (PKI RSA-SHA256 signature) completed and verified.
- `pdf-lib`, `qrcode`, and `@aws-sdk/client-s3` installed.
- `IS3StorageService` and `S3StorageService` available.

---

## 2. Implementation Steps

### Step 1: Storage Layer Enhancement
- [x] Add `uploadBuffer` to `IS3StorageService` in `apps/api/src/modules/media/services/s3-storage.service.interface.ts`.
- [x] Implement `uploadBuffer` in `apps/api/src/modules/media/services/s3-storage.service.ts`.
- [x] Update `apps/api/src/modules/media/services/s3-storage.service.spec.ts` if needed.

### Step 2: PDF Generation Service (`PrescriptionPdfService`)
- [x] Create `IPrescriptionPdfService` in `apps/api/src/modules/consultations/services/prescription-pdf.service.interface.ts`:
  - `generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer>`
  - Token: `PRESCRIPTION_PDF_SERVICE`
- [x] Implement `PrescriptionPdfService` in `apps/api/src/modules/consultations/services/prescription-pdf.service.ts`:
  - Letterhead header ("VETRALINK PRO CLINICAL TELEHEALTH").
  - Metadata section (Consultation ID, Prescription ID, Date, Vet Name & License #, Farm & Animal Info).
  - Clinical Diagnosis & Notes box.
  - Medication table (Drug Name, Formulation, Route, Dosage, Frequency, Duration, Instructions).
  - Food safety & Withdrawal period warning box (if withdrawal days > 0).
  - QR Code generation (`qrcode.toBuffer`) and embedding in the PDF.
  - Digital signature hash display & verification instructions.
- [x] Register and export `PrescriptionPdfService` in `apps/api/src/modules/consultations/consultations.module.ts`.

### Step 3: Integrate with Prescription Signing & S3 Upload
- [x] Inject `PRESCRIPTION_PDF_SERVICE` and `S3_STORAGE_SERVICE` into `PrescriptionService`.
- [x] In `PrescriptionService.signPrescription`:
  - After computing digital signature, call `prescriptionPdfService.generatePrescriptionPdf(...)`.
  - Upload PDF buffer to S3: `prescriptions/${consultationId}/prescription-${prescription.id}.pdf`.
  - Pass S3 key to `prescription.sign(digitalSignature, s3Key, signDate)`.
- [x] In `IPrescriptionService` and `PrescriptionService`:
  - Add `getPrescriptionPdf(consultationId: string, user: JwtPayload): Promise<{ buffer: Buffer; fileName: string; s3Key?: string | null }>`

### Step 4: REST Controller Endpoints
- [x] Add `GET /consultations/:id/prescription/pdf` endpoint in `PrescriptionsController`:
  - Decorate with `@Roles(SUPER_ADMIN, ADMIN, VET, FARMER)`.
  - Stream the PDF buffer with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="prescription-<id>.pdf"`.

### Step 5: Unit & Integration Tests Verification
- [x] Write `prescription-pdf.service.spec.ts` testing PDF generation, QR code embedding, letterhead, and medication table formatting.
- [x] Update `prescription.service.spec.ts` with PDF generation and S3 upload during signing.
- [x] Update `prescriptions.controller.spec.ts` with `GET :id/prescription/pdf` test cases.
- [x] Run test suite (`pnpm --filter @vetralink/api test prescription`).
- [x] Run full build (`pnpm --filter @vetralink/api build`).

---

## 3. Verification & Acceptance Criteria

- [x] PDF document generated has valid PDF magic bytes (`%PDF-1.7`).
- [x] PDF includes clinic letterhead, veterinarian name, and veterinarian license number.
- [x] QR code is generated and embedded cleanly into the PDF.
- [x] Medication items are rendered with formulation, route, dosage, frequency, and withdrawal days.
- [x] Food safety alert is included whenever milk or meat withdrawal periods are present.
- [x] S3 upload stores the PDF and assigns `pdfS3Key` to the prescription entity upon signing.
- [x] `GET /consultations/:id/prescription/pdf` streams the signed PDF file.
- [x] All unit test suites pass and build succeeds.
