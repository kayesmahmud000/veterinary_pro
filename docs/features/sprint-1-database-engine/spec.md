# SPEC-101: Database Baseline Migration & Composite Partial Indexes
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.1: Database baseline migration script with composite partial indexes
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish the immutable, version-controlled baseline DDL migration (`0_init/migration.sql`) for PostgreSQL 16. This script translates the 3NF domain model into relational physical structures with foreign key constraints, composite query indexes, and specialized partial indexes for multi-tenant isolation, soft-delete uniqueness, and PII blind search.

### 1.2 Target Deliverables for Task 1.1
1. An authoritative, repeatable baseline SQL migration script (`apps/api/prisma/migrations/0_init/migration.sql`).
2. Inclusion of custom PostgreSQL DDL:
   - Partial Unique Index: `uq_active_farm_animal_tag` on `animals(farm_id, tag_number) WHERE deleted_at IS NULL`.
   - Partial Blind Unique Index: `uq_users_phone_hash` on `users(phone_hash) WHERE phone_hash IS NOT NULL`.
   - Multi-tenant composite performance indexes (`farm_id` + `status`, `farm_id` + `logged_date`, `farm_id` + `updated_at`).
3. Verification of migration repeatability and rollback safety under transactional DDL.

---

## 2. Current State vs. Proposed State

| Dimension | Current State (Post-Sprint 0) | Proposed State (Task 1.1) |
| :--- | :--- | :--- |
| **Prisma Schema** | Hardened 3NF schema exists at `apps/api/prisma/schema.prisma`. | Schema verified and mapped 1:1 to migration DDL. |
| **Migration Files** | No migration history (`apps/api/prisma/migrations/` is empty). | `0_init/migration.sql` created, version-controlled, and verified. |
| **Soft-Delete Tag Uniqueness** | Commented in schema, but not yet realized in physical database index. | Applied via custom partial unique index DDL. |
| **PII Phone Search** | Field `phone_hash` present in Prisma model. | B-Tree index applied on `phone_hash` for constant-time exact match queries. |
| **Multi-Tenant Indexing** | Single-column FK indexes only. | Compound B-Tree indexes optimized for tenant filtering (`farm_id`, `status`), (`farm_id`, `species`). |

---

## 3. Architectural & Design Trade-offs

### 3.1 Migration Strategy: `prisma migrate dev` with DDL Customization vs. `prisma db push`
- **Option A: `prisma db push` (Prototyping mode)**
  - *Pros*: Fast schema sync without creating migration files.
  - *Cons*: Cannot be tracked in Git; completely ignores custom SQL statements like partial indexes (`WHERE deleted_at IS NULL`) which Prisma schema does not natively support as first-class DSL attributes; unsafe for production deployments.
- **Option B: Versioned Prisma Migrations with Custom SQL Extensions (CHOSEN)**
  - *Pros*: Creates deterministic, versioned `.sql` files in Git; allows manual inclusion of PostgreSQL-specific features (partial indexes, triggers, extensions); runs inside transactional DDL blocks (`BEGIN ... COMMIT`).
  - *Justification*: In production enterprise platforms, unversioned schema pushes are strictly forbidden. The partial unique index is a non-negotiable architectural requirement that requires raw SQL integration in the migration.

### 3.2 Soft-Delete Unique Index: Composite Constraint vs. Partial Unique Index
- **Option A: Standard Composite Unique `UNIQUE(farm_id, tag_number, deleted_at)`**
  - *Flaw*: Under ANSI SQL-92 and PostgreSQL specification, `NULL` is not equal to `NULL`. When multiple animals in the same farm have `deleted_at = NULL`, PostgreSQL allows duplicate `(farm_id, tag_number, NULL)` tuples, violating domain integrity.
- **Option B: Partial Unique Index `WHERE deleted_at IS NULL` (CHOSEN)**
  - *Syntax*:
    ```sql
    CREATE UNIQUE INDEX "uq_active_farm_animal_tag" 
    ON "animals"("farm_id", "tag_number") 
    WHERE "deleted_at" IS NULL;
    ```
  - *Justification*: Guarantees that within any given farm, active animals (`deleted_at IS NULL`) must have strictly unique tag numbers, while allowing archived/deceased animals with identical historical tags to coexist peacefully.

### 3.3 Phone Number Searchability: Plaintext vs. Salted Hash vs. Blind Index
- **Option A: Plaintext storage with UNIQUE index**
  - *Flaw*: Unacceptable security risk; violates GDPR/PII compliance.
- **Option B: Deterministic AES encryption (ECB or fixed IV)**
  - *Flaw*: Cryptographically weak (frequency analysis attack vulnerability).
