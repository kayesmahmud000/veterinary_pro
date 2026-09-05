# PLAN-105: Step-by-Step Execution Plan for Task 1.5
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.5: Centralized AuditLogRepository and atomic database transaction wrapper
# Status: ✅ COMPLETED & VERIFIED (2026-09-05)

---

## 1. Prerequisites

- [x] Node.js 20+ and pnpm installed.
- [x] Prisma Client generated with `AuditLog` model in PostgreSQL schema.
- [x] Task 1.2 (`PrismaService`) and Task 1.4 (`ApiResponse` / Exception Filter) completed and verified.

---

## 2. Implementation Checklist (Atomic Micro-Tasks)

### Step 1: Transaction Manager Engine
- [x] Define `ITransactionManager` interface in `apps/api/src/modules/prisma/interfaces/transaction.interface.ts`.
- [x] Implement `TransactionManager` in `apps/api/src/modules/prisma/transaction/transaction.manager.ts`:
  - Wrap `prisma.$transaction(async (tx) => ...)` with configurable timeout and isolation options.
- [x] Export `TransactionManager` from `PrismaModule`.

### Step 2: Audit Domain Entity & DTOs
- [x] Create `AuditLogEntity` in `apps/api/src/modules/audit/entities/audit-log.entity.ts` (pure domain class, no ORM decorators).
- [x] Create `CreateAuditLogDto` in `apps/api/src/modules/audit/dto/create-audit-log.dto.ts` with class-validator decorators.
- [x] Create `AuditQueryDto` in `apps/api/src/modules/audit/dto/audit-query.dto.ts`.

### Step 3: AuditLogRepository Contract & Implementation
- [x] Define `IAuditLogRepository` interface in `apps/api/src/modules/audit/repositories/audit-log.repository.interface.ts`.
- [x] Implement `AuditLogRepository` in `apps/api/src/modules/audit/repositories/audit-log.repository.ts`:
  - Method `record(params, tx?)`: Supports executing on either the injected `PrismaService` or an active `tx` client.
  - Redaction: Sanitizes sensitive credentials (`password_hash`, `token`, `secret`, `key`) from audit diffs.
  - Method `findByEntity(entityType, entityId, page, pageSize)`.
  - Method `findByTraceId(traceId)`.
  - Ensure zero mutation methods exist (Strict append-only compliance).

### Step 4: AuditModule Wiring & AppModule Export
- [x] Create `AuditModule` in `apps/api/src/modules/audit/audit.module.ts` exporting `AuditLogRepository` and `AUDIT_LOG_REPOSITORY` injection token.
- [x] Register `AuditModule` in `apps/api/src/app.module.ts`.

### Step 5: Unit Test Suite
- [x] Author `apps/api/src/modules/prisma/transaction/transaction.manager.spec.ts`:
  - Test successful execution and return value inside transaction.
  - Test error propagation and rollback when transaction callback rejects.
  - Test passing custom timeout options.
- [x] Author `apps/api/src/modules/audit/repositories/audit-log.repository.spec.ts`:
  - Test `record()` creates and maps entity properly using `PrismaService`.
  - Test `record()` delegates to `tx` client when provided.
  - Test sensitive keys sanitization from `newValues` / `oldValues`.
  - Test `findByEntity()` pagination and mapping.
  - Test `findByTraceId()`.

---

## 3. Verification & Acceptance Criteria

### Verification Commands:
```bash
# 1. Run transaction & audit unit tests
pnpm --filter @vetralink/api test

# 2. Run TypeScript strict type-check & build
pnpm --filter @vetralink/api build
```

### Acceptance Criteria:
1. All unit tests pass with 100% green status (44/44 tests passed across 7 test suites).
2. TypeScript compilation passes with zero errors (`nest build`).
3. Strict micro-task execution protocol observed.
