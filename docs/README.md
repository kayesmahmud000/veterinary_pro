# Documentation and planning guide

## Ownership and hierarchy

**Shared product baseline → feature/task specification → implementation plan → workstream roadmap → implementation and verification evidence.** Requirements flow downward; observed gaps and approved requirement changes flow back to the owning specification. A roadmap checkbox never overrides acceptance criteria.

| Document | Owns | Does not own |
| --- | --- | --- |
| [Platform specification PDF](../vetralink_platform_specification.pdf) | Original product baseline, audiences, journeys, launch/growth intent | Live task status or API availability |
| [Product blueprint](../vetralink_pro_blueprint.md) | Navigable summary of that baseline and historical commercial/technical intent | A second independent requirements or delivery tracker |
| `docs/features/<slug>/spec.md`, `docs/tasks/<slug>/spec.md` | Concrete feature contracts, refinements, acceptance criteria; cite the parent product section and any explicit supersession | Proof the feature shipped |
| Adjacent `plan.md` | Implementation steps, API/web split where relevant, decisions and verification evidence | A new copy of requirements or global milestone status |
| [API roadmap](../apps/api/ROADMAP.md) | Backend progress/history and API readiness for consumers | Browser completion |
| [Web roadmap](../apps/web/ROADMAP.md) | Web progress, sequence and dependency references | Independent API readiness claims |
| [Root roadmap](../ROADMAP.md) | Navigation and cross-workstream coordination | Duplicate feature checklists |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Original architecture/design intent | Inventory of already implemented files |
| [.context](../.context/README.md) | Current operating guidance, observed architecture and known gaps | Duplicate specs, task history or another backlog |
| `docs/guides/` | Developer/operational procedures | Feature requirements or release certification |

Keep paired specs/plans in their existing folders. There is no benefit in creating parallel `docs/specs` and `docs/plans` trees and moving the existing history. Application directories are `apps/api` and `apps/web`, not root `/api` and `/web`.

## Active web planning

The [public-site specification](features/web-public-site/spec.md) owns the implemented landing-page structure, first-build pages and proposed future route inventory. Its [implementation plan](features/web-public-site/plan.md) covers the public-site batch only. [Web roadmap](../apps/web/ROADMAP.md#landing-page-and-routing-roadmap) owns WEB-1A–E progress. WEB-1A–D public-site implementation is recorded in the plan; accounts and reserved routes remain unimplemented.

## Before starting a feature

1. Read [.context](../.context/README.md), [root roadmap](../ROADMAP.md), then the relevant API/web roadmap. Use the [domain map](../.context/features/README.md) to locate existing numbered task specs/plans.
2. Reuse the existing specification when extending its contract. For a new cross-stack feature, put shared acceptance criteria in one `docs/features/<slug>/spec.md` and execution steps in its adjacent `plan.md`. Reference the relevant PDF section and existing task IDs. Do not clone an API spec into a web spec.
3. A web-specific task may use `docs/tasks/web-<slug>/spec.md` and `plan.md`, linking shared requirements and backend contracts. These paths are a naming convention, not claims that those files exist. Define UI states/flows there, not by copying the backend DTO catalogue into the roadmap.
4. In the plan record required method/path, permissions and tenant context, linked controller/DTO, the API register ID, provider prerequisites and acceptance tests. Link any missing API task. API documentation uses the `/api/v1` prefix; binary downloads and WebSocket messages need their own contract checks.
5. Update the owning roadmap with **not started**, **in progress**, **blocked** (explicit dependency), or **complete** (linked verification evidence). API **Present** is a source observation; **Ready** requires integration evidence in the target environment. Record date/environment so readiness does not imply permanent certification.
6. The implementer owns related spec/plan/roadmap updates in the same change; the reviewer checks both workstreams and links. Shared features finish only when required API and web acceptance steps pass. Scope unresolved product decisions explicitly rather than silently selecting a conflicting requirement.

## Historical documents and conflicts

Reviewed **2026-10-05** against source revision **d5d311b**. Preserve historical before/after descriptions, original task IDs, checked steps and dated evidence. A spec's “Current State” describes its writing-time baseline, not today's inventory. A plan's checkboxes record its execution history; neither proves a full client or deployed integration works today.

| Existing ambiguity | Current interpretation and source |
| --- | --- |
| PDF §3 Phase 1 MVP / Phase 2 growth; PDF §7 and blueprint §4 Sprints 0–4 over 14 weeks; old root roadmap Phases 0–5 / Sprints 0–15 | Product release horizons, original schedule and granular backend execution sequence are different axes. None supplies a new web deadline. Workstream trackers own current progress; do not map them by matching numbers. |
| Backend “triage dashboard”, “doctor portal”, “prescription editor” marked complete | [Task 12.2](tasks/task-12.2-triage-queue-dashboard/spec.md), [13.1](tasks/task-13.1-doctor-clinical-portal-ehr/spec.md), [14.1](tasks/task-14.1-structured-prescription-editor/spec.md) define API/DTO/service work. Browser features are WEB-7/8/9 and are not implemented. |
| PDF §3 / blueprint §4 examples use Basic 25 / Pro 150; commercial table uses 5 / 30 / unlimited | [Task 10.1](tasks/task-10.1-plan-configuration/spec.md) refines the baseline to STARTER 5 / PRO 30 / ENTERPRISE unlimited. [Shared plan constants](../packages/shared-types/src/dto/subscription/subscription-plan.dto.ts) define defaults consumed by the [plan service](../apps/api/src/modules/subscriptions/services/subscription-plan.service.ts). Web must consume the plan API for current prices/limits, not hardcode either historical table. |
| Sprint 0 plan says PROPOSED while steps are checked | Retained writing-time header; shared bootstrap is recorded complete in API history and scaffold source exists. This is not a pending bootstrap task or completed feature UI. |
| Task 15.3 says mobile sync complete | Backend and Flutter sync library exist; mobile UI wiring and web offline UX do not follow from this. See [offline sync context](../.context/features/offline-sync.md). |
| Task 15.4 and architecture use production-ready/sign-off language | Historical intent/report, not current certification. [Known gaps](../.context/known-gaps.md) and fresh runtime/security/load evidence govern release decisions. |
| All original sprint tasks checked, but product baseline contains more requirements | Preserve the original scope/history. API-B1/B2 and WEB-11 explicitly track uncovered journeys and contract decisions; the PDF's growth ideas remain product direction, not automatic implementation commitments. |

Where a task spec explicitly refines a broad example, use that refinement for the feature. Where no documented decision resolves a conflict, record it as unresolved in the shared feature spec before implementation; source establishes actual behavior but does not silently waive an unmet requirement. This guide is the authority index, not a replacement copy of the PDF.

Historical completed plan steps that formerly named root `ROADMAP.md` now link to the API tracker containing the same task IDs. Sprint 0's account of creating the root file remains historical fact. The root entry point is retained so external and older references still have a useful destination.

## Why this structure

The existing root roadmap was predominantly API work, with shared bootstrap, sync and release history mixed in. `docs/` already groups each spec with its execution plan and has no global status index. At the roadmap-separation baseline, `apps/web` contained only a home page and layout; the public site was implemented afterward. Moving the tracker without a root entry point would lose coordination and mislead old references; keeping two full root/API trackers would duplicate status. The chosen structure keeps a small root index, one API history/readiness owner, one web status/dependency owner and this authority guide. No application directories or existing spec/plan folders are moved.

Reconsider separate mobile tracking only when a mobile delivery task needs it. Recovering the former structure is a documentation-only reversal; no runtime or database migration is involved.
