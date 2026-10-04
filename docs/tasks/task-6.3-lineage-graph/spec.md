# SPEC-603: Animal Lineage Graph & Pedigree Traversal Engine

## 1. Feature Overview & Objective
In livestock management and dairy/beef farming operations, breeding genetics dictate productivity, health resilience, milk yield, and livestock market value. Farmers, herd managers, and veterinarians must trace animal ancestry (sire, dam, paternal grandparents, maternal grandparents, great-grandparents) and analyze progeny/offspring.

### Core Problems Solved:
1. **Ancestral Traceability:** Enable instant generation-bounded traversal ($N$ generations, default 3, max 5) of both paternal (sire) and maternal (dam) lineages.
2. **Inbreeding Risk Mitigation:** Compute the Wright's Inbreeding Coefficient ($F_X$) or detect common ancestors between sire and dam lineages to prevent inbreeding depression (which reduces fertility, milk yield, and immune vigor).
3. **Progeny / Offspring Tracking:** Track all direct offspring produced by a sire or dam with maternity/paternity pairing, gender, birth date, and current status.
4. **Cycle & Anomaly Prevention:** Protect against cyclical parent-child loops (e.g. A is sire of B, B is sire of A) and generational anomalies (e.g., offspring born before parent).

---

## 2. Current State vs. Proposed State

### Current State
- `Animal` table stores `sire_id` (UUID, nullable, FK -> `animals.id`) and `dam_id` (UUID, nullable, FK -> `animals.id`).
- When fetching a single animal (`GET /animals/:id`), Prisma includes immediate `sire` and `dam` summary (1 generation only: `tagNumber`, `name`).
- There is no mechanism to traverse multi-generation pedigrees (grandparents, great-grandparents), fetch progeny/offspring trees, or evaluate inbreeding coefficients.
- Foreign keys `sire_id` and `dam_id` lack dedicated composite indices with `farm_id`, which will degrade recursive queries as herd sizes grow.

### Proposed State
- **Database Optimization:** Add compound indices `@@index([farmId, sireId])` and `@@index([farmId, damId])` on `Animal` model to ensure sub-millisecond recursive pedigree lookups and offspring filtering.
- **Lineage Traversal Engine:**
  - High-performance PostgreSQL Recursive Common Table Expression (CTE) `WITH RECURSIVE animal_ancestors AS (...)` with PostgreSQL `CYCLE` protection to fetch all ancestors up to depth $N$ in a single database round-trip.
  - Progeny query fetching all direct offspring grouped with other parent identification.
  - In-memory hierarchical pedigree tree builder that constructs recursive `PedigreeNodeDto` graphs with paternal and maternal branches.
  - Inbreeding coefficient calculation using Wright's path analysis over common ancestors in the sire and dam lines.
- **API Endpoint:**
  - `GET /api/v1/animals/:id/lineage?generations=3`: Returns the full hierarchical lineage tree, metadata, ancestor count, generation depth, inbreeding coefficient, and direct offspring.
  - Fully guarded by `JwtAuthGuard`, `TenantGuard`, and `RolesGuard`.

---

## 3. Architectural & Design Trade-offs

| Criterion | Option A: In-Memory Recursive Application Queries (N+1) | Option B: PostgreSQL Recursive CTE + Graph Assembly (Selected) | Option C: Dedicated Graph Database (Neo4j / Amazon Neptune) |
|---|---|---|---|
| **Query Performance** | **Poor.** Requires $2^N$ roundtrips (14 queries for 3 generations, 62 queries for 5 generations). | **Superior.** 1 single recursive SQL query resolves all ancestors in sub-5ms using B-tree indices. | **Overkill.** High infrastructure overhead, operational complexity, and data synchronization drift for simple pedigree trees. |
| **Tenant Isolation** | Must be enforced on every single loop iteration. | Enforced at the root anchor and recursive step (`WHERE a.farm_id = :farmId AND a.deleted_at IS NULL`). | Complex multi-tenant partition configuration. |
| **Cycle & Loop Guard** | Application must maintain a visited `Set<string>`. | Native PostgreSQL `CYCLE id SET is_cycle USING path` prevents infinite recursion in database engine. | Native graph traversal. |
| **Maintainability** | High latency under load; prone to connection pool exhaustion. | Pure PostgreSQL standard SQL; zero external dependencies; clean repository encapsulation. | Requires separate cluster, backup scripts, and cross-database transactions. |

