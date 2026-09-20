# Task 14.5 Execution Plan: Public Cryptographic Verification Endpoint (`/verify/prescription/:id`)

## 1. Prerequisites

- Tasks 14.1 through 14.4 completed and verified.
- `PkiCryptoService` with `verify`, `hash`, and `canonicalize` available.
- `@Public()` decorator and `JwtAuthGuard` / `RolesGuard` support available.

---

## 2. Implementation Steps

### Step 1: Shared DTO & Contracts (`packages/shared-types`)
- [x] Add `PublicPrescriptionVerificationDto` in `packages/shared-types/src/dto/consultations/prescription.dto.ts`.
- [x] Export and rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Service Layer Verification Method
- [x] Update `IPrescriptionService` in `apps/api/src/modules/consultations/services/prescription.service.interface.ts`:
  - `publicVerifyPrescription(id: string): Promise<PublicPrescriptionVerificationDto>`
- [x] Implement `publicVerifyPrescription(id: string)` in `apps/api/src/modules/consultations/services/prescription.service.ts`:
  - Find prescription by `consultationId` or `prescriptionId`.
  - Fetch consultation, animal, farm, and vet profile.
  - Reconstruct canonical prescription payload.
  - Verify RSA-SHA256 digital signature against canonical payload and public key.
  - Calculate safe food harvest clearance date (`signedAt + maxWithdrawalDays`).
  - Return `PublicPrescriptionVerificationDto`.

### Step 3: Public REST Controller & Module Wiring
- [x] Create `PrescriptionVerificationController` in `apps/api/src/modules/consultations/controllers/prescription-verification.controller.ts`:
  - Route: `@Controller("verify/prescription")`.
  - Decorator: `@Public()`.
  - Endpoint: `GET :id`.
  - Swagger annotations (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, `@ApiNotFoundResponse`).
- [x] Register `PrescriptionVerificationController` in `ConsultationsModule`.

### Step 4: Unit & Integration Tests Verification
- [x] Update `prescription.service.spec.ts` with `publicVerifyPrescription` test cases:
  - Lookup by consultationId and by prescriptionId.
  - Valid signed prescription returns `isValid: true`.
  - Tampered payload returns `isValid: false` with warning.
  - Draft or revoked status handled gracefully.
- [x] Write `prescription-verification.controller.spec.ts` testing the public route.
- [x] Run test suite (`pnpm --filter @vetralink/api test prescription`).
- [x] Run full build check (`pnpm --filter @vetralink/api build`).

---

## 3. Verification & Acceptance Criteria

- [x] Unauthenticated `GET /verify/prescription/:id` succeeds without JWT token.
- [x] Resolves prescription by both consultation ID and prescription ID.
- [x] Cryptographic signature verification against RSA public key correctly distinguishes authentic vs tampered payloads.
- [x] Withdrawal summary computes exact days and clearance date for milk and meat.
- [x] All unit and integration tests pass with 100% success rate.
