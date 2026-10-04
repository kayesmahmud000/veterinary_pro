# SPEC-105: Centralized AuditLogRepository & Atomic Database Transaction Engine
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.5: Centralized AuditLogRepository and atomic database transaction wrapper
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish the foundational data-integrity and compliance infrastructure for VETRALINK PRO:
1. **Centralized `AuditLogRepository`**: An append-only repository managing immutable audit trails across all sensitive mutations (PII identity, animal medical events, subscriptions, and financial ledger entries) matching `.antigravityrules` Guardrail-07.
2. **Atomic Transaction Manager (`TransactionManager`)**: A clean architectural abstraction allowing domain services to orchestrate multi-entity mutations and audit log insertions inside an atomic ACID database transaction (`prisma.$transaction`) without importing `PrismaClient` directly into services (Guardrail-02 & Guardrail-03).

### 1.2 Target Deliverables for Task 1.5
1. **Audit Domain Entity & DTOs (`apps/api/src/modules/audit/`)**:
   - `AuditLogEntity`: Pure domain model class without ORM decorators.
   - `CreateAuditLogDto`: Strongly validated DTO for audit log insertion.
   - `AuditQueryDto`: Filter and pagination query parameters for audit retrieval.
2. **Audit Repository Contract & Implementation (`apps/api/src/modules/audit/repositories/`)**:
   - `IAuditLogRepository`: Interface defining narrow read and write operations.
   - `AuditLogRepository`: Prisma-backed repository supporting transactional client delegation (`tx`).
   - Append-Only Rule: Explicitly no `update()` or `delete()` methods in the repository interface.
3. **Atomic Transaction Manager (`apps/api/src/modules/prisma/transaction/`)**:
   - `ITransactionManager` interface and `TransactionManager` service.
   - Enables domain services to execute callbacks within an ACID transaction boundary, passing `Prisma.TransactionClient` to participating repositories.
4. **Audit Module Composition (`apps/api/src/modules/audit/audit.module.ts`)**:
   - Global or exportable NestJS module wiring.
5. **Comprehensive Unit Test Suite**:
   - Tests for `AuditLogRepository` (creation with and without active transaction client, querying by entity, querying by user, pagination).
   - Tests for `TransactionManager` (successful commit, rollback on error, timeout handling).

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 1.5) |
| :--- | :--- | :--- |
| **Audit Schema** | `AuditLog` table exists in PostgreSQL schema (`audit_logs`). | Dedicated `AuditModule`, `AuditLogEntity`, and `AuditLogRepository` operational. |
| **Immutability** | No repository controls; raw table could theoretically be updated. | Repository layer enforces append-only semantics (only `record()` and `find*()` exposed). |
| **Transaction Execution** | Services would have to inject `PrismaService` directly and call `$transaction`, violating Guardrail-03. | `TransactionManager` provides clean orchestration, allowing repositories to participate seamlessly in the same active transaction (`tx`). |
| **Audit Compliance** | CUD mutations cannot easily write audit records in the same transaction. | Guardrail-07 enforced: Any mutation can pass `tx` to `auditLogRepository.record(data, tx)` within the same unit of work. |
| **Test Coverage** | Zero tests for auditing or transactions. | 100% unit tests covering transaction commits, rollbacks, and audit logging. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Audit Logging Mechanism: Asynchronous Event Bus vs. In-Transaction Sync Logging
- **Option A: Asynchronous BullMQ / Event Emitter Audit Logging**
  - *Pros*: Zero latency impact on main request thread.
  - *Cons*: Severe compliance risk. If the server crashes or worker fails after the transaction commits, the mutation has no corresponding audit log; impossible to guarantee atomic consistency; violates strict AgTech/FinTech compliance requirements (Guardrail-07).
- **Option B: Synchronous In-Transaction Audit Logging (CHOSEN)**
  - *Pros*: The audit log record is committed in the *exact same* database transaction (`tx`) as the state mutation. If the audit log fails, the entire mutation rolls back. If the mutation rolls back, no phantom audit log is created.
  - *Justification*: Mandated by Guardrail-07: "All CUD operations on financial, medical, and user-identity data MUST emit an AuditLog record in the SAME transaction."

### 3.2 Transaction Management: AsyncLocalStorage Context vs. Explicit Parameter Passing
- **Option A: ClsHooked / AsyncLocalStorage Implicit Transaction Context**
  - *Pros*: Repositories do not need `tx` passed in method arguments.
  - *Cons*: Hidden magic; dangerous in Node.js when asynchronous micro-tasks or event loops escape context; difficult to test and reason about; complex debugging when concurrent requests overlap.
- **Option B: Explicit Transaction Parameter (`tx?: Prisma.TransactionClient`) (CHOSEN)**
  - *Pros*: Transparent, 100% type-safe, completely testable with mocked dependencies; clear visibility into which operations participate in the transaction boundary.
  - *Justification*: Standard Clean Architecture / Hexagonal pattern in TypeScript enterprise systems.

---

## 4. Data Models, Contracts & Interfaces

### 4.1 `AuditLogEntity` Domain Model
```typescript
export class AuditLogEntity {
  id: string;
  userId: string | null;
  action: string; // CREATE, UPDATE, DELETE, AUTH_LOGIN, FINANCIAL_MUTATION
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  traceId: string;
  ipAddress: string | null;
  createdAt: Date;
}
```

### 4.2 `IAuditLogRepository` Contract
```typescript
import { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  traceId: string;
  ipAddress?: string | null;
}

export interface AuditLogQueryParams {
  entityType?: string;
  entityId?: string;
  userId?: string;
  traceId?: string;
  page?: number;
  pageSize?: number;
}

export interface IAuditLogRepository {
  record(params: CreateAuditLogParams, tx?: Prisma.TransactionClient): Promise<AuditLogEntity>;
  findByEntity(entityType: string, entityId: string, page?: number, pageSize?: number): Promise<{ items: AuditLogEntity[]; total: number }>;
  findByTraceId(traceId: string): Promise<AuditLogEntity[]>;
}
```

### 4.3 `ITransactionManager` Contract
```typescript
import { Prisma } from "@prisma/client";

export interface ITransactionManager {
  run<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T>;
}
```

---

## 5. Security & Edge Cases

1. **Append-Only Immutability**:
   - `IAuditLogRepository` contains zero mutation methods (`update`, `delete`). Database user permissions can further enforce `REVOKE UPDATE, DELETE ON audit_logs FROM app_user` in production.
2. **Sensitive PII Scrubbing in Audit Diffs**:
   - Passwords, cryptographic keys, and raw authentication tokens must never be written into `oldValues` or `newValues`. The repository sanitizes common sensitive keys (`password_hash`, `token`, `secret`, `key`) before persistence.
3. **Transaction Timeout & Deadlocks**:
   - `TransactionManager.run()` accepts configurable timeout parameters (default: 5000ms max execution) to prevent runaway transactions from holding database locks indefinitely.
4. **TraceId Integrity**:
   - Every audit log entry requires a non-empty `traceId` (UUID) ensuring traceability from incoming HTTP requests directly to database audit records.

---

## 6. Verification Criteria

1. **Unit Test Pass**: 100% of unit tests pass for `AuditLogRepository` and `TransactionManager`.
2. **Transactional Rollback Verification**: Unit tests verify that when a callback inside `TransactionManager.run` throws, the transaction is rejected and nothing commits.
3. **Sanitization Check**: Tests verify that sensitive fields (`password_hash`, `secret`) are stripped from `newValues` before saving.
4. **Clean TypeScript Build**: `nest build` compiles cleanly with zero errors.
