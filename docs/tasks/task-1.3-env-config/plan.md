# PLAN-103: Step-by-Step Execution Plan for Task 1.3
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.3: Runtime environment configuration with strict Zod validation (env.schema.ts)
# Status: ✅ COMPLETED & VERIFIED (2026-09-05)

---

## 1. Prerequisites

- [x] Node.js 20+ and pnpm installed.
- [x] `@nestjs/config` and `zod` installed in `apps/api/package.json`.
- [x] Task 1.2 completed and verified (PrismaService and Jest config in place).

---

## 2. Implementation Checklist (Atomic Micro-Tasks)

### Step 1: Zod Schema Definition & Redaction Logic
- [x] Implement `EnvSchema` and `validateEnv` in `apps/api/src/config/env.schema.ts`:
  - Enforce full 21-variable schema from Section 8 of `ARCHITECTURE.md`.
  - Add regex validation for `AES_PII_ENCRYPTION_KEY` (`/^[0-9a-fA-F]{64}$/`).
  - Add environment-conditional validation (`superRefine`): require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` when `NODE_ENV === 'production'`.
  - Implement secure error logger redacting sensitive variable values while clearly listing failing validation paths.

### Step 2: Strongly-Typed EnvService & Module
- [x] Define `IEnvService` interface and implement `EnvService` in `apps/api/src/config/env.service.ts`:
  - Typed getters for all environment properties (`databaseUrl`, `redisUrl`, `jwtAccessSecret`, etc.).
  - Computed helper getters: `isProduction`, `isDevelopment`, `isTest`, `corsOrigins` (array format).
- [x] Create `AppConfigModule` wrapper in `apps/api/src/config/config.module.ts` declaring `EnvService` as global.

### Step 3: App Module Wiring
- [x] Update `apps/api/src/app.module.ts` to register the new typed `AppConfigModule`.

### Step 4: Environment Defaults Standardization
- [x] Update `apps/api/.env` and `apps/api/.env.example` with all architectural variable templates and comments.

### Step 5: Unit Test Suite
- [x] Author `apps/api/src/config/env.schema.spec.ts`:
  - Test valid development environment parsing.
  - Test fallback defaults for non-critical properties.
  - Test fail-fast validation when required properties (e.g. `DATABASE_URL`, `AES_PII_ENCRYPTION_KEY`) are missing or malformed.
  - Test production conditional constraints (e.g., rejecting production config if Stripe or AWS keys are missing).
- [x] Author `apps/api/src/config/env.service.spec.ts`:
  - Test type-safe getter properties and computed boolean helpers.

---

## 3. Verification & Acceptance Criteria

### Verification Commands:
```bash
# 1. Run environment schema & service unit tests
pnpm --filter @vetralink/api test

# 2. Run TypeScript strict type-check & build
pnpm --filter @vetralink/api build
```

### Acceptance Criteria:
1. All unit tests pass with 100% green status (21/21 tests passed across 3 test suites).
2. TypeScript compilation passes with zero errors (`nest build`).
3. Strict micro-task execution protocol observed.
