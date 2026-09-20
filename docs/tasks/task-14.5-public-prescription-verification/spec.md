# Task 14.5 Specification: Public Cryptographic Verification Endpoint (`/verify/prescription/:id`)

## 1. Feature Overview & Objective
Veterinary prescriptions frequently cross institutional boundaries into the public domain—being presented to dispensing pharmacists, abattoir meat inspectors, dairy processing plant food safety officers, export/import customs agents, and livestock buyers.

To establish non-repudiation and food safety integrity without compromising platform data security, Task 14.5 provides a dedicated, unauthenticated, rate-limited public verification endpoint:
`GET /verify/prescription/:id`

This endpoint:
1. Accepts either a `consultationId` or a `prescriptionId` as the `:id` parameter.
2. Performs real-time cryptographic verification of the prescription's RSA-SHA256 signature against the canonical data payload and the clinic's public key.
3. Detects any database tampering (e.g. altered dosages, modified drug names, adjusted withdrawal periods) and returns an explicit invalidation warning.
4. Returns a comprehensive public verification summary including attending veterinarian credentials (name & license #), farm & animal identifiers, clinical diagnosis, prescribed medications, and food safety withdrawal clearance dates.
5. Employs `@Public()` to bypass JWT authentication guards while remaining protected by NestJS rate limiting (`@Throttle()`).

---

## 2. Current State vs. Proposed State

### Current State
- `PrescriptionService.verifyPrescriptionSignature(consultationId)` exists, but is currently scoped only to authenticated internal endpoints with `@UseGuards(JwtAuthGuard, RolesGuard)` under `/consultations/:id/prescription/verify-signature`.
- External stakeholders (pharmacists, food inspectors, slaughterhouses) cannot access this endpoint without a VetraLink Pro login.
- No public verification controller exists under the canonical path `/verify/prescription/:id`.

### Proposed State
- Add `PublicPrescriptionVerificationDto` to `@vetralink/shared-types`.
- Add `publicVerifyPrescription(id: string): Promise<PublicPrescriptionVerificationDto>` to `IPrescriptionService` and `PrescriptionService`:
  - Flexible lookup by `consultationId` or `prescriptionId`.
  - Reconstructs `CanonicalPrescriptionPayload`.
  - Verifies RSA-SHA256 digital signature via `PkiCryptoService.verify()`.
  - Computes food safety harvest clearance dates based on `signedAt + withdrawalDays`.
- Create `PrescriptionVerificationController` under `apps/api/src/modules/consultations/controllers/prescription-verification.controller.ts`:
  - Route: `GET /verify/prescription/:id`.
  - Decorated with `@Public()` to bypass JWT auth.
  - Swagger documentation with detailed response models.
- Register `PrescriptionVerificationController` in `ConsultationsModule`.

---

## 3. Architectural & Design Trade-offs

### Option A: Require API Key or Guest Session for Verification
- **Pros**: Restricts access to registered third parties.
- **Cons**: High friction for pharmacists or food inspectors who scan a physical QR code at a collection center and cannot register on-the-spot.
- **Decision**: Rejected. Prescriptions must be publicly verifiable like verifiable credentials or signed PDF documents.

### Option B: Public Endpoint with Strict Rate Limiting & Minimal Sensitive PII (Selected)
- **Pros**:
  - Instant verification for anyone scanning the QR code on a paper prescription or digital PDF.
  - Zero barrier to entry for food safety authorities.
  - Rate limiting protects against enumeration attacks.
  - Returns only medical verification data, attending vet license, and animal tag, omitting farmer passwords, payment details, or internal notes.
- **Decision**: Selected as the industry standard for veterinary and pharmaceutical telehealth verification.

---

## 4. Data Models & Contracts

### 4.1 Shared DTO (`packages/shared-types`)
```ts
export interface PublicPrescriptionVerificationDto {
  isValid: boolean;
  status: PrescriptionStatus;
  algorithm: string;
  prescriptionHash: string;
  signedAt: string | null;
  consultationId: string;
  prescriptionId: string;
  clinicName: string;
  attendingVet: {
    name: string;
    licenseNumber: string;
  };
  farm: {
    name: string;
  };
  animal: {
    species: string;
    tagNumber: string;
    name?: string | null;
  };
  diagnosis: string;
  medications: Array<{
    name: string;
    formulation: string;
    route: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    withdrawalDays: number;
    withdrawalDaysMilk?: number;
    withdrawalDaysMeat?: number;
    instructions?: string;
  }>;
  withdrawalSummary: {
    hasActiveWithdrawal: boolean;
    maxWithdrawalDays: number;
    milkWithdrawalDays: number;
    meatWithdrawalDays: number;
    safeHarvestDate?: string | null;
  };
  verifiedAt: string;
  tamperWarning?: string;
}
```

---

## 5. Security & Edge Cases
1. **Data Tampering Detection**:
   - If any data point in the prescription (e.g. drug name, dosage, withdrawal duration) is modified in the database post-signing, the canonical hash will differ from the signed RSA hash, and `isValid` will be `false` with `tamperWarning` populated.
2. **Draft / Unsigned Prescriptions**:
   - If a prescription has not been signed yet, the endpoint returns `isValid: false`, `status: DRAFT`, and states that the prescription has not been certified.
3. **Revocation**:
   - If a prescription was revoked, `status: REVOKED` is returned with `isValid: false`.
4. **Rate Limiting**:
   - Standard throttling prevents brute-force scraping of prescription IDs.
