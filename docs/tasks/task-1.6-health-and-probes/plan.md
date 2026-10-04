# PLAN-106: Step-by-Step Execution Plan for Task 1.6
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.6: Jest test runner and basic /api/v1/health endpoint with DB/Redis probes
# Status: ✅ COMPLETED & VERIFIED (2026-09-05)

---

## 1. Prerequisites

- [x] Node.js 20+ and pnpm installed.
- [x] `@nestjs/terminus` installed in `apps/api/package.json`.
- [x] Tasks 1.1–1.5 completed and verified.

---

## 2. Implementation Checklist (Atomic Micro-Tasks)

### Step 1: Redis Dependency Installation
- [x] Add `ioredis` and `@types/ioredis` to `apps/api/package.json` (`pnpm --filter @vetralink/api add ioredis @types/ioredis -E`).

### Step 2: Prisma Health Indicator
- [x] Create `apps/api/src/modules/health/indicators/prisma.health.ts`:
  - Extend `HealthIndicator` from `@nestjs/terminus`.
  - Call `PrismaService.ping()`.
  - If status is 'up', return `getStatus('database', true, { latencyMs })`.
  - If status is 'down', throw `HealthCheckError('Database health check failed', getStatus('database', false, { error }))`.

### Step 3: Redis Health Indicator
- [x] Create `apps/api/src/modules/health/indicators/redis.health.ts`:
  - Extend `HealthIndicator` from `@nestjs/terminus`.
  - Create/inject Redis connection using `EnvService.redisUrl`.
  - Execute Redis `PING` with latency timing.
  - If pong received, return `getStatus('redis', true, { latencyMs })`.
  - If error, throw `HealthCheckError('Redis health check failed', getStatus('redis', false, { error }))`.

### Step 4: HealthController Implementation
- [x] Update `apps/api/src/modules/health/health.controller.ts`:
  - Endpoint `GET /api/v1/health`: Runs database and redis probes + reports memory and uptime.
  - Endpoint `GET /api/v1/health/liveness`: Fast 200 process vitality check.
  - Endpoint `GET /api/v1/health/readiness`: Verifies database and redis readiness.
  - Add Swagger documentation decorators.

### Step 5: HealthModule Wiring
- [x] Update `apps/api/src/modules/health/health.module.ts`:
  - Import `TerminusModule` from `@nestjs/terminus`.
  - Register `PrismaHealthIndicator` and `RedisHealthIndicator`.

### Step 6: Comprehensive Unit Test Suite
- [x] Author `apps/api/src/modules/health/indicators/prisma.health.spec.ts`.
- [x] Author `apps/api/src/modules/health/indicators/redis.health.spec.ts`.
- [x] Author `apps/api/src/modules/health/health.controller.spec.ts`.

---

## 3. Verification & Acceptance Criteria

### Verification Commands:
```bash
# 1. Run all unit tests across the entire test runner
pnpm --filter @vetralink/api test

# 2. Run TypeScript strict type-check & build
pnpm --filter @vetralink/api build
```

### Acceptance Criteria:
1. All unit tests across all 10 test suites pass with 100% green status (55/55 tests passed).
2. TypeScript compilation passes with zero errors (`nest build`).
3. Sprint 1 completed and verified.
4. Strict micro-task execution protocol observed.
