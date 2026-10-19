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
- Use the existing `dev-fontend` checkout and preserve unrelated local changes; task-specific temporary build/database artifacts isolate verification.

## Review focus

1. An old handler races a new action: deterministic locks, partial saves, real DB legacy-vs-new tests.
2. Bulk includes paid/held/foreign-vet/currency/stale row: all-or-none failure and zero extra audits.
3. Multiple currencies or large totals: grouped summaries and integer rounding/invariant tests.
4. Approval of private review/concurrent review creation: privacy unchanged, atomic correct aggregates.
5. Timeout/session change/duplicate confirmation: draft retention, secret clearing, reload requirement and browser single-write/account-isolation tests.

### Task 1: Settlement contracts and API

Own `validation/admin-settlements.ts`, `administration/settlements.*` and legacy payout entity/repository/service/controller interfaces/tests. Root owns shared index/module wiring/audit action additions to avoid conflicting writes.

Produces all settlement schemas/types/HTTP shapes in spec. Service `AdminSettlementsService.list(claims,query)`, `.summary(claims,query)`, `.detail(claims,id)`, `.preview(claims,id)`, `.reconcile(claims,id,input)`, `.bulk(claims,input)`.

- [x] Write/run failing contracts/policy/HTTP/real-DB tests for safe reads, money and transactional/replay/legacy boundaries.
- [x] Implement safe bounded reads, grouped summaries, immutable preview and confirmed locked single/bulk writes with audit.
- [x] Correct legacy settlement GET/access/finite preview/processing/currency mixing without provider actions.
- [x] Run focused checks and self-review; provide evidence and schema availability; fresh code review/fixes.

### Task 2: Review contracts and API

Own `validation/admin-reviews.ts`, `administration/reviews.*` and legacy review repository/service/interface/profile aggregate helpers/tests. Do not modify shared legacy vet-profile entity used by ADM-5 unless required; root owns module/index/audit wiring.

Produces all review schemas/types/HTTP shapes in spec. Service `AdminReviewsService.list(claims,query)`, `.detail(claims,id)`, `.moderate(claims,id,input)`.

- [x] Write/run failing policy/HTTP/DB tests for private/public boundaries, stale changes, aggregate rollback/concurrency.
- [x] Implement exact admin gates/projections/password/revision/atomic moderation and safe history.
- [x] Correct legacy review reads and serialize legacy submission/moderation aggregates/audit with new writers.
- [x] Run focused checks and self-review; provide evidence and schema availability; fresh code review/fixes.

### Task 3: Web/BFF and navigation

Own new admin settlement/review components/copy/static pages, workspace BFF/navigation/shell/dashboard and new focused boundary tests. Root owns `check-dashboard-browser.mjs` and new `admin-finance-browser-cases.mjs` integration fixtures. Consume exact Task1/2 shared contracts.

- [x] Write/run failing BFF/SSR/navigation tests for exact roles/methods/query/body/projections/ID correlation.
- [x] Implement settlement list/summary/vet/detail/preview/single+bulk confirmation and moderation list/detail/actions.
- [x] Verify draft/session/error recovery, privacy/transfer wording, disabled invalid selection and localized responsive rendering.
- [x] Run focused type/style/boundary tests; source freeze for isolated build/browser; fresh review/fixes.

### Task 4: Integration, verification and handoff

Root owns shared index/module/audit registration, browser fixture/harness, disposable local PostgreSQL, final builds and integrated verification plus docs/roadmaps/context.

- [x] Wire new providers/controllers/schema exports and known bounded operational audit reasons.
- [x] Run real DB races/rollback, full API regression, focused web/style/type/build and bn/en320/1440px browser flows with denied roles.
- [x] Review combined changes, fix material findings, rerun covering checks and compare tested source artifact.
- [x] Update evidence/owning roadmaps/context, validate docs/diff and stop task services; leave source for human Git.

## Execution ledger

Pre-flight: Task1 and Task2 produce disjoint shared/API files; Task3 consumes exact schemas but owns only web paths; Task4 owns common module/index/audit wiring and harness. Legacy payout and review sources do not share files except module exports owned by root. Shared contracts must be written before final dependent builds; no simultaneous real-DB suites against shared fixtures.

Ruling: user's clarification explicitly selects ADM-6; ADM-5 deployment remains outside this task. Proceed with spec-driven reversible implementation without new design approval gates, following host instructions. Legacy safety/privacy fixes are necessary compatibility work for ADM-6, not unrelated refactoring.

