# Workflow: backend/domain change

**Role progression:** [Backend/API](../roles/backend-api.md) + [Security](../roles/security.md) during investigation/design/implementation; Database for persistence and Tech Lead for cross-module changes; [Code Reviewer + QA](../roles/quality.md) for Review → Test → Re-review. Apply [self-review](self-review.md) before finalizing; step-specific tests may also run earlier.

**Inputs:** requested behavior, affected domain, current implementation and task spec. **Output:** reviewed contract/implementation, meaningful tests and evidence. Read [API](../engineering/api.md), [database](../engineering/database.md) and [security](../engineering/security.md).

1. Trace the actual route and registered Nest module. Locate shared DTO exports, local validated DTOs, injected services/repositories and consumers (web, mobile, jobs, webhooks).
2. Create/update the task spec/plan. Specify method/path, permission matrix, request/response/errors, state transitions, tenant ownership, concurrency and compatibility. Identify migration or external provider changes.
3. Implement contract/entity/repository/service/controller wiring in dependency order. Reuse existing interface tokens and transaction manager. Include audit and idempotency where required; do not rely on a guard name without its imports/bindings.
4. Exercise invalid DTOs, absent/expired auth, wrong roles, another farm's IDs, missing/deleted entities, duplicate/concurrent mutation and provider failure cases relevant to the change. Keep controller tests distinct from real database tests.
5. Build shared types, run affected suites and build affected applications. Review both entry points for global middleware/transport changes.
6. Review the final diff and documentation; report exact checks and remaining gaps. Do not mark a mocked provider integration as deployed.
