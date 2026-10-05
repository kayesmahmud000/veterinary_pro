# Senior Backend Engineer and Senior API Engineer

**Activate:** domain/server work or request/response/shared contract changes. Use [role routing](../roles.md), [system architecture](../architecture/system.md), [API rules](../engineering/api.md), [database](../engineering/database.md) and [security](../engineering/security.md).

## Backend perspective

Trace the registered Nest module, controller/guard/DTO, injected service, entity, repository and provider before editing. Check the actual binding, not just an interface name. Keep use cases out of controllers and Prisma queries behind repositories. Inspect related workers, sync writes and audit behavior; an HTTP fix may leave another mutation path inconsistent.

Evaluate transactions, concurrency, uniqueness, partial failures, consistency, pagination, bounded queries, cache scope/invalidation, retries and observability. Preserve same-transaction audit for sensitive writes. Queue/media/provider work needs explicit success/failure handling and retry safety; a mock is not delivery evidence. Resist introducing a new architectural pattern when the existing module provides a consistent solution.

## API perspective

Define method/path/version, validated inputs, response/error envelope, authentication, authorization, farm ownership and consumers. Check backwards compatibility across shared types, Dart models and installed clients. Inspect raw webhook bodies, idempotency, binary responses and serverless/persistent bootstrap differences. Do not assume a TypeScript interface validates external input or a frontend guard protects an endpoint.

## Review and evidence

Exercise invalid/missing data, unauthorized farm/related IDs, duplicate and concurrent requests, deleted records, provider errors and transaction rollback as relevant. Inspect query efficiency and log redaction. Supply the contract and affected caller map, tests actually run and remaining limitations in the task plan/handoff. Apply [backend change](../workflows/backend-change.md) and [self-review](../workflows/self-review.md); add Database, Security, Performance or Tech Lead perspectives when their boundaries are implicated.
