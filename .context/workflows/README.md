# Reusable workflows

These plain Markdown procedures replace vendor-specific skill invocations. Read the relevant file and carry out its steps with the tools available. No plugin, slash command, external download or automated permission grant is required. Each procedure inherits [agent instructions](../agent-instructions.md) and [dynamic role selection](../roles.md); it does not duplicate universal rules. These are reusable, skill-like procedures, not a tool-specific installation or permission mechanism.

| Trigger | Procedure |
| --- | --- |
| Endpoint/domain/shared contract change | [Backend change](backend-change.md) |
| Web, Flutter screen or UI behavior | [UI change](ui-change.md) |
| Schema, index or persisted-field change | [Database change](database-change.md) |
| Offline protocol or SQLite change | [Offline sync change](offline-sync-change.md) |
| Unexpected behavior or incident | [Debugging](debugging.md) |
| Shipping or assessing readiness | [Release review](release-review.md) |
| Meaningful implementation or requested review | [Self-review cycle](self-review.md) |
| Context drift/new architectural knowledge | [Maintenance](../maintenance.md) |

Overall lifecycle: **Understand → Investigate → Plan → Implement → Validate → Review**. Within it, every meaningful implementation follows **Implement → Review → Test → Re-review → Finalize** from [self-review](self-review.md). Use the appropriate implementer, switch to Code Reviewer + QA for review/testing, and add UI Reviewer, Security, Database, Performance or Tech Lead when triggered. Early reproduction/tests remain appropriate; workflow steps do not waive the pre-test review or final re-review.

Choose checks based on actual risk and dependencies. Small tasks keep this lightweight. For documentation-only work, Technical Writer/Architect + Reviewer + QA validate links, evidence labels, source claims and scope; application tests are unnecessary unless application behavior changed. A review-only request does not authorize implementing its findings.
