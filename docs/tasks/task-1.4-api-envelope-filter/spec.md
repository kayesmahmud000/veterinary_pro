# SPEC-104: Universal ApiResponse<T> Envelope, Custom Message Decorator & RFC-7807 Global Exception Filter
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.4: Universal ApiResponse<T> interceptor and RFC-7807 GlobalExceptionFilter
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish the standardized, consistent HTTP response and error handling contract across the entire VETRALINK PRO platform. 

Every client consuming the API (Web Next.js portal, Mobile Flutter app, external webhook consumers, and third-party integrations) must receive an identical, deterministic envelope for all outcomes:
1. **Success Envelope (`ResponseInterceptor`)**: Wraps successful responses in `ApiResponse<T>`, formats pagination metadata (`meta`), populates correlation IDs (`traceId`), propagates `X-Trace-Id` headers, and honors custom controller messages via a `@ResponseMessage(...)` decorator.
2. **Standardized Error Envelope (`GlobalExceptionFilter`)**: Adheres to RFC-7807 ("Problem Details for HTTP APIs"), translating all HTTP exceptions, domain exceptions, validation failures, Prisma ORM runtime errors, and uncaught 500 errors into a consistent structure with field-level validation breakdowns, while strictly preventing stack trace leakage in production.

### 1.2 Target Deliverables for Task 1.4
1. **Domain Exception Hierarchy (`apps/api/src/common/exceptions/`)**:
   - `DomainException` (base)
   - `EntityNotFoundException` (404)
   - `ConflictException` (409)
   - `ValidationException` (422)
   - `ForbiddenOperationException` (403)
2. **Response Message Decorator (`@ResponseMessage`)**:
   - Allows controllers to declare semantic messages (e.g. `@ResponseMessage('Animal registered successfully')`) instead of a generic "OK".
3. **Enhanced `ResponseInterceptor<T>`**:
   - Sets HTTP response header `X-Trace-Id`.
   - Formats paginated payloads (`items` + `meta`) into `{ data: items, meta }`.
   - Refined timestamping and status synchronization.
4. **Resilient RFC-7807 `GlobalExceptionFilter`**:
   - RFC-7807 compliant problem details (`type`, `title`, `status`, `detail`, `instance`).
   - Intelligent Prisma error translation:
     - `P2002` (Unique constraint violation) -> 409 Conflict with affected target field.
     - `P2025` (Record not found) -> 404 Not Found.
     - `P2003` (Foreign key constraint failed) -> 422 Unprocessable Entity.
   - Deep nested class-validator array formatting.
   - Propagation of `X-Trace-Id` on error responses.
5. **Comprehensive Unit Test Suite**:
   - Complete Jest tests for `ResponseInterceptor` and `GlobalExceptionFilter`.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 1.4) |
| :--- | :--- | :--- |
| **Success Messages** | Hardcoded to `"OK"`. | Configurable per endpoint via `@ResponseMessage('...')` metadata decorator. |
| **Response Headers** | `X-Trace-Id` is parsed from request or generated, but not returned in response headers. | `X-Trace-Id` is explicitly set on all HTTP response headers for bidirectional tracing. |
| **Prisma Error Handling** | Unhandled Prisma exceptions fall through to raw 500 Internal Server Error. | Native translation of Prisma errors (`P2002`, `P2025`, `P2003`) into semantic 409, 404, 422 envelopes. |
| **RFC-7807 Semantics** | Basic status and message without standardized problem type URI or instance path. | Structured RFC-7807 problem details with `instance` (request path) and machine-readable error codes. |
| **Domain Exceptions** | Controllers/services rely on framework HTTP exceptions directly. | Clean Architecture domain exceptions (`DomainException`, `EntityNotFoundException`, etc.) isolated from HTTP transport. |
| **Unit Test Coverage** | Zero tests for filters or interceptors. | Comprehensive Jest unit tests covering success, validation, domain exceptions, Prisma errors, and fatal crashes. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Error Representation: Pure RFC-7807 JSON vs. Unified `ApiResponse<T>` Envelope
- **Option A: Pure RFC-7807 format (`application/problem+json`)**
  - *Schema*: `{ type, title, status, detail, instance, invalid_params }`
  - *Cons*: Different top-level shape from successful API responses (`{ success: true, data: ... }`), requiring client frontend SDKs and mobile apps to maintain two completely separate deserialization models.