## Continuation and review — 2026-10-19

Resumed from human commit `d68b6ac` on `dev-fontend`, with a clean initial working tree. That commit contained partial ADM-6 source while the plan checkboxes and owning roadmaps were not yet updated. Existing work was inspected and completed rather than recreated. No Git index/history, deployment, production writes, provider transfers or migration additions were performed.

**Confirmed from code:** registered the settlement/review controllers and services in AdministrationModule, reusing the exported veterinarian profile provider. Added the three known administrative audit actions to the bounded operational view/reason allowlist. Reads retain minimal projections, deleted-identity redaction and bounded history.

**Review findings fixed with regressions:**

- Legacy payout single/bulk/capture creation lacked atomic ledger/audit behavior; shared deterministic actor/consultation/ledger locks, partial mutable-field persistence and transactions now cover those paths. Bulk failure rolls back all affected records/audits; mixed legacy summary currencies are rejected.
- Current administrative identity/version checks and legacy payout validation were incomplete. New admin workflows retain password confirmation, fail-closed limits and locked actor rechecks. Legacy bodies now require valid references, 1–20 unique UUIDs and known fields; custom preview rates must be finite in [0,1]. Successful legacy DTOs remain intact.
- Raw PostgreSQL/Prisma serialization/deadlock failures now map to reloadable settlement/review conflicts, including P2010 SQLSTATE metadata.
- The existing pending-review privacy test accidentally created an APPROVED fixture. The fixture now explicitly uses PENDING; privacy and aggregate behavior have actual database coverage.
- Invalid navigation regular-expression literals prevented web checks loading; corrected and covered by navigation/finance checks.
- Omitted optional batch IDs preserve existing batch metadata; BFF acknowledgment and the atomic audit now agree with the resulting ledger. Redacted veterinarian identities remain valid in filtered views; a different nonnull identity is still rejected.
- UUID casing is canonical across API schemas/controller parameters, BFF routes/filters, revisions and text audit-history lookup. Mixed-case duplicate bulk IDs cannot bypass uniqueness validation.
- Reload/revalidation clears passwords and confirmation state while preserving nonsecret drafts. Stale/uncertain results require a fresh read. Missing refreshed selections are discarded, exact minor-unit money is displayed without floating-point cent loss, and explicit Asia/Dhaka localization is retained.
- Displayed actor binding survives a queued session lock: the finance client carries the captured actor key, and the BFF rejects a changed account/role/version before forwarding a write. Confirmed identity changes discard the mounted draft subtree.

Independent task/integration review used a separate reviewer. Findings above were reproduced before fixes and re-reviewed; final verdict and integrated verification follow below.

## Final integration verification — 2026-10-19

Continuation resumed the existing working tree and saved task/reviewer reports. The previous temporary services/logs were no longer present, so the final checks below were executed afresh. Existing implementation was preserved. The saved independent review approved the corrected settlement/review/web source for integrated validation with no unresolved material finding; this continuation also reviewed module bindings, lock ordering, financial partial writes, privacy, confirmation state and the final documentation diff.

**Observed behavior — fresh local checks:**

| Check | Result and scope |
| --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Passed CJS/ESM/declaration generation. |
| `pnpm --filter @vetralink/api build` | Passed Prisma generation and Nest compilation. |
| `NODE_ENV=test API_DEBUG=0 DATABASE_URL=<synthetic-loopback-url> pnpm --filter @vetralink/api test --runInBand` | **229 suites / 2,106 tests passed**; **8 suites / 114 tests skipped** because their separate opt-in integration environments were not supplied. The skipped ADM-6 database suites were then run explicitly below. Expected negative-case logs are not test failures. |
| Real PostgreSQL ADM-6 suites | **2 suites / 33 tests passed** (14 review, 19 settlement). Used Node 22, PostgreSQL 18.4 at `127.0.0.1:55436/adm6_test`, all 27 existing migrations deployed into the new disposable database, synthetic identities and real repositories/transactions/audits/password hashing. No migration was added or changed. |
| Full application context smoke | Passed actual compiled AppModule startup against the same disposable PostgreSQL and Redis 8.0.5 at loopback port 56386; registered settlement list/summary/review reads returned empty cleaned fixtures, and a password-confirmed missing review returned 404 through the real limiter and services. Temporary synthetic admin was removed. Existing bootstrap plan initialization emitted caught duplicate-tier warnings; ADM-6 startup/read/limiter assertions still passed. This is not an external-provider test. |
| Web boundary/style regressions | **120/120 passed**, no skips: finance, workspace, navigation, protected routes, admin dashboard/consultations, auth, style guard and Tailwind compilation. Commands below. |
| Isolated production web build | Passed final Next.js production compilation, type validation and page generation after the rendered rating fix. Only the temporary copy used `experimental.cpus: 2`; no project config change. All 211 source/config/public files were hash-compared with the working tree and matched. |
| Tailwind policy | `pnpm --filter @vetralink/web check:styles` passed. |

