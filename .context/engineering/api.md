# API contracts and transport

Use [Senior API/Backend Engineer](../roles/backend-api.md) and [Application Security Engineer](../roles/security.md) perspectives, with affected client roles for contract changes. Complete [Code Reviewer + QA self-review](../workflows/self-review.md); preserve backwards compatibility across consumers.

Normal HTTP base path is `/api/v1`; Swagger is `/api/docs`. Read both `apps/api/src/main.ts` and `src/serverless.ts` for bootstrap changes. They currently differ in CORS, security headers, lifecycle and error behavior.

Input DTO classes use class-validator/class-transformer and Swagger decorators. Global `ValidationPipe` enables `whitelist`, `forbidNonWhitelisted`, `transform`. Shared TypeScript interfaces alone do not validate runtime data. Validate nested objects, array size, enums, UUIDs, dates and numeric bounds, especially batch/import/sync payloads. Preserve raw request bytes needed for signed webhooks.

Ordinary successful controller returns are wrapped once by `ResponseInterceptor`: `success`, `statusCode`, `message`, `data`, optional `meta`, `traceId`, `timestamp`. `{ items, meta }` is unpacked into `data` plus `meta`. Errors are mapped by `GlobalExceptionFilter`, including `errors` and RFC-7807-style `errorDetails`; consult `packages/shared-types/src/contracts/api-response.contract.ts` for exact types. Binary downloads, raw response handlers, webhooks and serverless wrapper routes need separate inspection; do not force JSON envelopes over binary data.

For every endpoint, specify method, full path, required auth/role/farm, request fields, success and failure bodies, pagination and retry semantics. Preserve consumers when changing enum values, money/date serialization or required fields. Update shared exports, API DTOs, Swagger and Dart models where applicable. Do not return ORM internals, password hashes, tokens or encrypted PII by spreading objects.

Guards are applied at controller/handler level, not globally through `APP_GUARD` in the inspected auth module. Explicitly wire authentication and required roles. Tenant context may come from headers, route/query or token; assert consistency with any body farm ID. `@Public` is metadata, not a security review. Public catalogue, authentication, signed webhooks and verification routes have deliberate exceptions with their own validation.

For idempotent operations, inspect `common/idempotency/` decorators, interceptor, service and configured store. Scope keys to the caller/operation and define payload mismatch, in-progress, expiration and retry behavior. Verify durable business uniqueness as well as temporary replay caches. Browser header changes must be reflected in CORS; current allowed headers do not include every possible idempotency/tenant alias.
