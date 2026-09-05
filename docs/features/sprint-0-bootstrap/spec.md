# SPEC-000: Workspace Bootstrap, Monorepo Architecture & Database Foundation
# Status: APPROVED
# Feature/Task: Sprint 0 — Foundation Bootstrap
# Author: Elite Software Architect & Tech Lead
# Last Updated: 2026-09-05 (Architectural Review Corrections Applied)

---

## 1. Feature Overview & Objective

### 1.1 Problem Statement
VETRALINK PRO is an enterprise-grade, multi-tenant AgTech platform spanning three high-complexity verticals:
1. **Multi-Species Farm SaaS ERP**: Real-time livestock registry, lactation tracking, health alerts, and P&L accounting.
2. **Digital Products Store & LMS**: HLS/DRM video streaming courses, encrypted eBooks, and agricultural calculation spreadsheets.
3. **Tele-Veterinary Telehealth & EHR**: Farmer triage, WebRTC video consultation, and digitally signed PKI prescriptions.

Without an industrialized foundation, polyrepo fragmentation, type drift between frontend and backend, loose database constraints, and inconsistent architectural patterns will cause development friction, data corruption, and catastrophic security vulnerabilities (e.g., cross-tenant data leakage or financial double-spending).

### 1.2 Objective
Establish the foundational substrate of VETRALINK PRO through:
- An enterprise **Turborepo monorepo** managed with `pnpm` workspaces, enabling atomic changes across backend, web, mobile, and shared type definitions.
- A **Modular Monolith** backend architecture (NestJS) enforcing Clean Architecture and Domain-Driven Design (DDD).
- A normalized, resilient **3NF PostgreSQL 16 database schema** managed by Prisma ORM, engineered with row-level multi-tenancy, partial unique indexes for soft deletes, deterministic blind indexing for PII, offline sync attributes, and strict ACID transaction safety.
- Containerized local development infrastructure (PostgreSQL 16, Redis 7, MinIO S3 mock) via Docker Compose.

---

## 2. Current State vs. Proposed State

| Architectural Area | Current State | Proposed State (Sprint 0) |
| :--- | :--- | :--- |
| **Codebase Structure** | Root directory containing specification documents only (`.antigravityrules`, `ARCHITECTURE.md`, `ROADMAP.md`). | Structured Turborepo monorepo with `apps/api` (NestJS), `apps/web` (Next.js 14), `apps/mobile` (Flutter), and `packages/shared-types`. |
| **Type Integrity** | Implicit / non-existent application code. | Strict end-to-end typing across monorepo boundaries (`strict: true`, zero `any`, Zod schemas for external boundaries, `class-validator` for DTOs). |
| **Database Schema** | Conceptual schema defined in docs and Prisma definition file. | Production-grade 3NF schema with 14 normalized entities, relational foreign keys, partial unique indexes, HMAC blind indexes, and migration scripts. |
| **Local Infrastructure** | Requires manual installation of services. | Automated `docker-compose.yml` spinning up PostgreSQL 16 with healthchecks, Redis 7 Alpine, and MinIO S3 compatible storage. |
| **API Envelope & Errs** | Standard Express/NestJS defaults. | Unified `ApiResponse<T>` envelope with `traceId` correlation and centralized `GlobalExceptionFilter`. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Workspace Architecture: Turborepo Monorepo vs. Polyrepo
- **Option A: Polyrepo (Separate Git repositories for API, Web, Mobile, and Shared Types)**
  - *Pros*: Isolated CI pipelines, independent release tags.
  - *Cons*: Severe type drift between API and clients; cross-repo pull requests required for schema changes; complex version publishing for shared packages (`npm publish`); high developer overhead.
- **Option B: Turborepo Monorepo with `pnpm` Workspaces (CHOSEN)**
  - *Pros*: Atomic commits spanning API contracts and client consumers; instant type reflection via `packages/shared-types`; `pnpm` symlink hoisting with deduplicated disk space; remote computation caching for lightning-fast CI builds.
  - *Justification*: In a fast-moving SaaS with shared domain entities (e.g., livestock status, order items, prescription models), monorepo guarantees type synchronization across Web and Mobile with zero publishing lag.

