# Administrative settlements and moderation implementation plan

> Execute scoped tasks with subagent-driven-development and parallel agents for independent settlement/review/UI ownership. Repository/host instructions override skill Git/approval defaults: proceed with authorized reversible work; keep Git human managed.

**Goal:** Deliver ADM-6 operational settlement reconciliation and review moderation safely.
**Architecture:** Shared strict contracts and new guarded administration repositories/services/controllers; targeted legacy financial/privacy/aggregate compatibility corrections. Existing workspace/BFF with static route pages and shared components. No migration/provider dispatch/deployment.
**Tech stack:** NestJS, Prisma/PostgreSQL, Zod, Next/React/Tailwind.
**Spec:** [spec.md](spec.md).

## Global constraints

- Bangla default plus English, Tailwind-only, existing auth/current-primary identity and workspace composition.
- Money is integer minor units, currency groups never combined, local PAID is not external transfer proof.
- Password/reason/versioned administrative actions, atomic audit and bounded deterministic bulk operations.
- Preserve clinical/financial snapshots and review privacy/content; no production actions, Git add/commit/merge/push or new branch policy.
- Work in current clean `dev-fontend`; task-specific temporary build/database artifacts isolate verification.

## Review focus

1. An old handler races a new action: deterministic locks, partial saves, real DB legacy-vs-new tests.
2. Bulk includes paid/held/foreign-vet/currency/stale row: all-or-none failure and zero extra audits.
3. Multiple currencies or large totals: grouped summaries and integer rounding/invariant tests.
4. Approval of private review/concurrent review creation: privacy unchanged, atomic correct aggregates.
5. Timeout/session change/duplicate confirmation: draft retention, secret clearing, reload requirement and browser single-write/account-isolation tests.

### Task 1: Settlement contracts and API

Own `validation/admin-settlements.ts`, `administration/settlements.*` and legacy payout entity/repository/service/controller interfaces/tests. Root owns shared index/module wiring/audit action additions to avoid conflicting writes.

Produces all settlement schemas/types/HTTP shapes in spec. Service `AdminSettlementsService.list(claims,query)`, `.summary(claims,query)`, `.detail(claims,id)`, `.preview(claims,id)`, `.reconcile(claims,id,input)`, `.bulk(claims,input)`.

- [ ] Write/run failing contracts/policy/HTTP/real-DB tests for safe reads, money and transactional/replay/legacy boundaries.
- [ ] Implement safe bounded reads, grouped summaries, immutable preview and confirmed locked single/bulk writes with audit.
- [ ] Correct legacy settlement GET/access/finite preview/processing/currency mixing without provider actions.
- [ ] Run focused checks and self-review; provide evidence and schema availability; fresh code review/fixes.

### Task 2: Review contracts and API

Own `validation/admin-reviews.ts`, `administration/reviews.*` and legacy review repository/service/interface/profile aggregate helpers/tests. Do not modify shared legacy vet-profile entity used by ADM-5 unless required; root owns module/index/audit wiring.

Produces all review schemas/types/HTTP shapes in spec. Service `AdminReviewsService.list(claims,query)`, `.detail(claims,id)`, `.moderate(claims,id,input)`.

- [ ] Write/run failing policy/HTTP/DB tests for private/public boundaries, stale changes, aggregate rollback/concurrency.
- [ ] Implement exact admin gates/projections/password/revision/atomic moderation and safe history.
- [ ] Correct legacy review reads and serialize legacy submission/moderation aggregates/audit with new writers.
- [ ] Run focused checks and self-review; provide evidence and schema availability; fresh code review/fixes.

### Task 3: Web/BFF and navigation

Own new admin settlement/review components/copy/static pages, workspace BFF/navigation/shell/dashboard and new focused boundary tests. Root owns `check-dashboard-browser.mjs` and new `admin-finance-browser-cases.mjs` integration fixtures. Consume exact Task1/2 shared contracts.

- [ ] Write/run failing BFF/SSR/navigation tests for exact roles/methods/query/body/projections/ID correlation.
- [ ] Implement settlement list/summary/vet/detail/preview/single+bulk confirmation and moderation list/detail/actions.
- [ ] Verify draft/session/error recovery, privacy/transfer wording, disabled invalid selection and localized responsive rendering.
- [ ] Run focused type/style/boundary tests; source freeze for isolated build/browser; fresh review/fixes.

### Task 4: Integration, verification and handoff

Root owns shared index/module/audit registration, browser fixture/harness, disposable local PostgreSQL, final builds and integrated verification plus docs/roadmaps/context.

- [ ] Wire new providers/controllers/schema exports and known bounded operational audit reasons.
- [ ] Run real DB races/rollback, full API regression, focused web/style/type/build and bn/en320/1440px browser flows with denied roles.
- [ ] Review combined changes, fix material findings, rerun covering checks and compare tested source artifact.
- [ ] Update evidence/owning roadmaps/context, validate docs/diff and stop task services; leave source for human Git.

## Execution ledger

Pre-flight: Task1 and Task2 produce disjoint shared/API files; Task3 consumes exact schemas but owns only web paths; Task4 owns common module/index/audit wiring and harness. Legacy payout and review sources do not share files except module exports owned by root. Shared contracts must be written before final dependent builds; no simultaneous real-DB suites against shared fixtures.

Ruling: user's clarification explicitly selects ADM-6; ADM-5 deployment remains outside this task. Proceed with spec-driven reversible implementation without new design approval gates, following host instructions. Legacy safety/privacy fixes are necessary compatibility work for ADM-6, not unrelated refactoring.
