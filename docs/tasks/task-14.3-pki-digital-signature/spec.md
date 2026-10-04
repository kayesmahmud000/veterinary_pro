# Task 14.3 Specification: PKI Cryptographic Digital Signature (RSA-SHA256) Applied to Prescription Hash

## 1. Feature Overview & Objective

Veterinary prescriptions are legal documents authorizing the distribution and administration of regulated pharmaceuticals to animals. In a telehealth environment, digital prescriptions must guarantee:
1. **Authenticity**: Absolute proof of the attending veterinarian's identity and license.
2. **Integrity**: Mathematical guarantee that the prescription (medications, dosages, withdrawal periods) has not been tampered with or altered after issuance.
3. **Non-repudiation**: The veterinarian cannot deny having issued the signed prescription.
4. **Third-Party Verifiability**: Pharmacists, dairy cooperatives, meat inspectors, and farmers must be able to independently verify the signature using the clinic's/vet's public key.

**Objective of Task 14.3**:
Implement a Public Key Infrastructure (PKI) cryptographic signing pipeline that:
- Generates a deterministic canonical representation of the prescription.
- Computes an immutable SHA-256 hash of the canonical prescription payload.
- Signs the hash using an asymmetric RSA-SHA256 private key (PKCS#1 / PKCS#8).
- Stores the digital signature on the prescription and transitions it to `SIGNED` status.
- Provides cryptographic verification capabilities to validate signatures against the public key.

---

## 2. Current State vs. Proposed State

### Current State
- `PrescriptionEntity` (Task 14.1) has `sign(digitalSignatureHash, pdfS3Key)` method, which sets `status = SIGNED` and records `digitalSignatureHash`.
- No cryptographic service currently implements canonical JSON serialization, SHA-256 hashing, RSA-SHA256 signature generation, or verification.
- `PrescriptionsController` has `POST`, `GET`, `PATCH` endpoints, but no `POST /consultations/:id/prescription/sign` endpoint.
- `VetProfile` does not currently persist a veterinarian's official license number (`license_number`).

### Proposed State
- **Database Schema**:
  - Add `licenseNumber String? @map("license_number") @db.VarChar(100)` to `VetProfile`.
  - Create migration `20260920240000_add_vet_license_number`.
- **Cryptographic Service (`PkiCryptoService`)**:
  - Implements `IPkiCryptoService` under `apps/api/src/common/crypto/`.
  - Canonical JSON stringifier ensuring stable key ordering and whitespace.
  - SHA-256 cryptographic digest calculation.
  - RSA-SHA256 digital signature generation (`crypto.createSign("RSA-SHA256")`) with Base64 output.
  - RSA-SHA256 digital signature verification (`crypto.createVerify("RSA-SHA256")`).
  - Key management: loads PEM RSA keys from environment configuration or generates a resilient RSA-2048 keypair on startup if keys are not configured.
- **Service Layer (`PrescriptionService.signPrescription`)**:
  - Validates attending veterinarian authorization and `DRAFT` status.
  - Compiles canonical prescription payload: `prescriptionId`, `consultationId`, `vetId`, `vetName`, `vetLicenseNumber`, `animalId`, `animalTag`, `farmId`, `diagnosis`, `medications`, `signedAt`.
  - Applies RSA-SHA256 signature to the prescription hash.
  - Persists signed prescription in the database.
  - Emits `PRESCRIPTION_DIGITALLY_SIGNED` tamper-evident audit log.
- **REST Endpoint**:
  - `POST /consultations/:id/prescription/sign`: Signs the prescription and returns the updated `PrescriptionDto`.

---

## 3. Architectural & Design Trade-offs

| Option | Description | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Symmetric HMAC (HMAC-SHA256)** | Use a shared secret to sign the prescription | Fast, simple implementation | Cannot be verified publicly by third parties (pharmacists/inspectors) without revealing the secret key | **Rejected** |
| **Option B: Asymmetric PKI (RSA-SHA256)** | Sign with private key; verify with public key | Industry standard for digital signatures; non-repudiation; public key can be safely shared for public verification (Task 14.5) | Key management complexity | **Accepted** |
| **Option C: ECDSA (secp256k1 / prime256v1)** | Elliptic curve digital signatures | Smaller signature size | Less universally supported in legacy PDF signers and enterprise PKI tooling compared to RSA-SHA256 | **Rejected** |

### Justification:
RSA-SHA256 is the global veterinary and medical prescription standard (and PDF digital signature standard). It allows public verification via the clinic's public key or certificates without exposing private keys.

---

## 4. Data Models & Contracts

### 4.1 Schema Update (`apps/api/prisma/schema.prisma`)
```prisma
model VetProfile {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String   @unique @map("user_id") @db.Uuid
  licenseNumber  String?  @map("license_number") @db.VarChar(100)
  specialties    Json     @default("[]")
  ...
}
```

### 4.2 Shared DTOs (`packages/shared-types/src/dto/consultations/prescription.dto.ts`)
```typescript
export interface SignPrescriptionDto {
  licenseNumber?: string;
}

export interface CanonicalPrescriptionPayload {
  prescriptionId: string;
  consultationId: string;
  vetId: string;
  vetName: string;
  vetLicenseNumber: string;
  animalId: string;
  animalTag: string;
  farmId: string;
  diagnosis: string;
  notes?: string | null;
  medications: StructuredMedicationItemDto[];
  withdrawalDays: number;
  signedAt: string;
}

export interface SignatureVerificationResultDto {
  isValid: boolean;
  algorithm: string;
  prescriptionHash: string;
  signedAt: string;
  signerVetName: string;
  signerLicenseNumber: string;
}
```

---

## 5. Security & Edge Cases

1. **Private Key Protection**: The RSA private key is never exposed via any API endpoint. Only public keys are shared.
2. **Canonical JSON Determinism**: Object key ordering is deterministic (alphabetically sorted keys) to ensure that the identical payload always produces the identical SHA-256 hash.
3. **Draft Immutability Enforced**: Once signed, `PrescriptionEntity.update` throws `ValidationDomainException`.
4. **Re-signing Prevention**: Attempting to sign an already `SIGNED` prescription throws `ValidationDomainException`.
5. **Fallback Key Generation**: If `RSA_PRIVATE_KEY` / `RSA_PUBLIC_KEY` are not set in the environment (e.g., local development or CI test runs), the service generates a valid 2048-bit RSA keypair in-memory rather than crashing.
