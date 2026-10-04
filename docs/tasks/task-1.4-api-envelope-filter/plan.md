# PLAN-104: Step-by-Step Execution Plan for Task 1.4
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.4: Universal ApiResponse<T> interceptor and RFC-7807 GlobalExceptionFilter
# Status: ✅ COMPLETED & VERIFIED (2026-09-05)

---

## 1. Prerequisites

- [x] Node.js 20+ and pnpm installed.
- [x] `@vetralink/shared-types` linked workspace package.
- [x] Task 1.2 (`PrismaService`) and Task 1.3 (`EnvService`) completed and verified.

---

## 2. Implementation Checklist (Atomic Micro-Tasks)

### Step 1: Shared Types & Problem Details Contract
- [x] Add `ProblemDetails` interface to `packages/shared-types/src/contracts/api-response.contract.ts`.
- [x] Update `ApiResponse<T>` to optionally include `errorDetails?: ProblemDetails`.
- [x] Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Domain Exception Hierarchy
- [x] Create `apps/api/src/common/exceptions/domain.exception.ts` with:
  - `DomainException` (abstract base)
  - `EntityNotFoundException` (404)
  - `EntityConflictException` (409)
  - `ValidationDomainException` (422)
  - `ForbiddenOperationException` (403)
  - `UnauthorizedDomainException` (401)
- [x] Export exceptions from `apps/api/src/common/exceptions/index.ts`.

### Step 3: Semantic Response Message Decorator
- [x] Create `apps/api/src/common/decorators/response-message.decorator.ts` (`@ResponseMessage(message: string)`).
- [x] Export decorator from `apps/api/src/common/decorators/index.ts`.

### Step 4: Enhanced Response Interceptor
- [x] Update `apps/api/src/common/interceptors/response.interceptor.ts`:
  - Read `@ResponseMessage` metadata from execution handler or fallback to `"OK"`.
  - Set `X-Trace-Id` header on outgoing HTTP response.
  - Correctly extract paginated payloads (`{ items, meta }` -> `{ data: items, meta }`).

### Step 5: Resilient RFC-7807 Global Exception Filter
- [x] Update `apps/api/src/common/filters/global-exception.filter.ts`:
  - Set `X-Trace-Id` header on outgoing HTTP response.
  - Map `Prisma.PrismaClientKnownRequestError`:
    - `P2002` (Unique constraint violation) -> 409 Conflict with target field error.
    - `P2025` (Record not found) -> 404 Not Found.
    - `P2003` (Foreign key constraint violation) -> 422 Unprocessable Entity.
  - Map `DomainException` to its defined `statusCode` and `errorCode`.
  - Map `HttpException` (including class-validator 400/422 errors) into clean field arrays.
  - Map unhandled exceptions to 500 without leaking stack traces or raw database messages to clients.
  - Attach RFC-7807 compliant `errorDetails` object (`type`, `title`, `status`, `detail`, `instance`).

### Step 6: Unit Test Suite
- [x] Author `apps/api/src/common/interceptors/response.interceptor.spec.ts`:
  - Test standard response envelope wrapping.
  - Test custom message decorator propagation.
  - Test pagination metadata formatting.
  - Test `X-Trace-Id` header population.
- [x] Author `apps/api/src/common/filters/global-exception.filter.spec.ts`:
  - Test `HttpException` handling (404, 400 validation).
  - Test `DomainException` handling.
  - Test Prisma error translations (`P2002`, `P2025`, `P2003`).
  - Test unhandled 500 error sanitization and traceId propagation.

---

## 3. Verification & Acceptance Criteria

### Verification Commands:
```bash
# 1. Run common module unit tests
pnpm --filter @vetralink/api test

# 2. Run TypeScript strict type-check & build
pnpm --filter @vetralink/api build
```

### Acceptance Criteria:
1. All unit tests pass with 100% green status (33/33 tests passed across 5 test suites).
2. TypeScript compilation passes with zero errors (`nest build`).
3. Strict micro-task execution protocol observed.
