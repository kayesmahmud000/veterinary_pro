# Role/authentication execution roadmap and verification

Status: **Implemented and locally verified, 2026-10-07.**

User authorization: backend changes followed by frontend delivery with Zod; mandatory FARMER onboarding, owner-managed members, modal authentication, default LEARNER and optional FARMER/VET/BUYER signup. On 2026-10-07 the user also authorized commits and pushes to dev-backend and dev-fontend. No production database migration or deployment has been performed.

## Branch delivery

The implementation is published in two workstream branches: dev-backend owns the new API/migrations/worker, and dev-fontend owns the new modal/workspace frontend. Both share the same six-role/Zod contracts and cross-stack documentation commit. Branches start from the previously integrated main baseline and preserve their existing history through fast-forward updates. The documentation and integration evidence describe the combined implementation; deploy compatible backend and frontend revisions together.

Specification: [contract](spec.md). Execution: [backend](backend-plan.md), [frontend](frontend-plan.md). Baseline: [investigation](current-state.md). Inventory: [file impact](file-impact.md). Verification/rollout: [operations](operations.md).

## Requested-output index

| Deliverables from original request | Reference |
| --- | --- |
| Current architecture, limitations | [Historical current state](current-state.md) |
| Six-role model, professional request workflow, ADMIN/SUPER distinction | [Specification](spec.md) |
| Backend, API, schema, notifications, security, migration and edge cases | [Backend plan](backend-plan.md) |
| Modal auth, farmer setup/members, Zod and administrative frontend | [Frontend plan](frontend-plan.md) |
| Affected files/modules | [Inventory](file-impact.md) |
| Verification, release limits and recovery | [Runbook](operations.md) |

## Dependency roadmap

- [x] Read backend/source/tests and shared repository guide; preserve prior auth-modal work.
- [x] Update specification/roadmap for latest LEARNER/signup/onboarding/Zod corrections and implementation authorization.
- [x] BE-FARM: idempotent atomic onboarding, OWNER creation, existing-member confirmation, tenant/sync/socket gate and audited/quota-protected member addition.
- [x] BE-1: six-role contracts, additive migrations, current-primary identity, versioned sessions, narrow login and transactional refresh reuse handling.
- [x] BE-2: questionnaires, applications/history/reviewer decisions, uniqueness/version/permission/profile/audit transactions.
- [x] BE-3: durable outbox, recipient ledger, independent mail worker, retry/failure handling and local mock-provider acceptance.
- [x] BE-4: SUPER-only privileged changes, fresh password/reason, safe fallback, last-SUPER serialization, audited revocation and offline first-SUPER bootstrap path.
- [x] FE-1–4: default/professional modal auth, Zod boundaries, farmer setup/farm/member views, application/history/review and administrative access.
- [x] Review → Test → Re-review: fixed error envelope mapping, target fallback preview, paired GPS feedback, quota serialization, advisory-lock return type, refresh replay rollback and runtime build output.
- [x] Finalize implementation docs/context and owning roadmaps.
- [ ] Separate release: live lineage/backup inventory, legacy populated-data rehearsal, staging real-provider acceptance, persistent worker/realtime hosting and compatible production cutover.

## Verification record

The original planning checks and five-role findings are historical; final behavior is six roles. Local verification uses synthetic fixtures, isolated PostgreSQL/Redis and mock mail. Commands/results and exact evidence limits are recorded in [operations](operations.md).

Reviewed browser pages in both languages, including narrow onboarding/farm forms, accessible modal focus/Escape, Zod errors, state transitions and denial. Backend checks cover stale authorization, private projections, transaction rollback, races and privilege recovery. Existing BUYER member access and explicitly authorized ADMIN/SUPER clinical/support routes remain intact.

No claim is made that live migrations or real-provider delivery occurred. Feature implementation is complete; release steps remain separate operational work. Human-managed Git policy is preserved.

Suggested commit message: feat: add learner roles and farmer onboarding with Zod auth flows.
