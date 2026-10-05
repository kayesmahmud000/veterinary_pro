# 0002: Modular monolith, shared contracts and repository persistence

- Recorded: 2026-10-05
- Status: Observed architecture, not a newly approved redesign
- Evidence: `apps/api/src/app.module.ts`, `modules/animals/`, `modules/prisma/`, `packages/shared-types/package.json`, `ARCHITECTURE.md`

## Context and choice

The API composes domain Nest modules into one application. Modules inject repository/service interfaces through tokens; PostgreSQL/Prisma handles relational data. Shared TypeScript contracts build to ESM/CJS/types for workspace consumers. Sensitive writes use transaction and audit abstractions, with implementation exceptions tracked separately.

## Rationale and trade-offs

The documented layering and observed bindings support testable use cases and keep persistence details out of HTTP handlers. A modular monolith avoids the operational/distributed transaction cost of domain microservices. This rationale is inferred from architecture/source, not a claim of an undocumented historical decision meeting.

Interfaces and transaction types still expose some Prisma coupling. Shared types require builds before consumers, and Dart requires manually aligned models. Do not add a general repository framework, split services or migrate databases without measured need and an explicit proposal. Keep query/mapping exceptions visible rather than claiming perfect clean architecture.

The API package's Prisma schema is the operational default. The second root schema is a known unresolved duplication, not a decision to maintain dual authoritative schemas.

## Revisit when

Independent scaling, ownership or deployment constraints justify splitting a module, or contract incompatibilities justify protocol/code-generation changes. Document migration and operational costs first.
