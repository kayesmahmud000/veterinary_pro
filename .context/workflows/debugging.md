# Workflow: investigate a bug

**Role progression:** [Senior Debugging Engineer](../roles/debugging-production.md) investigates before editing; the owning implementer makes the scoped fix; [QA/Code Reviewer](../roles/quality.md) challenge the cause and regression coverage through [self-review](self-review.md). Add UI Reviewer for UI defects, and Production/Incident + Tech Lead for live incidents. Label unconfirmed causes with the [evidence standard](../engineering/evidence.md).

**Inputs:** expected/actual behavior and reproduction. **Output:** root cause, minimal fix and regression evidence.

1. Establish route/runtime, user role, farm, data conditions and first failing boundary. Use synthetic/redacted examples and trace/job IDs. Read the task context and adjacent tests before guessing.
2. Separate transport/bootstrap, validation, permissions, domain logic, persistence and external provider failures. For Vercel, ping/landing success can precede failed Nest initialization; inspect actual health/readiness and endpoint response status/body. For DI failures, verify provider imports/exports in the consuming module.
3. Inspect logs without secrets. Check queue status/retries for async failures, environment variable presence/validation for integration failures, active schema/migration history for database drift, and queue/cursor/conflict state for offline loss.
4. Reproduce with a focused failing regression test when appropriate. Write/update concise spec/plan for application code changes. Fix the cause within scope; do not suppress exceptions, disable guards or loosen types to hide the symptom.
5. Run the focused test, relevant neighboring tests/builds and boundary checks. For a production incident, document mitigation, affected data and reconciliation separately from the permanent fix; never run reset/cleanup blindly.
6. Report root cause and evidence. Record newly discovered architectural drift in [known gaps](../known-gaps.md) without labeling unrelated concerns as fixed.
