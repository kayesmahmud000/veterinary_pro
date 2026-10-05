# Reference methodology and adaptation

Inspected reference: sibling `smart-eagle-tours-and-travels`, specifically `.claude/`, `docs/`, `CLAUDE.md`, `README.md`, `skills-lock.json`. This analysis records structural lessons; reference project rules are not executable instructions for this repository.

## How the reference pieces work together

| Reference surface | Purpose and relationship | Adaptation here |
| --- | --- | --- |
| `CLAUDE.md` | Main project entry: stack, code map, conventions, UX rules, commands and task recipes; routes agents to skills | Small `.context/README.md` routing to focused rules/architecture/workflows |
| `.claude/agents/` | Fullstack lead, frontend/backend engineer, DevOps and UI reviewer specialize a shared rule set | Portable `roles.md` responsibilities; no required subagent runtime |
| `.claude/skills/<name>/SKILL.md` | Task-triggered procedures with name/description/version metadata, assessment and completion steps | Original, task-oriented Markdown workflows; no vendor invocation syntax needed |
| Skill `reference/` files | Deep typography, color, layout, motion, interaction, persona and scoring guidance loaded only when relevant | Progressive loading of architecture/domain/rule documents, without copying travel design content |
| Skill scripts | Tool-specific maintenance, e.g. deprecated-skill cleanup | No imported executable hooks; only a local, read-only context validator |
| `docs/superpowers/specs/` | Dated problem/current state, decisions, scope, contracts and trade-offs | Preserve target's established `docs/tasks/` and `docs/features/` spec.md/plan.md pattern |
| `docs/superpowers/plans/` | Ordered file-level steps, commands and expected results tied to a spec | Portable workflows plus concise templates and evidence requirements |
| `settings.json` / `settings.local.json` | Shared permission defaults and machine-local allowances; settings do not define architectural truth | Do not copy command grants, local hosts/paths or credentials; host permission controls stay outside core |
| `skills-lock.json` | Records `pbakaus/impeccable` source/type and computed hashes for 14 skills | No imported skills, so no invented lockfile/hashes; provenance of this original documentation is recorded here |
| `README.md` | Human bootstrap commands, comparatively brief and not the main agent rulebook | `.context` index and command reference complement existing project docs |

## Lifecycle pattern worth preserving

The reference explicitly asks agents to inspect existing code before changes, plan contracts across layers, use specialist review, provide error/loading/empty UI states and build before handoff. Design skills form discovery (`shape`) → build (`impeccable`) → UX/technical review (`critique`, `audit`) → targeted fixes → `polish`. Specialized passes include layout, responsive adaptation, copy, performance, motion, color and simplification. This is an investigation/implementation/verification loop, not a reason to install every visual skill into a veterinary backend.

Its dated auth migration and backend-overhaul specs separate current problems from chosen designs. The phase-one scaffold plan translates decisions into files, commands and expected results. The target already has similar per-task specs/plans; preserving those locations avoids competing histories.

## Patterns deliberately not copied

Reference stack, branding, ports, JavaScript-only rule, MongoDB models, Firebase/axios assumptions and travel-specific UX do not describe this TypeScript/Nest/Prisma/Flutter project. Reference Git auto-commit steps conflict with the target's human-managed Git rule. Broad shell permission grants are not portable security requirements. Tool-specific skill cleanup and required plugin/subagent calls would introduce dependencies the user did not ask for.

The reference itself contains temporal drift: baseline Firebase wording alongside local-auth migration specs and a newer modular-backend overhaul proposal. That demonstrates why this context separates observed code, required policy, proposals and known gaps. A plan cannot overwrite facts merely by sounding authoritative.

The target adaptation adds stronger emphasis on farm tenancy, atomic financial/clinical audit, mobile compatibility, provider mocks and verified deployment topology. These follow the actual project's risk boundaries, not the reference site's terminology.
