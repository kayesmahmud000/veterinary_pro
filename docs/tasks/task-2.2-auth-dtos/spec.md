# SPEC-202: Authentication DTOs & Contracts in `@vetralink/shared-types`
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.2: Auth DTOs (Register, Login, Refresh, OTP) in `@vetralink/shared-types`
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Design and implement the unified, type-safe Data Transfer Object (DTO) contracts for authentication and user sessions across the entire VETRALINK PRO monorepo. These contracts serve as the canonical contract between:
- The **NestJS API Gateway** (`apps/api`)
- The **Next.js 14 Web Portal** (`apps/web`)
- The **Flutter Mobile App** (`apps/mobile`)

### 1.2 Target Deliverables for Task 2.2
1. **Canonical Auth Contracts** in `packages/shared-types/src/dto/auth/`:
   - `register.dto.ts`: `RegisterRequestDto`, `RegisterResponseDto`
   - `login.dto.ts`: `LoginRequestDto`, `LoginResponseDto`
   - `refresh-token.dto.ts`: `RefreshTokenRequestDto`, `RefreshTokenResponseDto`
   - `otp.dto.ts`: `SendOtpRequestDto`, `VerifyOtpRequestDto`, `VerifyOtpResponseDto`, `OtpPurpose`, `OtpChannel`
   - `password-reset.dto.ts`: `ForgotPasswordRequestDto`, `ResetPasswordRequestDto`, `ChangePasswordRequestDto`
   - `auth-tokens.dto.ts`: `AuthTokensDto`, `JwtPayload`, `AuthUserSummary`
2. **Barrel Exports**: Exposing all DTOs cleanly through `packages/shared-types/src/index.ts`.
3. **Build & Typecheck**: Building `packages/shared-types` to CJS, ESM, and `.d.ts` definitions using `tsup`.
4. **Unit / Verification Tests**: Type assertion test suite verifying serialization, field constraints, and compatibility.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.2) |
| :--- | :--- | :--- |
| **Auth Contracts** | None. `packages/shared-types/src/dto/` is empty. | Complete set of strongly-typed DTOs covering Registration, Login, Token Refresh, OTP verification, and Password resets. |
| **Token Payload Standards** | Undefined format for JWT access tokens. | Explicit `JwtPayload` contract defining `sub`, `email`, `role`, `status`, and `activeFarmId`. |
| **Client-Server Contract** | Frontend and backend would have to duplicate type definitions. | Single Source of Truth: Web and mobile consume `@vetralink/shared-types` directly. |
| **Package Compilation** | Shared types bundle only exports enums and response contracts. | Dual ESM/CJS build with generated `.d.ts` declaration maps. |

---

## 3. Architectural & Design Trade-offs

### 3.1 DTO Definitions: Class-Validator in Shared Package vs. Pure TypeScript Interfaces
- **Option A: Define `class-validator` / `@nestjs/swagger` decorated classes inside `shared-types`**
  - *Cons*: Forces frontend clients (Next.js web, browser bundles, potential Flutter JSON bridges) to bundle heavy Node-specific decorators (`reflect-metadata`, `class-validator`, `class-transformer`), bloating bundle size and causing bundler runtime errors.
- **Option B: Pure TypeScript Interfaces & Types in `@vetralink/shared-types` + Concrete NestJS DTOs in `apps/api` (CHOSEN)**
  - *Pros*:
    1. Zero runtime overhead for web and mobile clients.
    2. Framework-agnostic: Can be shared across any JavaScript/TypeScript runtime.
    3. NestJS API DTOs in `apps/api/src/modules/auth/dto/` implement these shared interfaces while decorating with `@ApiProperty()` for Swagger and `@IsEmail()`, `@MinLength()` for HTTP validation.
  - *Justification*: Upholds Clean Architecture dependency rule. Presentation layer details (`@ApiProperty`) never pollute core domain contracts.

### 3.2 Login Identifier Strategy: Single Field `email` vs. Flexible `emailOrPhone`
- **Option A: Strict Email Only**
  - *Cons*: Rural dairy farmers in developing markets frequently lack active email accounts and identify primarily via mobile phone.
- **Option B: Dual-Mode Identifier (`email` OR `phone`) (CHOSEN)**
  - *Contract*: `LoginRequestDto` accepts `email` as primary, but also supports optional `phone` or normalized `identifier` with `password`.
  - *Justification*: Accommodates both corporate enterprise users/vets (email-based) and rural farm workers (phone-based).

### 3.3 Refresh Token Rotation (RTR) Support
- The refresh contract produces both a renewed `accessToken` and a renewed `refreshToken` (`AuthTokensDto`).
- Enforces single-use refresh tokens: whenever a token is refreshed, the old refresh token is invalidated in the database and a new one is issued, preventing token theft and replay attacks.

---

## 4. Data Models & Interface Contracts

```typescript
// Token Lifecycle Contract
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number; // in seconds (e.g. 900 for 15m)
}

// User Summary for Session / Context
export interface AuthUserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  maskedPhone: string | null;
  avatarUrl: string | null;
  createdAt: string; // ISO 8601
}

// Register Request & Response
export interface RegisterRequestDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole; // Defaults to FARMER, SUPER_ADMIN/ADMIN disallowed via public registration
  phone?: string;
}

export interface RegisterResponseDto {
  user: AuthUserSummary;
  tokens: AuthTokensDto;
}

// Login Request & Response
export interface LoginRequestDto {
  email: string;
  password: string;
  phone?: string;
  rememberMe?: boolean;
}

export interface LoginResponseDto {
  user: AuthUserSummary;
  tokens: AuthTokensDto;
}

// Refresh Request & Response
export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  tokens: AuthTokensDto;
}

// OTP Contracts
export enum OtpPurpose {
  REGISTRATION_VERIFICATION = "REGISTRATION_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
  PHONE_VERIFICATION = "PHONE_VERIFICATION",
  LOGIN_2FA = "LOGIN_2FA",
}

export enum OtpChannel {
  SMS = "SMS",
  EMAIL = "EMAIL",
}

export interface SendOtpRequestDto {
  identifier: string; // email or phone
  channel: OtpChannel;
  purpose: OtpPurpose;
}

export interface VerifyOtpRequestDto {
  identifier: string;
  code: string; // 6-digit OTP
  purpose: OtpPurpose;
}

export interface VerifyOtpResponseDto {
  verified: boolean;
  verificationToken?: string; // One-time scoped token for reset or phone link
}

// Password Reset Contracts
export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

// JWT Access Token Payload
export interface JwtPayload {
  sub: string;         // User UUID
  email: string;
  role: UserRole;
  status: UserStatus;
  activeFarmId?: string; // Contextual farm if tenant session is active
  jti?: string;        // JWT Unique Identifier for revocation tracking
  iat?: number;
  exp?: number;
}
```

---

## 5. Security & Edge Cases

1. **Password Invariants**: Passwords must be at least 8 characters long, containing uppercase, lowercase, and numeric characters.
2. **Public Role Escalation Prevention**: Registration DTO disallows `SUPER_ADMIN` and `ADMIN` roles. The domain service will reject attempts to register elevated roles.
3. **Data Masking in Responses**: Passwords and raw encryption keys are strictly omitted from `AuthUserSummary` and `RegisterResponseDto`. Phone numbers are returned only in masked format (`maskedPhone`).
4. **OTP Brute-Force Safety**: The OTP contracts enforce a 6-digit format and purpose scoping, preventing OTPs for phone verification from being reused for password resets.