- **Option B: Unified `ApiResponse<T>` with Embedded RFC-7807 Problem Details (CHOSEN)**
  - *Schema*:
    ```json
    {
      "success": false,
      "statusCode": 409,
      "message": "Unique constraint violation",
      "data": null,
      "errors": [{ "field": "tagNumber", "message": "Tag number already exists in this farm" }],
      "errorDetails": {
        "type": "https://vetralink.pro/errors/conflict",
        "title": "Conflict",
        "status": 409,
        "detail": "Record already exists.",
        "instance": "/api/v1/animals"
      },
      "traceId": "c4b8e219-5757-41ab-8e04-370138d9f1a2",
      "timestamp": "2026-09-05T13:30:00.000Z"
    }
    ```
  - *Pros*: Completely backward-compatible with `.antigravityrules` Section 4; provides immediate `errors` for form validations; provides RFC-7807 compliant problem metadata for advanced API clients.

### 3.2 Prisma Error Translation: Service Layer `try/catch` vs. Centralized Filter Mapping
- **Option A: Catch Prisma errors in each service/repository and re-throw**
  - *Cons*: Massive code duplication across dozens of services; high risk of missing edge cases.
- **Option B: Centralized Translation in `GlobalExceptionFilter` (CHOSEN)**
  - *Pros*: Zero boilerplate in repositories/services; centralizes database error mappings (`P2002` -> Conflict, `P2025` -> NotFound); adheres to Don't Repeat Yourself (DRY) and Single Responsibility Principle.

---

## 4. Data Models, Contracts & Interfaces

### 4.1 Enhanced Shared Types Contract (`packages/shared-types`)
```typescript
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  errors?: ValidationErrorItem[];
  errorDetails?: ProblemDetails;
  traceId: string;
  timestamp: string;
}
```

### 4.2 Domain Exception Hierarchy
```typescript
export abstract class DomainException extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EntityNotFoundException extends DomainException {
  readonly statusCode = 404;
  readonly errorCode = 'ENTITY_NOT_FOUND';
}

export class EntityConflictException extends DomainException {
  readonly statusCode = 409;
  readonly errorCode = 'ENTITY_CONFLICT';
}

export class ValidationDomainException extends DomainException {
  readonly statusCode = 422;
  readonly errorCode = 'VALIDATION_FAILED';
}
```

---

## 5. Security & Edge Cases

1. **Information Leakage Prevention**:
   - Unhandled internal errors (`500`) must strictly return `"Internal server error"` to the client. Stack traces, raw SQL queries, or internal file paths are logged server-side with `traceId` and NEVER rendered in the response body.
2. **Correlation ID Consistency**:
   - If an incoming request provides `X-Trace-Id`, it is validated and adopted. If not provided, a secure cryptographically random UUID (`randomUUID()`) is generated and set on the response header `X-Trace-Id`.
3. **Class-Validator Nested Array Formatting**:
   - Validation failures from nested objects (e.g. `items[0].priceCents`) must flatten into clear dot-notated field strings (`items.0.priceCents`).

---

## 6. Verification Criteria

1. **Unit Test Pass**: 100% of unit tests pass for `ResponseInterceptor` and `GlobalExceptionFilter`.
2. **Prisma Error Mapping**: Tests verify `P2002` maps to 409 and `P2025` maps to 404.
3. **Header Verification**: Tests verify `X-Trace-Id` is appended to all HTTP response headers.
4. **Clean TypeScript Build**: `nest build` compiles cleanly with zero errors.