### 3.2 Backend Topology: Modular Monolith vs. Microservices
- **Option A: Distributed Microservices (Auth Service, ERP Service, LMS Service, Vet Service)**
  - *Pros*: Autonomous team deployments, independent service scaling.
  - *Cons*: Distributed transactions (2PC / Saga pattern overhead), latency penalties over network hops, complex tracing, Kubernetes operational overhead premature for Sprint 0.
- **Option B: Domain-Driven Modular Monolith in NestJS (CHOSEN)**
  - *Pros*: In-process method calls with sub-millisecond execution; single database supporting atomic ACID `$transaction` blocks for financial/order processing; clear module boundaries using NestJS modules and DDD layers; trivial extraction to microservices when traffic warrants.
  - *Justification*: Multi-tenant ERP and Tele-Vet checkout workflows require strict transactional guarantees across users, orders, and veterinary records. A modular monolith provides the highest developer velocity and data integrity.

### 3.3 Multi-Tenancy Architecture: Row-Level Shared Database vs. Schema-per-Tenant vs. DB-per-Tenant
- **Option A: Database-per-tenant or Schema-per-tenant**
  - *Pros*: Absolute hardware/schema data isolation.
  - *Cons*: Heavy connection pool exhaustion (PostgreSQL cannot easily scale to thousands of separate schemas or databases on one instance); migration maintenance nightmare; high operational cost for smallholder farmers.
- **Option B: Row-Level Multi-Tenancy with Composite Keys & Partial Unique Indexes (CHOSEN)**
  - *Pros*: Extreme cost efficiency; dynamic scaling to tens of thousands of tenant farms; unified schema migrations; fast aggregate analytics across regions.
  - *Security Enforcement*: Every tenant entity (`animals`, `milk_logs`, `farm_transactions`, `health_records`) enforces a mandatory `farm_id` column. Repositories must enforce `where: { id, farmId }`.
  - *Soft-Delete Uniqueness Fix*: In PostgreSQL, `NULL != NULL`. A standard composite unique constraint `UNIQUE(farm_id, tag_number, deleted_at)` fails to prevent duplicate active tags when `deleted_at IS NULL`. We strictly use a **Partial Unique Index**:
    ```sql
    CREATE UNIQUE INDEX uq_active_farm_animal_tag ON animals(farm_id, tag_number) WHERE deleted_at IS NULL;
    ```
    This guarantees that within any farm, no two active animals can possess the same tag number, while preserved soft-deleted historical records never conflict.

### 3.4 Data Access Layer: Prisma ORM with Repository Pattern vs. Raw Query Builder (Drizzle / Kysely)
- **Option A: Raw SQL / Drizzle ORM**
  - *Pros*: High query visibility, zero ORM runtime overhead.
  - *Cons*: Manual migration writing, repetitive boilerplate for relational joins, higher cognitive load for junior developers.
- **Option B: Prisma ORM Wrapped in Domain Repositories (CHOSEN)**
  - *Pros*: Type-safe query generation, auto-generated TypeScript clients, automated migration management, and schema-as-code documentation.
  - *Guardrail Mitigation*: Prisma is strictly forbidden from leaking into Controllers or Services (GUARDRAIL-03). All operations go through `IFarmRepository`, `IAnimalRepository`, etc., ensuring clean layer separation and testability with mocks.

---

## 4. Data Models & Interface Contracts

### 4.1 Core Domain Entities (PostgreSQL 16 / Prisma)
The schema establishes 14 production entities across 6 domain boundaries:

```
[Users & Auth]          ── User, RefreshToken, AuditLog
[Farms & Multi-Tenancy] ── Farm, FarmMember
[Livestock ERP]         ── Animal, HealthRecord, VaccineRecord, MilkLog, FarmTransaction
[Digital Commerce & LMS]── Product, Order, OrderItem
[Subscriptions & Quotas]── SubscriptionPlan, Subscription
[Tele-Veterinary & EHR] ── Consultation, Prescription
```

### 4.2 Architectural Patches & Schema Enhancements

#### Patch 1: Soft-Delete Partial Unique Index
As established in Section 3.3, active animal tag uniqueness is enforced through a PostgreSQL partial unique index (`WHERE deleted_at IS NULL`).

