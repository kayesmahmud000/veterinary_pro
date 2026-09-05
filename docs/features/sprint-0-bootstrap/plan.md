# PLAN-000: Workspace Bootstrap & Monorepo Execution Plan
# Status: PROPOSED (Pending Review)
# Feature/Task: Sprint 0 — Foundation Bootstrap
# Target Completion: Sprint 0 Gate Approval

---

## 1. Prerequisites & Environment Requirements

Before executing the implementation steps below, ensure the local workstation satisfies:
- **Node.js**: v20.10.0+ LTS
- **Package Manager**: `pnpm` v9.0.0+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: Docker Desktop v4.28+ with Compose v2.24+
- **Git**: Configured with `.gitignore` for Node, Turborepo, Prisma, and Flutter
- **Ports Available**: `5432` (PostgreSQL), `6379` (Redis), `9000` (MinIO API), `9001` (MinIO Console), `3001` (NestJS API), `3000` (Next.js)

---

## 2. Granular Implementation Checklist

### Step 1: Monorepo Root & Workspace Orchestration
- [x] Initialize root `package.json` with Turborepo devDependencies and script runners.
- [x] Create `pnpm-workspace.yaml` defining workspaces:
  - `apps/*`
  - `packages/*`
- [x] Create `turbo.json` configuring task pipeline (`build`, `lint`, `test`, `dev`, `db:generate`, `db:migrate`).
- [x] Create master `.gitignore` preventing commit of `.env`, `node_modules`, `.turbo`, `dist`, and build artifacts.
- [x] Create root `.editorconfig` enforcing 2-space indentation and UTF-8 line feeds.

### Step 2: Containerized Local Infrastructure
- [x] Create `infrastructure/docker-compose.yml` with:
  - **PostgreSQL 16**: Container `vetralink-postgres`, mapped port `5432`, persistent volume, healthcheck via `pg_isready`.
  - **Redis 7 Alpine**: Container `vetralink-redis`, mapped port `6379`, persistent volume, healthcheck via `redis-cli ping`.
  - **MinIO**: Container `vetralink-minio`, ports `9000` (S3 API) and `9001` (Console), S3 bucket auto-initialization script.
- [x] Create `infrastructure/.env.docker` containing local container credentials.

### Step 3: Shared Types Package (`packages/shared-types`)
- [x] Create `packages/shared-types/package.json` named `@vetralink/shared-types`.
- [x] Create `packages/shared-types/tsconfig.json` with strict TypeScript settings.
- [x] Create TypeScript domain enums mirroring Prisma:
  - `UserRole`, `FarmType`, `AnimalSpecies`, `AnimalStatus`, `MilkSession`, `ProductType`, `SubscriptionTier`, `OrderStatus`, `ConsultationStatus`.
- [x] Create standardized API envelope contracts (`ApiResponse<T>`, `PaginationMetaDto`).
- [x] Create domain DTO contracts for auth, animal, and order payloads.
- [x] Build and verify package exports (CJS, ESM, DTS verified via `tsup`).

### Step 4: NestJS Backend Scaffolding (`apps/api`)
- [x] Scaffold `apps/api/package.json` with NestJS 10, Prisma Client, Zod, class-validator, Helmet, Pino logger.
- [x] Configure `apps/api/tsconfig.json` extending root strict config with decorator metadata enabled.
- [x] Move and mount `prisma/schema.prisma` inside `apps/api/prisma/schema.prisma`.
- [x] Create `apps/api/src/config/env.schema.ts` with strict Zod parsing for all environment keys.
- [x] Implement `apps/api/src/common/filters/global-exception.filter.ts` (RFC-7807 compliant).
- [x] Implement `apps/api/src/common/interceptors/response.interceptor.ts` (Unified `ApiResponse<T>` wrapping).
- [x] Create `apps/api/src/modules/prisma/prisma.service.ts` with connection pooling and graceful teardown.
- [x] Configure `apps/api/src/main.ts` with Helmet, CORS, GlobalPipes (`whitelist: true`, `forbidNonWhitelisted: true`), and Swagger OpenAPI document builder.
- [x] Generate Prisma client artifacts (`prisma generate` v5.22.0 verified).

### Step 5: Database Migration & Seeding Engine
- [x] Validate Prisma schema syntax and relations.
- [x] Generate Prisma client artifacts (`@prisma/client`).
- [ ] Run baseline migration against live database instance (`prisma migrate dev`).
- [ ] Create `apps/api/prisma/seed.ts` seeding default roles, subscription tiers, and demo tenant.

### Step 6: Frontend & Mobile Scaffolding Stubs
- [x] Scaffold `apps/web` (Next.js 14 App Router, TypeScript, verified static production build).
- [x] Scaffold `apps/mobile` directory layout (Flutter pubspec setup and BLoC folder structure).
- [x] Link `@vetralink/shared-types` dependency in `apps/web` and `apps/api`.

---

## 3. Verification & Acceptance Criteria

### 3.1 Infrastructure Verification
Run the containers and verify health:
```bash
docker compose -f infrastructure/docker-compose.yml up -d
docker compose -f infrastructure/docker-compose.yml ps
```
*Acceptance Criteria*:
- `vetralink-postgres` status reports `(healthy)`.
- `vetralink-redis` status reports `(healthy)`.
- `vetralink-minio` web console accessible at `http://localhost:9001`.

### 3.2 Database Schema & Prisma Verification
Run migration and validate tables in PostgreSQL:
```bash
pnpm --filter @vetralink/api exec prisma migrate dev --name init
pnpm --filter @vetralink/api exec prisma db seed
```
*Acceptance Criteria*:
- 14 tables created with all foreign keys, check constraints, and composite unique indexes.
- Seed data populates default subscription tiers and system roles.

### 3.3 Turborepo Build & Typecheck Verification
Execute the monorepo compile and lint pipeline:
```bash
pnpm run build
pnpm run lint
```
*Acceptance Criteria*:
- `@vetralink/shared-types` builds cleanly.
- `@vetralink/api` compiles with 0 TypeScript errors under strict mode (`noImplicitAny`, `strictNullChecks`).
- Zero circular dependency warnings.

### 3.4 API Health Endpoint Verification
Start the backend API and probe health:
```bash
curl -i http://localhost:3001/api/v1/health
```
*Acceptance Response Contract*:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {
    "status": "healthy",
    "timestamp": "2026-09-05T12:00:00.000Z",
    "database": "connected",
    "redis": "connected"
  },
  "traceId": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "timestamp": "2026-09-05T12:00:00.000Z"
}
```
