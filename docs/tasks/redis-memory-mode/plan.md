# Redis Memory Mode Implementation Plan

> Execution: subagent-driven-development for one cohesive backend task, followed by independent review and parent runtime verification. Human-managed Git policy overrides skill commit/worktree steps; use this checkout and leave changes uncommitted.

**Goal:** Run local and Vercel testing APIs without Redis while retaining normal course/thumbnail functionality and explicit background-job limitations.

**Architecture:** A typed explicit Redis flag selects process-local workflow limits/idempotency and prevents BullMQ client/worker construction. Existing Nest queue DI tokens remain available through disabled queue providers that reject actual operations. Persistent Redis behavior remains the default; false is an intentional hosted-testing option, not a network-error fallback.

**Tech stack:** Existing NestJS/TypeScript, BullMQ, ioredis, Jest; no new dependencies.

**Spec:** [Required behavior](spec.md).

## Global constraints

- `REDIS_ENABLED` defaults true; false works in Vercel testing with production NODE_ENV by explicit user request.
- No Upstash/network Redis traffic in memory mode; no fake queue success or disabled security checks.
- Preserve unrelated changes and all existing credentials. No Git writes, migration, deployment or dependency installation.

## Review focus

1. Bull queue providers may eagerly connect before the worker registrar runs; both queues and workers must be disabled.
2. Repeatable-job bootstraps and role dispatcher loops must not enqueue/poll in memory mode.
3. Concurrent idempotency claims and rate-limit attempts must retain their single-process guards.
4. Health/platform diagnostics must not open Redis clients or falsely report Redis available.
5. Explicit hosted-testing configuration must survive Vercel validation paths and preserve default Redis behavior when omitted/true.

## Task 1: Cohesive backend runtime profile

**Files:** API config schema/service and tests; `common/security/workflow-rate-limiter.ts` and new focused tests; `common/idempotency/` factory/store/tests; new `common/queues/` runtime registration/helper/tests; root and feature queue registrations; three repeatable-job initializers; separate role-worker registration/dispatcher; health controller/tests; administration platform probe/tests; API env examples.

**Interfaces:** `EnvService.redisEnabled: boolean`; exported runtime queue registration helper and disabled-queue predicate shared by queue modules/initializers; existing public HTTP/domain signatures remain compatible.

- [ ] Write meaningful failing tests and observe red before implementation: strict flag/default/hosted false; memory limiter 429/expiry/isolation/concurrent calls/no Redis; memory store selection/atomic claim; disabled queues/no constructed client/no workers; enabled queue delegation; health/platform skip Redis.
- [ ] Implement profile and queue integration; inspect installed Nest BullMQ registration APIs before adapting providers. Keep clients/worker construction gated, not merely commands.
- [ ] Run focused tests and actual Nest initialization with Redis construction forbidden; fix/re-review covering paths.
- [ ] Run complete API tests, build and serverless wrapper suite; record counts and limitations.

## Task 2: Review, local configuration and handoff

- [ ] Independent spec/quality review; resolve material findings with covering checks.
- [ ] Set local API `REDIS_ENABLED=false` without printing/changing credentials; restart only the relevant local API runtime if needed and verify health/runtime mode/no Redis sockets.
- [ ] Update current context, setup guidance and this plan with Vercel testing flag, disabled queues, instance-local state and Redis re-enable steps.
- [ ] Final whitespace/context/scope checks and self-review. Suggested commit: `feat(api): support Redis-free testing mode`.

## Execution record

Initial condition: Upstash EVAL rejects commands because its monthly quota is exhausted; Cloudinary upload/public retrieval succeeded. Existing user UI changes are uncommitted and outside this backend task.

Decision: hosted testing may use explicit memory mode despite production NODE_ENV, following the user's correction. Redis remains the default when the flag is absent; memory mode is never selected automatically because a provider failed.
