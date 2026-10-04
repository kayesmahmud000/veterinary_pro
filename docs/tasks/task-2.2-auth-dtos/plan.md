# PLAN-202: Authentication DTOs & Contracts Execution Plan
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.2: Auth DTOs (Register, Login, Refresh, OTP) in `@vetralink/shared-types`
# Author: Elite Software Architect & Tech Lead

---

## 1. Prerequisites

- Task 2.1 completed and verified (88 tests passing).
- Clean workspace on branch `dev-backend`.
- `@vetralink/shared-types` initialized with `tsup` bundler.

---

## 2. Granular Implementation Steps

### Step 1: Author Auth DTO Contracts in `packages/shared-types`
- [x] Create `packages/shared-types/src/dto/auth/auth-tokens.dto.ts`:
  - `AuthTokensDto` (`accessToken`, `refreshToken`, `tokenType: "Bearer"`, `expiresIn`).
  - `AuthUserSummary` (public sanitized user identity for web and mobile).
  - `JwtPayload` (standardized JWT claims: `sub`, `email`, `role`, `status`, `activeFarmId`, `jti`, `iat`, `exp`).
- [x] Create `packages/shared-types/src/dto/auth/register.dto.ts`:
  - `RegisterRequestDto` (`email`, `password`, `name`, optional `role`, optional `phone`).
  - `RegisterResponseDto` (`user: AuthUserSummary`, `tokens: AuthTokensDto`).
- [x] Create `packages/shared-types/src/dto/auth/login.dto.ts`:
  - `LoginRequestDto` (`email`, `password`, optional `phone`, optional `rememberMe`).
  - `LoginResponseDto` (`user: AuthUserSummary`, `tokens: AuthTokensDto`).
- [x] Create `packages/shared-types/src/dto/auth/refresh-token.dto.ts`:
  - `RefreshTokenRequestDto` (`refreshToken: string`).
  - `RefreshTokenResponseDto` (`tokens: AuthTokensDto`).
- [x] Create `packages/shared-types/src/dto/auth/otp.dto.ts`:
  - `OtpPurpose` enum (`REGISTRATION_VERIFICATION`, `PASSWORD_RESET`, `PHONE_VERIFICATION`, `LOGIN_2FA`).
  - `OtpChannel` enum (`SMS`, `EMAIL`).
  - `SendOtpRequestDto` (`identifier`, `channel`, `purpose`).
  - `VerifyOtpRequestDto` (`identifier`, `code`, `purpose`).
  - `VerifyOtpResponseDto` (`verified: boolean`, `verificationToken?: string`).
- [x] Create `packages/shared-types/src/dto/auth/password-reset.dto.ts`:
  - `ForgotPasswordRequestDto` (`email: string`).
  - `ResetPasswordRequestDto` (`token: string`, `newPassword: string`).
  - `ChangePasswordRequestDto` (`currentPassword: string`, `newPassword: string`).
- [x] Create `packages/shared-types/src/dto/auth/index.ts` and `packages/shared-types/src/dto/index.ts` barrel exports.

### Step 2: Wire Root Exports in `@vetralink/shared-types`
- [x] Update `packages/shared-types/src/index.ts` to export all DTO contracts.

### Step 3: Bundle and Typecheck `@vetralink/shared-types`
- [x] Run `pnpm --filter @vetralink/shared-types build` (compiles to CJS, ESM, and `.d.ts`).
- [x] Run `pnpm --filter @vetralink/shared-types lint` (`tsc --noEmit`).

### Step 4: Verification in API Gateway
- [x] Verify that `apps/api` can resolve and typecheck all newly defined auth DTOs from `@vetralink/shared-types`.
- [x] Run `pnpm --filter @vetralink/api build` to ensure zero compilation or link errors.
- [x] Run `pnpm --filter @vetralink/api test` to confirm all 88 existing tests remain green.

---

## 3. Verification & Acceptance Criteria

1. **Compilation Verification**:
   ```bash
   pnpm --filter @vetralink/shared-types build
   ```
   Must generate `dist/index.js`, `dist/index.mjs`, and `dist/index.d.ts` without errors.
2. **Type Safety Across Monorepo**:
   ```bash
   pnpm --filter @vetralink/api build
   ```
   Must compile cleanly without missing type references or module resolution warnings.
3. **No Regressions**:
   ```bash
   pnpm --filter @vetralink/api test
   ```
   All 88 tests pass.