#### Patch 2: PII Encryption & Deterministic Blind Indexing (`phone_hash`)
- Plaintext phone numbers are sensitive PII subject to GDPR/data protection regulations.
- Randomized encryption (`AES-256-GCM` with random 96-bit IV) produces non-deterministic ciphertext for identical plaintexts, making indexed B-tree exact-match searches (`WHERE phone = ?`) impossible without decrypting the entire table.
- **Solution**: The `users` table contains:
  1. `phone`: Authenticated ciphertext encrypted with `AES-256-GCM` + IV + AuthTag for secure retrieval.
  2. `phone_hash`: Deterministic blind index generated via `HMAC-SHA256(phone_e164, HASH_PEPPER)`.
- `phone_hash` is indexed with a standard unique B-Tree index, enabling instantaneous $O(1)$ lookups during login or phone search while keeping the actual phone number cryptographically secured at rest.

#### Patch 3: Offline Synchronization & Optimistic Concurrency Control
For rural low-connectivity farm environments, the Flutter mobile client operates offline via an embedded SQLite/WatermelonDB store and synchronizes deltas when reconnected.
To support bidirectional delta synchronization and prevent lost updates:
- Entities `animals`, `milk_logs`, and `health_records` include:
  - `sync_version INT DEFAULT 1 NOT NULL`: Incremented on every mutation to support optimistic concurrency control.
  - `updated_at TIMESTAMPTZ DEFAULT now() NOT NULL`: Granular server timestamp for cursor-based delta synchronization (`WHERE updated_at > :last_synced_at`).

### 4.3 Relational Integrity & Cascading Rules
- **Users**: Soft delete (`deletedAt`). Cascade deletes `RefreshToken` sessions on user purge; restricts deletion if user owns active `Farm` or `Order`.
- **Farms**: Tenant boundary. Soft delete (`deletedAt`). Cascades `FarmMember` associations. Restricts deletion if active `Animal` records exist.
- **Animals**: Scoped to `Farm`. Deleting an animal sets pedigree references (`sireId`, `damId`) to `NULL`. Soft delete (`deletedAt`) maintains historical `MilkLog` and `HealthRecord` data integrity.
- **Consultations & Prescriptions**: 1-to-1 relationship. A prescription cannot exist without a consultation record. Deletion of consultation cascades prescription.

### 4.4 Standardized API Request/Response Envelope
Every REST endpoint in the system will emit and consume the standardized structure:

```typescript
// packages/shared-types/src/contracts/api-response.contract.ts
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
  traceId: string;
  timestamp: string;
}
```

---

## 5. Security Architecture & Edge Cases

### 5.1 Defense-in-Depth Measures
1. **PII Protection & Blind Index**: User phone numbers and national identification numbers are stored with AES-256-GCM authenticated encryption at the repository boundary before being written to PostgreSQL. Fast lookups are handled via HMAC-SHA256 blind index (`phone_hash`).
2. **Session Security**: Stateless 15-minute JWT access tokens coupled with stateful cryptographic Refresh Token Rotation (RTR). Detection of revoked token reuse triggers immediate invalidation of the entire user session tree.
3. **Multi-Tenant Leakage Prevention**: Custom NestJS `@Tenant()` parameter decorator paired with `TenantGuard` automatically inspects route params (`:farmId`) or headers (`X-Farm-Id`) and verifies user membership in `farm_members` before executing business logic.
4. **Idempotent Financial Transactions**: Order fulfillment and payment webhook processing enforce an `Idempotency-Key` stored in Redis with a 24-hour TTL, preventing double-billing on network retries.

### 5.2 Edge Cases & Error Boundaries
- **Database Connection Dropout**: NestJS `PrismaService` implements retry backoff and handles SIGTERM/SIGINT signals with graceful connection drain.
- **Clock Drift in Subscriptions**: All subscription validity comparisons use PostgreSQL server `NOW()` inside queries rather than client application timestamps.
- **Concurrent Tag Number Assignment**: Per-farm ear tag collisions are prevented via PostgreSQL partial unique index: `CREATE UNIQUE INDEX uq_active_farm_animal_tag ON animals(farm_id, tag_number) WHERE deleted_at IS NULL;`.
- **Concurrent Offline Sync Conflicts**: Resolved using `sync_version`. If a incoming mobile delta has a lower `sync_version` than the database, a 409 Conflict is returned with the server state for client reconciliation.
