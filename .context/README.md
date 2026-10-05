# VETRALINK PRO development context

This is the canonical, agent-neutral context for `veterinary_pro`. Start here on each new task. Baseline inspected: **2026-10-05**, Git revision **4b1597a**. Descriptions are repository observations, not certification of a live deployment.

## Read in this order

1. [Agent instructions](agent-instructions.md) and [dynamic senior roles](roles.md): identity, automatic role selection, scope and completion rules. Load the applicable role profiles, not every profile.
2. [Project overview](project.md) and [known gaps](known-gaps.md): what exists and what must not be assumed.
3. [Architecture](architecture/system.md), then the relevant domain in [feature map](features/README.md).
4. Relevant [engineering rules](engineering/development.md) and [workflow](workflows/README.md), using the [mandatory self-review cycle](workflows/self-review.md) and [evidence standard](engineering/evidence.md).
5. Source code, adjacent tests, and the task's existing `docs/tasks/` or `docs/features/` spec/plan before editing.

Do not load every historical spec for every task. Follow links for the affected path and its dependencies.

## Existing project documents

These original documents remain part of the context. Read the relevant ones alongside the current implementation; `.context` summarizes and reconciles them rather than replacing their history.

| Document | Purpose and when to read |
| --- | --- |
| [ROADMAP.md](../ROADMAP.md) | Milestones and task tracking; consult for work tied to a roadmap item and verify completion claims against code/tests |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Original architecture, data model and integration intent; compare with [current architecture](architecture/system.md) and [known gaps](known-gaps.md) |
| [Product blueprint](../vetralink_pro_blueprint.md) | Product scope, target capabilities and commercial planning |
| [Platform specification PDF](../vetralink_platform_specification.pdf) | Detailed product requirements and audience context |
| [Feature specifications and plans](../docs/features/) | Existing feature-level designs and implementation checklists |
| [Task specifications and plans](../docs/tasks/) | Detailed contracts, decisions, acceptance criteria and execution history for individual tasks |
| [Operational guides](../docs/guides/) | Existing developer/runbook documentation, including the [Docker guide](../docs/guides/docker-guide.md) |
| [GEMINI.md](../GEMINI.md) | Existing agent entry point and historical execution guidance; its opening note points to the current shared rules |
| [.antigravityrules](../.antigravityrules) | Original engineering safeguards and architectural intent, reconciled by [agent instructions](agent-instructions.md) |

## Task routing

| Task | Read next |
| --- | --- |
| API, auth or contracts | [API](engineering/api.md), [security](engineering/security.md), [backend workflow](workflows/backend-change.md) |
| Prisma, financial or medical writes | [database](engineering/database.md), [migration workflow](workflows/database-change.md) |
| Web or Flutter UI | [clients](architecture/clients.md), [UI rules](engineering/ui.md), [UI workflow](workflows/ui-change.md) |
| Offline sync | [sync](features/offline-sync.md), [sync workflow](workflows/offline-sync-change.md) |
| Bug or incident | [debugging workflow](workflows/debugging.md) |
| Verification | [testing and commands](engineering/testing.md) |
| Code/feature review | [Code Reviewer + QA](roles/quality.md), [self-review](workflows/self-review.md) |
| Performance investigation | [Performance Engineer](roles/performance.md), [evidence standard](engineering/evidence.md) |
| Runtime, deployment or release | [operations](operations/runtime.md), [release workflow](workflows/release-review.md) |
| Architecture or context changes | [decisions](decisions/README.md), [maintenance](maintenance.md) |
| Agent setup or specialist responsibilities | [adapters](adapters/README.md), [roles](roles.md) |
| Why this structure exists | [reference analysis](reference-analysis.md) |

## Ownership and evidence

`.context` owns concise current context and reusable rules. `docs/` owns task-specific specs, plans and evidence; do not duplicate those histories here. `ROADMAP.md` owns milestone tracking. Manifests, source, migrations and tests establish implemented behavior. Existing architecture/blueprint documents describe product intent and may include unimplemented topology. See [known gaps](known-gaps.md) for reconciliations.

Each substantive update must distinguish **observed implementation**, **required behavior**, and **proposed work**. Classify material claims as **Confirmed from code**, **Confirmed from documentation**, **Observed behavior**, **Likely behavior**, **Assumption** or **Unknown** using the [evidence standard](engineering/evidence.md). Recheck source when it changes; this snapshot cannot replace investigation. No external skills are installed or required by this directory.
