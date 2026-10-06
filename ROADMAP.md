# VETRALINK PRO — Project Roadmap

Updated: **2026-10-06**. This is the project entry point and coordination guide. Delivery status has one owner per workstream; do not copy their checklists here.

VETRALINK PRO combines farm ERP, educational courses/digital assets and tele-veterinary care. Shared product intent remains in the [platform specification](vetralink_platform_specification.pdf) and its [blueprint summary](vetralink_pro_blueprint.md). Read the [documentation guide](docs/README.md) for authority, requirement refinements and historical phase differences.

## Find the current work

| Question | Authoritative place |
| --- | --- |
| What backend work was completed, and what remains? | [Backend/API roadmap](apps/api/ROADMAP.md): preserved Sprints 0–15, API dependency register and open API-B items |
| What must be built on the web, and what blocks it? | [Web roadmap](apps/web/ROADMAP.md): public-site delivery, Bangla-default bilingual requirements, WEB backlog and API dependencies |
| What should the product do? | [Specification and planning guide](docs/README.md): product baseline and shared feature/task acceptance criteria |
| What actually exists and what is risky? | [Current context](.context/README.md), [known gaps](.context/known-gaps.md), source and verification evidence |
| Where is shared/mobile/operational history? | API roadmap's explicitly labeled shared history; [offline sync context](.context/features/offline-sync.md), [deployment plan](docs/tasks/monorepo-ci-cd-platform-deployment/plan.md) and [runtime guide](.context/operations/runtime.md) |

## Coordination rules

1. Start with [agent instructions](.context/agent-instructions.md), shared requirements, the relevant workstream roadmap and its linked spec/plan.
2. A cross-stack feature has one shared specification under `docs/features/<slug>/` (or an existing task specification). Its plan separates API, web and shared acceptance steps. Roadmaps link to it; they do not redefine requirements.
3. Backend owns API readiness in its dependency register. Web owns UI progress and links to API IDs, required contracts and blockers. API implementation → verified contract/provider readiness → integrated web acceptance. UI design/scaffolding can proceed independently where practical.
4. Update the spec when requirements change, the plan when execution changes, and only the owning roadmap when progress changes. Link evidence; never treat backend completion as web completion.
5. Existing numeric phases/sprints remain backend execution history. New `WEB-*` and `API-B*` identifiers do not rename PDF product phases or reset completed task IDs. No delivery dates or new application work are authorized merely by listing a backlog item.

The former root tracker is preserved in [apps/api/ROADMAP.md](apps/api/ROADMAP.md). Historical references to root `ROADMAP.md` remain navigable through this entry point.
