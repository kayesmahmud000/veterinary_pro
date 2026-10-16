# Administrative consultation operations implementation plan

> Use subagent-driven-development for scoped implementation and review. Repository instructions override skill commit/approval defaults: keep Git human managed and proceed with the authorized reversible implementation.

**Goal:** Deliver ADM-5 administrative triage and consultation history with safe audited assignments/cancellations.
**Architecture:** Add shared strict contracts and a repository/service/controller under administration, retaining legacy consultation boundaries. Reuse workspace BFF and UI patterns; no schema change, external dispatch or deployment.
**Tech stack:** NestJS, Prisma/PostgreSQL, Zod, Next.js/React, Tailwind.
**Spec:** [spec.md](spec.md).

## Global constraints

- Bangla default plus English; Tailwind utilities and existing workspace/auth primitives.
- Exact administrative role/current identity gates, bounded queries, safe projections.
- Atomic audit/revision/concurrency protections; preserve payment and clinical records.
- No git add/commit/merge/push or production data/provider/deployment action.
- Work in current clean `dev-fontend` checkout; preserve unrelated user work. This avoids introducing a branch/worktree policy into the human-managed checkout. Build artifacts may use task-specific temporary directories.

## Review focus

1. Competing assignments to different cases exhaust one vet's capacity: serialize/recheck and real DB test.
2. Legacy payment/clinical updates race admin writes: revision and serializable conflict test; partial updates only.
3. Availability uses a non-UTC timezone: schedule/candidate tests cover local working hours.
4. Deleted identities/raw stored delivery failures must not leak PII: projection tests at API and BFF.
5. Stale save/session change loses operator work or retains secrets: browser failure/reload/identity tests.

### Task 1: Shared contracts and administrative API

Files: create `packages/shared-types/src/validation/admin-consultations.ts`; export from index. Create `apps/api/src/modules/administration/consultations.{repository,service,controller}.ts`, focused unit and disposable-database tests; register providers/controller and known operational audit actions.

Interfaces: shared schemas/types named in spec; `AdminConsultationsService.list(claims,query)`, `.detail(claims,id)`, `.candidates(claims,id)`, `.action(claims,id,input)`. API shape is the binding cross-task interface.

- [x] Write failing policy/contract tests for role/version/password, strict action/query, allowed transitions, availability and redaction; run and observe missing-feature failure.
- [x] Implement shared schemas and guarded bounded reads, then transactional password-confirmed assignment/cancellation and durable IN_APP records.
- [x] Add real disposable PostgreSQL tests for stale/concurrent writes, capacity, rollback, payment preservation and legacy changes; run when isolated service is available.
- [x] Run shared build, focused API tests and TypeScript; self-review and report evidence. Review spec/quality before completion.

### Task 2: Administrative workspace/BFF

Files: create `apps/web/src/components/workspace/admin-consultations.tsx`, `apps/web/src/lib/i18n/admin-consultations.ts`, static triage/consultations list/detail pages. Modify workspace server/navigation, shell localization and admin dashboard; add `apps/web/scripts/check-admin-consultations.mjs`.

Consumes Task 1's exact schemas; produces fixed GET list/detail/candidates and POST actions BFF mappings plus the four released web routes. Keep imports buildable once shared contracts land.

- [x] Write/run failing BFF tests for fixed methods, roles, query/body constraints, response ID correlation, redaction and conflict propagation.
- [x] Implement BFF, localized queue/history/detail/candidate/action UI, navigation and destination allowlists.
- [x] Run focused BFF/navigation/protected/style/type checks and production build; self-review and report evidence. Review spec/quality before completion.

### Task 3: Integrated browser verification and handoff

Files: add `apps/web/scripts/admin-consultations-browser-cases.mjs`, integrate controlled production harness; update owning API/web roadmaps and concise relevant context with verified evidence.

