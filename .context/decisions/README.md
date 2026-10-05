# Technical decisions

Decisions distinguish observed architecture from new proposals. Do not invent historical approval or rationale. Records 0001 and 0004 define the context system and its senior role workflow; other baseline records summarize source and existing specs. Use the [Software Architect/Tech Lead perspectives](../roles/architecture-lead.md) and [evidence standard](../engineering/evidence.md) when recording new choices.

| Record | Status | Scope |
| --- | --- | --- |
| [0001: portable context](0001-portable-context.md) | Adopted for this documentation system | Authority, discovery, modular docs and workflows |
| [0002: modular monolith and contracts](0002-modular-monolith.md) | Observed implementation; rationale inferred from code/specs | Nest boundaries, shared types, relational persistence |
| [0003: offline REST deltas](0003-offline-deltas.md) | Recorded in task 15.3 spec; implementation has gaps | SQLite, push/pull, conflict/compatibility requirements |
| [0004: senior role workflow](0004-senior-role-workflow.md) | Adopted at the user's request | Mandatory applicable roles, evidence labels and self-review; extends 0001 |

Add a numbered record for a consequential choice (protocol, persistence, provider, runtime, state/session handling). Use [ADR template](../templates/adr.md): context, options, decision/status, consequences, evidence and reconsideration triggers. A proposal is not accepted merely because a file exists. Supersede records with links rather than deleting decision history. Keep task implementation checklists in `docs/`.
