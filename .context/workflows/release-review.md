# Workflow: release/readiness review

**Role progression:** [Production/Release](../roles/debugging-production.md) + [Tech Lead](../roles/architecture-lead.md), with Database/Security and [QA/Code Reviewer](../roles/quality.md) for affected boundaries. Use [evidence labels](../engineering/evidence.md); enter the [self-review cycle](self-review.md) at Review for a review-only task, and perform its full sequence for any authorized implementation fixes.

**Inputs:** release revision, target environment, affected services and acceptance criteria. **Output:** evidence-backed ready/blocked assessment and concrete deployment plan. This workflow does not itself authorize publishing, migrations or provider charges.

1. Inspect [known gaps](../known-gaps.md), [runtime](../operations/runtime.md), task specs and actual CI results. Identify unresolved blockers for the release's scope. Do not inherit the old readiness report's sign-off.
2. Build/test affected packages from the lockfiles. Verify emitted entry paths, generated Prisma binaries, environment configuration, supported runtime and secret provisioning. Check dependency advisories for this release rather than quoting historical counts.
3. Rehearse migrations with representative data and a tested backup/restore or forward-recovery path. Confirm rollback compatibility, mobile schema/version compatibility and immutable financial/clinical history.
4. Verify real auth/tenant denial cases, signed webhook replay handling, subscription restrictions, object access and sensitive-log redaction. Confirm diagnostic endpoints and CORS policy are safe for the target exposure.
5. Demonstrate compatible durable queue workers, scheduling, FFmpeg and realtime hosting. Exercise retry/restart behavior and provider sandbox delivery. Verify health/readiness plus real user paths; HTTP ping is insufficient.
6. Run authorized load scenarios and retain measurements with concurrency, data size, duration, error rates and target. Ensure alert ownership for latency, errors, queues, database saturation and payment/sync failures.
7. Produce a deployment checklist with order, owners, migration command, smoke checks, abort criteria, rollback/reconciliation steps and unresolved risks. Execute only within the user's authorization and host permission boundaries.
8. After an authorized rollout, capture actual revision/environment/probe outcomes. Update task evidence and relevant context. Never describe prepared commands or an unexecuted plan as a successful deployment.