- [x] Run browser tests for both roles/languages/widths, all four denied roles, queue/history/detail/manual/automatic/cancel, no candidates, password/stale error recovery and secret clearing.
- [x] Re-review combined changes, fix in-scope findings and rerun covering checks.
- [x] Record actual tests/build/database/browser evidence and remaining deployment/provider limits; validate documentation and final diff.

## Execution ledger

Pre-flight: Task 1 produces shared schemas consumed by Task 2/3; exact names and fields are fixed in spec. Task 2 owns BFF/UI; Task 3 owns separate browser fixtures/harness integration. No shared source edit conflicts. Each task's checks cover its stated interfaces.

Ruling: proceed with user-authorized implementation without additional design/plan approval gates, following host instructions and repository scope workflow. Keep all source changes in the current clean development branch and suggest a human commit only.

Review ruling: extend Task 1 narrowly to legacy consultation entity/repository persistence and vet admission validation. Source review confirmed that delayed full-entity payment writes can undo ADM-5 state and that ReadCommitted legacy assignments bypass the new capacity serialization. Changed-field persistence retains provider evidence; domain baseline checks and a shared vet fence protect operational transitions. Do not use blanket post-provider xmin rejection that would lose a real payment reference. Record the remaining in-flight provider reconciliation boundary explicitly.

Observed interim verification: all 27 active-schema migrations applied to a fresh task-only loopback PostgreSQL 18 database; this is not a production migration. Existing consultation regression suite passed 41 suites / 393 tests before the legacy compatibility correction. Initial isolated Next production build passed and the controlled browser suite passed 155 checks covering both roles/languages/320–1440px, assignment/automatic assignment/cancellation, stale draft/password clearing, no-candidate/empty/error recovery and nonadmin page/BFF denial. Mobile Bangla and desktop English screenshots were visually inspected. The final results below supersede this interim run.


## Final implementation and review

**Confirmed from code:** strict shared Zod request/projection schemas, administrative API/controller/module bindings, list/detail/candidate discovery, current-primary identity and password/limiter checks, xmin revisions, serializable assignment/local-cancellation transactions and same-transaction audit/IN_APP records. The four bilingual web routes use fixed BFF mappings, validated destinations, ID correlation, server/admin boundaries and existing workspace controls. Clinical notes, prescription, payment gateway, settlement and external notification controls are not exposed.

**Review findings fixed:** legacy full-entity saves could undo a newer assignment/cancellation and legacy ReadCommitted assignment could overfill a vet alongside ADM-5. Reproduced four failing real-database regressions, then changed legacy saves to persist dirty fields, guard domain baselines and share a real-write vet serialization fence/capacity/schedule check. Payment-only saves preserve actual provider evidence without replaying old domain fields. Existing working-hour checks now use the profile timezone. Audit reason visibility uses an explicit nine-action allowlist; the first full API run exposed the original USER_SUSPENDED reason regression, and all user/billing/consultation reasons now have coverage. Cancellation also preserves notices/audit identity for a soft-deleted assigned vet without exposing that identity in the detail projection.

UI review fixed duplicate Platform headings, ambiguous same-name vet choices (visible short/full IDs), and cursor history surviving external filter reset. The production browser regression failed on the old artifact's erroneous Previous button, then passed on the final source. Password failure preserves nonsecret draft; rapid confirmation produces one write; same-account session checking keeps the reason while clearing password; confirmed account changes discard the draft. Scoped code re-review found no remaining Critical/Important defect within this slice.

## Final verification evidence

All service data is synthetic and local. No production database, real payment/mail/SMS/push provider, Git index/history or deployment was changed.