Reproduce the database run from the repository root with `NODE_ENV=test API_DEBUG=0 DATABASE_URL=<synthetic-loopback-url> SETTLEMENT_TEST_DATABASE_URL=<same-url> REVIEW_TEST_DATABASE_URL=<same-url> pnpm --filter @vetralink/api test --runInBand --testPathPattern='administration/(reviews|settlements).database.spec'`. Both URLs must name an explicitly disposable loopback `/adm6_test` database. The two suites run sequentially and clean their own synthetic fixtures.

Web command: `pnpm --filter @vetralink/web exec node --test scripts/check-admin-finance.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-admin-dashboard.mjs scripts/check-admin-consultations.mjs scripts/check-auth.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`.

**Browser findings and corrections:** actual production-build Chrome execution exposed harness readiness issues: refresh readiness inspected an input's own disabled property instead of its disabled fieldset, and a review conflict wait matched the always-present page refresh button before the mutation finished. Scoped waits now require the action's stale marker to clear and `:disabled` to be false. The independent summary/list failure scenario also needed to wait for both cards and retry each card; clicking the first retry refreshed only the summary. These fixes preserve the intended recovery scenarios. Rendered review details also exposed a literal `{f.number(5)}` denominator; a new Bangla/English rating assertion failed with `৪/{f.number(5)}` instead of `৪/৫` before the interpolation was corrected. The rebuilt artifact passed the new localized rating assertion and the complete browser suite below.

**Evidence limits:** HTTP/BFF suites use controlled dependencies; browser flows use real Next/React/BFF and synthetic controlled upstream responses. PostgreSQL suites and startup smoke establish separate real persistence/concurrency and Redis checks. No production deployment/data mutation, provider transfer/refund/charge, notification dispatch, new schema migration or Git index/history operation was performed. Deployed ADM-6 and real-provider acceptance remain unverified and outside this task.


**Observed behavior — final production browser acceptance:** `WORKSPACE_BROWSER_FOCUS=finance WEB_TEST_BUILD_DIR=/tmp/adm6-web-1xhh5ti0 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` passed **199 checks**, exit 0. Both ADMIN/SUPER_ADMIN and bn/en at 320/1440px were exercised, including list/grouped summary/vet/detail/preview, held/inconsistent read-only records, single/bulk acknowledgement, preserved private reviews, password rejection, stale/uncertain recovery, double-confirmation single-write behavior, removed selected rows, same-account secret clearing, changed-account draft discard, independent summary/list retry, four denied roles across all five routes and BFF denial. The request log contains no transfer/refund/capture/notification route. Eight screenshots are in `/tmp/khamar-workspace-qa-jo6NlD`; final English desktop review and Bangla mobile settlement screenshots were visually inspected for readable content, corrected ratings, wrapping, financial wording and privacy presentation. Chrome is the tested engine; alternate-browser and native-device acceptance remain unverified.

**Final re-review and housekeeping:** the saved independent review's material findings are resolved; this continuation's rendered rating fix passed its failing-then-passing browser assertion. No unresolved material ADM-6 finding was identified in final self-review. Context validation passed (**48 Markdown documents, 341 local links, 95 source entries**), browser script syntax and `git diff --check` passed. API/web/root roadmaps, documentation authority index and relevant client/testing context now link the implemented local slice and its limits. PostgreSQL, Redis and browser harness servers were stopped; temporary logs/build/screenshots remain available for inspection. Logs: `/tmp/adm6-api-all.log`, `/tmp/adm6-database-final.log`, `/tmp/adm6-app-smoke.log`, `/tmp/adm6-web-boundaries.log`, `/tmp/adm6-web-build.log`, `/tmp/adm6-browser-final.log`.

**Completion:** Tasks 1–4 are complete for local ADM-6 acceptance. Deployment/provider acceptance remains separate. Source is left unstaged for human-managed Git. Suggested commit: `feat(admin): complete settlement reconciliation and review moderation`.
