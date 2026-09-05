# PLAN-102: Step-by-Step Execution Plan for Task 1.2
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.2: NestJS PrismaService with connection pooling, health checks, and graceful shutdown hooks
# Status: ✅ COMPLETED & VERIFIED (2026-09-05)

---

## 1. Prerequisites

- [x] Node.js 20+ and pnpm installed.
- [x] PostgreSQL 16 schema generated via `prisma generate`.
- [x] Task 1.1 baseline migration (`0_init/migration.sql`) in place.
- [x] `@nestjs/config` and `@nestjs/terminus` available in `apps/api/package.json`.

---

## 2. Implementation Checklist (Atomic Micro-Tasks)

### Step 1: Types & Interface Contracts
- [x] Define `DatabaseHealthResult` and `IPrismaService` contract interfaces in `apps/api/src/modules/prisma/interfaces/prisma.interface.ts`.
- [x] Export these contracts from `apps/api/src/modules/prisma/index.ts`.

### Step 2: Resilient PrismaService Implementation
- [x] Implement configurable client logging (`query`, `info`, `warn`, `error`) inside `apps/api/src/modules/prisma/prisma.service.ts`.
- [x] Implement slow-query detection threshold listener via `this.$on('query', ...)` emitting warnings for queries exceeding 200ms (or environment-configured threshold).
- [x] Implement connection retry mechanism with exponential backoff on `onModuleInit()` (3 attempts, configurable `DB_CONNECT_RETRY_DELAY_MS`).
- [x] Implement graceful disconnect on `onModuleDestroy()`.
- [x] Implement `ping(): Promise<DatabaseHealthResult>` executing `SELECT 1` with execution latency timing and timeout safety.
- [x] Implement `isHealthy(): Promise<boolean>` convenience method.

### Step 3: Application Graceful Shutdown Hook Wiring
- [x] Update `apps/api/src/main.ts` to call `app.enableShutdownHooks()` to allow NestJS and Prisma to catch termination signals (SIGINT, SIGTERM, SIGHUP) cleanly.

### Step 4: Unit Test Suite
- [x] Create `apps/api/src/modules/prisma/prisma.service.spec.ts`.
- [x] Test successful connection on `onModuleInit`.
- [x] Test connection failure and retry logic on `onModuleInit`.
- [x] Test graceful disconnection on `onModuleDestroy`.
- [x] Test `ping()` returning `status: 'up'` and measured `latencyMs` on successful query.
- [x] Test `ping()` returning `status: 'down'` and error details on query rejection.
- [x] Test slow-query logger behavior when query event duration exceeds threshold.

---

## 3. Verification & Acceptance Criteria

### Verification Commands:
```bash
# 1. Run PrismaService unit tests
pnpm --filter @vetralink/api test

# 2. Run TypeScript strict type-check & build
pnpm --filter @vetralink/api build
```

### Acceptance Criteria:
1. All unit tests for `PrismaService` pass (9/9 tests passed, 100% green).
2. TypeScript compilation completes with zero errors (`nest build`).
3. Shutdown hooks are verified in `apps/api/src/main.ts`.
4. Strict micro-task execution protocol observed.
