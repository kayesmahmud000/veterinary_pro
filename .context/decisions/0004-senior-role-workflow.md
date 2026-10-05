# 0004: Dynamic senior roles and evidence-based self-review

- Date: 2026-10-05
- Status: Adopted for this context system at the user's request
- Scope: Agent workflow/documentation; no application behavior changes
- Relationship: Extends [0001](0001-portable-context.md) and supersedes its optional-role wording; other context architecture decisions remain intact

## Context

The original roles table described responsibilities but did not require automatic role selection, phase changes or a deliberate fresh review pass. The user requested a senior multidisciplinary standard, combined roles for cross-layer tasks, evidence labels and mandatory self-review.

## Decision and alternatives

Use [roles.md](../roles.md) as the dispatcher, focused profiles under `roles/`, one [self-review cycle](../workflows/self-review.md) and one [evidence standard](../engineering/evidence.md). Route from entry instructions, domain workflows/rules and templates. Work quality should reflect relevant 4–5+ years experience without claiming human credentials.

A title-only identity statement would not define behavior or evidence. Repeating every checklist in each role would cause drift. Requiring separate agents/tools for every role would harm portability and add unnecessary orchestration. Instead, one agent adopts required perspectives and uses existing task records; delegation remains separately authorized and unnecessary for compliance.

## Consequences

Applicable roles and the Implement → Review → Test → Re-review → Finalize cycle become mandatory. Small changes retain lightweight planning/checks, review-only scope is preserved and current architecture/host permissions remain authoritative. Profiles add focused reading but avoid duplicating technical policy. The validator can verify links/anchors, not enforce future reasoning quality or prove production readiness.

## Revisit when

Roles produce ceremony rather than useful findings, repeated policy starts to drift, or new implemented project boundaries require a profile update. Keep the smallest process that yields concrete, accurate engineering evidence.
