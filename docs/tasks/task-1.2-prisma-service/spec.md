# SPEC-102: NestJS PrismaService Core, Connection Pooling, Health Probes & Graceful Shutdown
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.2: NestJS PrismaService with connection pooling, health checks, and graceful shutdown hooks
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Transform the placeholder `PrismaService` into an enterprise-grade, resilient database access engine for VETRALINK PRO. The enhanced `PrismaService` will manage database connection lifecycles, configure connection pooling parameters, monitor slow query performance, implement active liveness/readiness database ping probes, and ensure graceful shutdown handling under OS signals (SIGTERM/SIGINT) without dropping active transactions or connection leaks.

### 1.2 Target Deliverables for Task 1.2
1. **Configurable Connection Pooling**: Optimize database connections using PostgreSQL connection string parameters (`connection_limit`, `pool_timeout`) and Prisma client logging configuration.
2. **Query Performance & Slow Query Logging**: Dynamic query event listener (`$on('query')`) that logs slow queries surpassing a configurable threshold (e.g., >200ms) with execution duration and query parameters.
3. **Active Health Probe Contract**: Comprehensive `ping()` / `isHealthy()` methods returning connection status, round-trip latency in milliseconds, and structured error reporting compatible with NestJS Terminus.
4. **Graceful Shutdown Integration**: Lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`) with connection retry logic, alongside NestJS application-level shutdown hook enablement in `main.ts`.
5. **Unit Test Suite**: Full Jest unit test coverage for `PrismaService` lifecycle hooks, connection retry, health checks, and error boundaries.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 1.2) |
| :--- | :--- | :--- |
| **PrismaService** | Minimal class extending `PrismaClient` with basic `$connect` and `$disconnect`. | Hardened service with typed options, event listeners, latency metrics, and connection retry. |
| **Connection Pooling** | Default Prisma implicit settings; no pool timeout control or connection limit tuning. | Explicit connection pooling configuration through parsed `DATABASE_URL` / client configuration. |
| **Query Observability** | No query logging or slow query tracking. | Structured logging with differentiation between development verbose logging and production slow-query warnings. |
| **Health Checks** | No DB health probe method on `PrismaService`. `HealthController` returns static uptime. | Explicit `ping()` and `isHealthy()` methods measuring real DB latency via `SELECT 1`. |
| **Shutdown Hooks** | `app.enableShutdownHooks()` not configured in `main.ts`. Abrupt process termination can drop transactions. | Process signals (SIGINT, SIGTERM) gracefully drain connections and complete in-flight queries before teardown. |
| **Testing** | No unit tests for `PrismaService`. | Comprehensive unit tests in `prisma.service.spec.ts` testing connection, disconnection, health probes, and error handling. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Connection Management: Direct Instantiation vs. ConfigService-Driven Dynamic Configuration
- **Option A: Static instantiation inside PrismaService constructor**
  - *Pros*: Zero boilerplate.
  - *Cons*: Cannot dynamically react to `NODE_ENV` or environment-configured connection timeouts, logging levels, or replica URLs.
- **Option B: ConfigService-Injected PrismaService (CHOSEN)**
  - *Pros*: Reads validated environment configuration from `ConfigService` (`EnvConfig`); adjusts query event logging dynamically (verbose query logs in development, slow-query threshold warnings in staging/production); supports test environments seamlessly.
  - *Justification*: Follows NestJS Dependency Injection best practices, respects Twelve-Factor App principles, and adheres to Clean Architecture.

### 3.2 Health Check Implementation: Prisma `$queryRaw` vs. Terminus Custom Health Indicator
- **Option A: Pure Terminus HealthIndicator extension**
  - *Pros*: Integrates directly with Terminus module.
  - *Cons*: Tight coupling to `@nestjs/terminus` inside the core database layer; cannot be easily queried by internal background jobs or non-Terminus contexts.
- **Option B: Dual-Tier Architecture (CHOSEN)**
  - *Tier 1*: `PrismaService.ping()` / `PrismaService.isHealthy()` provides a standalone, framework-agnostic method returning typed `{ status: 'up' | 'down', latencyMs: number, error?: string }`.
  - *Tier 2*: `PrismaHealthIndicator` in common/health (or exported from PrismaModule) wraps `PrismaService.isHealthy()` for NestJS Terminus integration.
  - *Justification*: Decouples database domain logic from HTTP health check transport while maintaining full compatibility with `/api/v1/health` probes.

### 3.3 Slow Query Logging Strategy: Middleware vs. Query Events
- **Option A: Prisma `$use` Middleware**
  - *Flaw*: Deprecated in newer Prisma versions in favor of Client Extensions and event listeners; adds execution overhead to every query.
- **Option B: Event-Driven `PrismaClient` with `log: [{ emit: 'event', level: 'query' }]` (CHOSEN)**
  - *Pros*: Officially recommended by Prisma; asynchronous event dispatch; captures precise `e.duration` in milliseconds without intercepting the main execution thread.
  - *Justification*: Maximum runtime performance, future-proof, and low latency.

---

## 4. Data Models, Contracts & Interfaces

### 4.1 Health Check Response Contract
```typescript
export interface DatabaseHealthResult {
  status: 'up' | 'down';
  latencyMs: number;
  timestamp: string;
  error?: string;
}
```

### 4.2 Prisma Service Public Interface Contract
```typescript
export interface IPrismaService {
  onModuleInit(): Promise<void>;
  onModuleDestroy(): Promise<void>;
  ping(): Promise<DatabaseHealthResult>;
  isHealthy(): Promise<boolean>;
}
```

### 4.3 Configuration Contract
- `SLOW_QUERY_THRESHOLD_MS`: Defaults to 200ms. Queries executing longer than this threshold emit a `Logger.warn` with statement and duration.
- Connection parameters in `DATABASE_URL`: e.g. `?connection_limit=20&pool_timeout=10`.

---

## 5. Security & Edge Cases

1. **Connection Failure During Boot**:
   - If PostgreSQL is unreachable at boot time, `PrismaService` attempts connection retries (up to 3 attempts with exponential backoff) before failing fast.
2. **Sensitive Data Redaction in Query Logs**:
   - In production, raw query parameters might contain sensitive PII or passwords. Query event logging logs duration and query target while masking or omitting parameter values when `NODE_ENV === 'production'`.
3. **Connection Leaks on Process Signals**:
   - Explicitly registering `enableShutdownHooks(app)` in `main.ts` ensures that NestJS executes `onModuleDestroy` on SIGINT and SIGTERM, allowing Prisma to execute `this.$disconnect()` and drain connection pools cleanly.
4. **Transient Network Blips during Health Checks**:
   - `ping()` sets an internal execution timeout (e.g. 3000ms) so that a deadlocked connection does not hang the health check endpoint indefinitely.

---

## 6. Verification & Acceptance Criteria

1. **Unit Test Pass**: `apps/api` unit test suite passes with 100% of `PrismaService` tests green.
2. **Health Check Latency**: `PrismaService.ping()` returns `{ status: 'up', latencyMs: <number> }` when connected to PostgreSQL.
3. **Shutdown Hook Integration**: `app.enableShutdownHooks()` is present in `apps/api/src/main.ts`.
4. **Zero Type Errors**: `pnpm build` in `apps/api` executes cleanly under strict TypeScript compiler rules.
