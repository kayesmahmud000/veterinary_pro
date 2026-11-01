# 0005: Explicit Redis-free testing profile

Date: 2026-10-29
Status: Accepted requirement; implementation/evidence tracked in the task plan
Evidence: [user requirement and acceptance criteria](../../docs/tasks/redis-memory-mode/spec.md), [implementation plan](../../docs/tasks/redis-memory-mode/plan.md)

## Context

Observed dependency failure: the configured Upstash database exhausted its monthly request quota. The upload limiter rejected operations before the otherwise functioning Cloudinary adapter. The user explicitly selected Redis-free development and additionally required Vercel testing deployments to work without Redis, despite their production `NODE_ENV`.

## Options and decision

Local Redis would preserve queues and distributed replay/rate behavior but add a development service dependency. Disabling only the upload limiter would leave background clients connected and remove a guard. The selected option is an explicit `REDIS_ENABLED=false` testing profile: process-local guards/idempotency, no Redis queue clients/workers, and explicit unavailability for queue operations. True remains the compatible default. Network failures never select memory mode automatically.

The host's `NODE_ENV` does not prohibit the explicit profile; it cannot distinguish this project's Vercel testing deployment from a later durable production release. The user made that choice directly. Enabling Redis later is a configuration change, not removal of the testing code.

## Consequences

Core PostgreSQL/course/Cloudinary work can proceed without Upstash. Queue-dependent delivery/processing is unavailable. Memory replay/rate records disappear on restart and do not coordinate across API/serverless instances or PCs. The profile must be described honestly in health/runtime diagnostics and setup guidance. No schema migration is required; no pending database outbox data is deleted or synthetic jobs acknowledged.

## Revisit or supersede

Before relying on durable background delivery, shared rate limits or cross-instance replay protection, enable Redis and verify its capacity/workers. Implementation test results and remaining hosted acceptance belong in the [task evidence](../../docs/tasks/redis-memory-mode/plan.md); this record does not assert a completed deployment.