| Check | Observed result |
| --- | --- |
| Shared types build and API/web TypeScript checks | Passed |
| Final full API Jest run (`DATABASE_URL=<loopback adm5_test> CONSULTATION_TEST_DATABASE_URL=<same> pnpm --filter @vetralink/api exec jest --runInBand --silent`) | **224 suites / 2,057 tests passed; 5 other environment-gated suites / 55 tests skipped**, zero failures. Skipped suites are role-workflow, billing, learner-course, product/media and course-curriculum database suites requiring their own isolated database names. |
| Final focused administration tests (`--testPathPattern='administration/(consultations|directory)'`) | **77 passed**: 26 real PostgreSQL transaction tests, 16 consultation policy tests, 9 Nest HTTP boundary tests and 26 directory tests. HTTP token/identity/service dependencies are controlled; it does not certify live JWT/Redis configuration. |
| Final API/web production builds | Both passed. API uses the active Prisma schema; web built in `/tmp/adm5-final/apps/web` with linked existing dependencies and no copied credential files. Existing optional sharp/cache-size build warnings remain. |
| Web BFF/SSR/navigation/workspace/protected/catalog/directory/dashboard regression run | **114 tests passed**, zero failures. Fetch responses are controlled fixtures. |
| Tailwind `check:styles` and `test:styles` | Passed; **14 style tests**. |
| `WORKSPACE_BROWSER_FOCUS=consultations WEB_TEST_BUILD_DIR=/tmp/adm5-final/apps/web pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **164 checks passed**, actual production Next/BFF/Chrome with controlled loopback API. ADMIN/SUPER_ADMIN; bn/en; 320/1440px; lists/details/manual/automatic/local cancellation, provider/terminal denial, stale/wrong-password/no-candidate/empty/unavailable recovery, duplicate-save prevention, account-change draft isolation and cursor reset. Four other roles denied on all four routes and BFF. |
| `node scripts/check-localization.mjs http://localhost:3100` against the final isolated production build | Passed: 80 localized GETs, 60 native language submissions, persistence/concurrency, 5 unsafe returns, 12 catalog filters, 4 CSV downloads and 2 missing-template checks. Earlier attempts failed only because no server was running or the browser harness had already stopped its server; a dedicated task server resolved the test setup. |

Disposable PostgreSQL **18.6** ran from extracted official Ubuntu packages under `/tmp/adm5-postgres`, bound only to loopback port 55435; all **27 existing migrations** applied to a new `adm5_test` database. This checks PostgreSQL behavior locally, not a new production schema rollout or PostgreSQL 16 production acceptance. Race tests cover same-case/same-vet/mixed-writer changes, rollback/retry, active/profile/capacity/timezone/schedule constraints, stale/repeated requests, provider cancellation denial, payment/media/request preservation, deleted identities, bounded history/candidates and preserved in-flight payment evidence. Existing limiter policy is reused; these transaction tests stub Redis limiting, so live Redis/provider acceptance is separate.

Final browser screenshots and logs are retained under `/tmp/khamar-workspace-qa-5UMsKC` and `/tmp/adm5-*.log`; Bangla 320px and English 1440px screens were visually inspected. The task's private temporary servers are stopped after checks. Production release/credentials are untouched. No migration is introduced by ADM-5; rollback is a source deployment rollback preserving saved operational/audit/notice records.

**Remaining limits:** already-in-flight legacy payment completion may produce CANCELLED + AUTHORIZED with the actual provider reference retained for reconciliation; no automatic refund/release is claimed. Existing provider-vs-provider reconciliation and legacy service-level audit behavior remain outside this slice. Candidate discovery ranks at most the first 100 active vet IDs and discloses truncation; production latency at that bound is unmeasured. No external SMS/push/email or realtime stream delivery is claimed from an IN_APP database record. Deployed acceptance remains pending; ADM-6 is a separate future task.

**Final handoff checks:** all 190 web source files match the tested production snapshot byte-for-byte. `python3 -X utf8 .context/scripts/validate.py` passes 48 context Markdown documents, 339 local links and 95 source entries; all context documents are reachable. `git diff --check` passes. Only the task's isolated localization server and PostgreSQL instance were stopped; source remains uncommitted on `dev-fontend` for human-managed Git.

Suggested human-managed commit: `feat(admin): add audited consultation operations`.