**Technical Justification for Option B:**
Option B delivers sub-10ms response times for 3-5 generation pedigree graphs within PostgreSQL 16. It leverages existing normalized relational tables, zero external infrastructure costs, strict tenant boundaries, and atomic transaction isolation.

---

## 4. Inbreeding Coefficient ($F_X$) Computation Algorithm

Wright's Inbreeding Coefficient:
$$F_X = \sum \left( \frac{1}{2} \right)^{n_1 + n_2 + 1} (1 + F_A)$$

Where:
- $A$ is a common ancestor in both the sire's and dam's pedigree trees.
- $n_1$ is the number of generations from sire to common ancestor $A$.
- $n_2$ is the number of generations from dam to common ancestor $A$.
- $F_A$ is the inbreeding coefficient of ancestor $A$ (assumed $0$ for base herd stock unless known).
- If the animal has no sire or no dam recorded, $F_X = 0$.
- If sire and dam have no common ancestors in the traversed graph, $F_X = 0.0$.
- Example values:
  - Parent-Offspring or Full Siblings: $F_X = 0.25$ (25%)
  - Half Siblings or Grandparent-Grandchild: $F_X = 0.125$ (12.5%)
  - First Cousins: $F_X = 0.0625$ (6.25%)

---

## 5. Data Contracts & DTOs

### 5.1 Shared Types (`@vetralink/shared-types`)

```typescript
export interface PedigreeNodeDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly rfidNumber: string | null;
  readonly name: string | null;
  readonly species: AnimalSpecies;
  readonly breed: string | null;
  readonly gender: AnimalGender;
  readonly dateOfBirth: string | null;
  readonly status: AnimalStatus;
  readonly generation: number; // 0 for target animal, 1 for parents, 2 for grandparents
  readonly sire?: PedigreeNodeDto | null;
  readonly dam?: PedigreeNodeDto | null;
}

export interface OffspringSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly rfidNumber: string | null;
  readonly name: string | null;
  readonly species: AnimalSpecies;
  readonly breed: string | null;
  readonly gender: AnimalGender;
  readonly dateOfBirth: string | null;
  readonly status: AnimalStatus;
  readonly otherParentId: string | null;
  readonly otherParentTagNumber: string | null;
  readonly otherParentName: string | null;
}

export interface AnimalLineageDto {
  readonly rootAnimal: PedigreeNodeDto;
  readonly maxGenerations: number;
  readonly ancestorGenerationsFound: number;
  readonly totalAncestors: number;
  readonly inbreedingCoefficient: number; // e.g. 0.125
  readonly inbreedingRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  readonly directOffspring: OffspringSummaryDto[];
  readonly totalOffspring: number;
}
```

### 5.2 API Request Contract
`GET /api/v1/animals/:id/lineage?generations=3`
- Headers:
  - `Authorization: Bearer <token>`
  - `x-farm-id: <farm-uuid>`
- Query Parameters:
  - `generations` (optional integer, min 1, max 5, default 3).

---

## 6. Security, Multi-Tenancy & Edge Cases
1. **Tenant Boundary (`GUARDRAIL-05`):** All recursive SQL anchors and descendant queries explicitly filter by `farm_id = :farmId` and `deleted_at IS NULL`. Even if an animal record references an invalid foreign ID, non-tenant animals are never returned.
2. **Missing Sire or Dam:** Animals without recorded pedigree return `sire: null`, `dam: null`, `inbreedingCoefficient: 0`, and `ancestorGenerationsFound: 0`.
3. **Circular Lineage Prevention:** Protected at two layers:
   - PostgreSQL recursive CTE uses `CYCLE id SET is_cycle USING path`.
   - Application mapper tracks `visitedIds: Set<string>` to avoid infinite tree loops.
4. **Soft-Deleted Ancestors / Descendants:** Soft-deleted animals are excluded from active lineage traversals unless explicitly queried.