- **Option C: AES-256-GCM Randomized Ciphertext + HMAC-SHA256 Blind Index (CHOSEN)**
  - *Mechanism*: Phone is stored encrypted with AES-256-GCM (using random IV per encryption). An uninvertible, deterministic `phone_hash` is computed as `HMAC-SHA256(phone_e164, HASH_PEPPER)`.
  - *Index*:
    ```sql
    CREATE UNIQUE INDEX "uq_users_phone_hash" 
    ON "users"("phone_hash") 
    WHERE "phone_hash" IS NOT NULL;
    ```
  - *Justification*: Provides true $O(1)$ indexed lookup during authentication without decrypting table rows, and prevents rainbow table attacks through the server secret pepper.

---

## 4. Exact Physical Schema & DDL Specification

### 4.1 PostgreSQL Types (Enums)
The migration will declare 18 PostgreSQL enumerated types:
- `UserRole`, `UserStatus`
- `FarmType`, `FarmRole`
- `AnimalSpecies`, `AnimalGender`, `AnimalStatus`
- `HealthEventType`, `SeverityLevel`
- `MilkSession`
- `TransactionType`, `TransactionCategory`
- `ProductType`, `SubscriptionTier`, `OrderStatus`, `SubscriptionStatus`
- `ConsultationType`, `ConsultationStatus`

### 4.2 Tables (17 relational tables)
1. `users`
2. `refresh_tokens`
3. `farms`
4. `farm_members`
5. `animals`
6. `health_records`
7. `vaccine_records`
8. `milk_logs`
9. `farm_transactions`
10. `products`
11. `orders`
12. `order_items`
13. `subscription_plans`
14. `subscriptions`
15. `consultations`
16. `prescriptions`
17. `audit_logs`

### 4.3 Custom Indexes Specification
```sql
-- 1. Soft-Delete Tag Uniqueness
CREATE UNIQUE INDEX "uq_active_farm_animal_tag" 
ON "animals"("farm_id", "tag_number") 
WHERE "deleted_at" IS NULL;

-- 2. PII Blind Index Lookup
CREATE UNIQUE INDEX "uq_users_phone_hash" 
ON "users"("phone_hash") 
WHERE "phone_hash" IS NOT NULL;

-- 3. Multi-Tenant Animal Filter Optimization
CREATE INDEX "idx_animals_farm_status" ON "animals"("farm_id", "status");
CREATE INDEX "idx_animals_farm_species" ON "animals"("farm_id", "species");
CREATE INDEX "idx_animals_farm_sync" ON "animals"("farm_id", "updated_at");

-- 4. Milk Log Analytics Query Optimization
CREATE INDEX "idx_milk_logs_farm_date" ON "milk_logs"("farm_id", "logged_date");
CREATE INDEX "idx_milk_logs_animal_date" ON "milk_logs"("animal_id", "logged_date");

-- 5. Audit Log Time-Series Traversal
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "idx_audit_logs_trace" ON "audit_logs"("trace_id");
```

---

## 5. Security & Edge Cases

1. **Transactional DDL**: PostgreSQL supports transactional migrations. All table creation, index builds, and constraints are wrapped in a single transaction (`BEGIN ... COMMIT`). If any statement fails, PostgreSQL rolls back the entire migration cleanly, preventing half-migrated states.
2. **Nullable Soft-Delete Preservation**: Historical soft-deleted animals (`deleted_at IS NOT NULL`) do not trigger unique constraint collisions when a farmer reuses an old ear tag for a newborn calf.
3. **Data Integrity on Cascades**:
   - Deleting a farm cascades its member records (`farm_members`), but *restricts* deletion if `animals` or `financial transactions` exist.
   - Deleting an animal sets pedigree references (`sire_id`, `dam_id`) on offspring to `NULL` via `ON DELETE SET NULL`, preserving lineage without foreign key violations.
4. **Offline Sync Concurrency**: Column `sync_version INT DEFAULT 1` and `updated_at TIMESTAMPTZ` guarantee optimistic locking support when mobile clients send updates.

---

## 6. Verification Criteria for Task 1.1

1. **Syntax Validation**: `prisma validate` passes with zero errors.
2. **DDL Generation**: Baseline migration directory `apps/api/prisma/migrations/0_init/` created with `migration.sql`.
3. **Partial Index Inclusion**: Verification that `uq_active_farm_animal_tag` and `uq_users_phone_hash` are present in `migration.sql`.
4. **Client Synchronicity**: `prisma generate` passes and the TypeScript client reflects all entity typings.
