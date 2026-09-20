# Task 14.4 Specification: Dynamic Prescription PDF Generation with Letterhead, Vet License # & Verify QR Code

## 1. Feature Overview & Objective
In veterinary telehealth and clinical practice, legal compliance and food safety require an official, human-readable, and machine-verifiable physical document (PDF). Task 14.4 implements an automated PDF generation pipeline for signed veterinary prescriptions.

Each generated PDF document includes:
1. **Clinic Letterhead**: Professional clinic branding, title ("VETRALINK PRO CLINICAL TELEHEALTH"), and document metadata.
2. **Attending Veterinarian Credentials**: Full doctor name and professional veterinary license number (`VetProfile.licenseNumber`).
3. **Animal & Farm Identification**: Farm name, animal ear tag number, species, name, and owner details.
4. **Clinical Diagnosis & Notes**: Detailed diagnosis and veterinarian clinical guidance.
5. **Structured Medication Table**: Tabular listing of each prescribed drug, formulation, route of administration, dosage, frequency, duration, and instructions.
6. **Food Safety & Withdrawal Alert**: Prominently styled alert section showing milk and meat withdrawal periods and safe consumption clearance dates for food-producing animals.
7. **PKI Verification & QR Code**: Embeds an RSA-SHA256 cryptographic stamp, signature hash snippet, and a high-resolution QR code linking to the public verification endpoint (`/verify/prescription/:id`).
8. **Cloud Archival**: Automatically uploads the generated PDF to S3/MinIO storage (`prescriptions/:consultationId/prescription-:id.pdf`) and binds `pdfS3Key` to the prescription entity.

---

## 2. Current State vs. Proposed State

### Current State
- `PrescriptionEntity` has `pdfS3Key: string | null`, currently defaulted to `null`.
- `signPrescription` generates RSA-SHA256 signature hash and transitions prescription to `SIGNED`, but does not generate or upload the PDF document.
- There is no endpoint for farmers or vets to view/download the generated PDF.
- `pdf-lib` and `qrcode` are installed in `apps/api/package.json`.

### Proposed State
- Create `IPrescriptionPdfService` and `PrescriptionPdfService` in `apps/api/src/modules/consultations/services/`.
- Use `pdf-lib` and `qrcode` to generate a professional, multi-section A4 veterinary prescription PDF.
- Embed a QR code pointing to the verification portal (`/verify/prescription/:id`).
- When `PrescriptionService.signPrescription` is invoked:
  - Generate the PDF buffer.
  - Upload the PDF to S3 under `prescriptions/${consultationId}/prescription-${prescription.id}.pdf` using `S3StorageService`.
  - Store the `pdfS3Key` in `PrescriptionEntity`.
- Expose `GET /consultations/:id/prescription/pdf` endpoint in `PrescriptionsController`:
  - Returns a presigned download URL or streams the PDF buffer directly with `Content-Type: application/pdf`.

---

## 3. Architectural & Design Trade-offs

### Option A: Headless Chromium / Puppeteer HTML-to-PDF
- **Pros**: Easy styling with CSS/HTML.
- **Cons**: Requires launching a full Chromium browser instance in Docker/production (~400MB RAM per process), high CPU overhead, slow startup latency (1-3 seconds), and frequent crashing under concurrent load.

### Option B: Native `pdf-lib` with vector primitives (Selected)
- **Pros**:
  - 100% pure JavaScript/TypeScript with zero native binary dependencies.
  - Sub-millisecond rendering speed (~15ms per document).
  - Minimal memory footprint (<10MB).
  - Complete control over typography, layouts, colors, tables, and embedded PNG images (QR codes).
  - Rock-solid stability in containerized microservices and serverless environments.
- **Cons**:
  - Layout is calculated programmatically with coordinate mathematics rather than HTML/CSS box models.
- **Decision**: Option B is selected for exceptional performance, low memory footprint, deterministic output, and zero external binary dependencies.

---

## 4. Data Models & Contracts

### 4.1 Prescription PDF Data Transfer Object
```ts
export interface PrescriptionPdfData {
  prescriptionId: string;
  consultationId: string;
  clinicName: string;
  vetName: string;
  vetLicenseNumber: string;
  farmName: string;
  farmerName: string;
  animalTag: string;
  animalName?: string;
  animalSpecies: string;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  withdrawalDays: number;
  withdrawalDaysMilk?: number;
  withdrawalDaysMeat?: number;
  digitalSignatureHash: string;
  signedAt: string;
  verifyUrl: string;
}
```

### 4.2 Endpoint Contracts
- `GET /consultations/:id/prescription/pdf`:
  - Query param: `download?: boolean`
  - Response: Binary PDF stream (`Content-Type: application/pdf`) or JSON envelope with presigned URL (`{ downloadUrl: string, expiresAt: string }`).

---

## 5. Security & Edge Cases
1. **Access Control**:
   - Only attending vet, admins, and the animal/farm owner can access the PDF endpoint.
   - Draft prescriptions cannot generate a signed PDF until officially signed.
2. **Tamper Proofing**:
   - The PDF displays the exact RSA-SHA256 signature hash computed during signing.
   - The embedded QR code directs verifiers to the independent verification endpoint where the canonical payload is verified cryptographically against the clinic's public key.
3. **Resilience**:
   - If S3 upload is temporarily unreachable, the service can generate the PDF dynamically on-the-fly and deliver it to the user.
