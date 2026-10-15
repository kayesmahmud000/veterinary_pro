# ADM-2 implementation plan

Execute inline using executing-plans and test-driven-development. Spec: [spec.md](spec.md).

Goal: add functional directory/account-support/audit workflows to existing administration.
Architecture: shared strict Zod contracts → guarded controller → policy service → projected repository; existing fixed BFF and workspace UI.
Stack: NestJS/Prisma/PostgreSQL, Next.js/React/Tailwind, shared Zod.

## Constraints and review focus

No migration/dependency changes, minimal PII, bounded relations, both languages and explicit Dhaka dates. Preserve privilege BFF, role review, Farmer/learner routing. Review revoked/demoted actors during writes, audit unknown/private events, missing cursors, stale confirmations and navigation after account switching.

## Tasks

- [x] Task 1: shared contracts and API repositories/service/controllers. Write failing tests for active admin admission, ordinary-only transitions, stale versions, password confirmation, sorted locks, same-transaction audit/refresh invalidation, audit visibility/redaction and pagination; run RED, implement, run GREEN. Files: shared validation/admin-directory.ts; administration/directory{.repository,.service,.controller}.ts; module binding; directory.spec.ts.
- [x] Task 2: fixed BFF mapping to admin/directory; write real handleWorkspace tests for both admin roles, other-role denial, strict queries/actions, privilege compatibility and secret stripping; RED→GREEN. Files: workspace/server.ts, shared validation/admin-directory.ts, scripts/check-admin-directory.mjs; preserve legacy admin/users Super-only mappings.
- [x] Task 3: bilingual reusable directory/list/detail/action components, released routes and navigation. Create both-language browser coverage for search/filters/pagination/details/actions/confirmation/conflicts/audit privacy/denial/mobile; implement the reviewed contract, then verify the integrated UI against the production build. Files: components/workspace/admin-directory*.tsx, i18n/admin-directory.ts, app/(workspace)/admin/{users,veterinarians,farms,audit}, navigation and shell copy.
- [x] Task 4: fresh code/security/UI review, focused/full API regressions, web boundary/style/build and browser acceptance; disposable database acceptance if available. Record evidence/limits; update owning API/web roadmaps and linked context; inspect final diff. Suggested human commit: feat(admin): add directories account support and audit viewer.

## Execution ledger

2026-10-14: clean dev-fontend checkout inspected. Ruling: work in current checkout and isolate web builds under /tmp, preserving the shared IDE workflow and human-managed Git. The user authorized the explained ADM-2 sequence; repository/host instructions permit concrete spec/plan and routine implementation without repeated approval. Execute inline; retain evidence here. No product writes to configured live databases.

Pre-flight: Task 1 shared schemas feed Task 2 BFF and Task 3 UI. New directory namespace avoids collision with existing Super-only admin/users. Action expectedAuthorizationVersion matches existing token invalidation mechanism; no schema/version alias needed.


## Implementation and verification — 2026-10-15

Implemented the shared strict contracts, injected projected repository/policy service/guarded controller, fixed BFF namespace, eight list/detail routes, both-language screens and shared navigation. Ordinary account actions use password confirmation, Redis rate limiting, sorted actor/target row locks, expected authorization version and one transaction for status/version/refresh invalidation/audit. Existing privileged-access mappings stay SUPER_ADMIN-only. Audit filtering precedes keyset pagination; snapshots expose explicit scalar fields only.

Test-first evidence from 2026-10-14: initial API tests failed on missing directory modules; initial BFF tests returned 404 on directory routes. Separate review found active-animal-count and deleted-owner projection defects; both were reproduced by failing regressions and fixed. Additional BFF regressions reproduced mismatched detail IDs and non-VET upstream identities (200 instead of 502), then passed after enforcing the requested ID and literal VET role.

Ruling: retain separate `admin/directory` endpoints instead of repurposing privilege APIs — preserves existing consumers; the cost is a second explicit namespace. Ruling: all administrative account targets are protected from ordinary support actions — stronger last-Super protection; administrative status changes require a separately specified workflow. Ruling: UI browser cases were written against the integrated implementation; a pre-feature UI build was not retained, so no browser RED claim is made. API/BFF missing-capability failures and the final browser results are recorded separately.

| Verification | Observed result |
| --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Passed, CJS/ESM/declarations; `/tmp/adm2-shared.log` |
| `pnpm --filter @vetralink/api build` | Passed after outside-sandbox Prisma generation/Nest compilation; `/tmp/adm2-api-build-external.log` |
| `DATABASE_URL=<synthetic-local-URL> NODE_ENV=test pnpm --filter @vetralink/api test --runInBand` | **214 suites / 1,913 tests passed; one opt-in suite / 26 tests skipped**. No failed tests. Synthetic configuration only; `/tmp/adm2-api-full.log` |
| Web boundary/regression scripts | All **nine script suites passed**: `API_DEBUG=0 pnpm --filter @vetralink/web exec node --test scripts/check-admin-directory.mjs scripts/check-admin-dashboard.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-auth.mjs scripts/check-farm-overview.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`; `/tmp/adm2-web-tests.log` |
| `pnpm --filter @vetralink/web check:styles` | Passed; Tailwind policy retained |
| Isolated web production build | `pnpm exec next build /tmp/web-adm2-_f3eeov9` from apps/web passed, including type checks and all eight new routes; `/tmp/adm2-web-build-external.log`. Copy uses existing dependencies/cpus=2 and no environment files; active `.next` untouched |
| Browser regression | `WEB_TEST_BUILD_DIR=/tmp/web-adm2-_f3eeov9 pnpm --filter @vetralink/web test:dashboard:browser` exited 0: **303 checks passed**, including **171 new directory checks**; `/tmp/adm2-browser-final.log`. ADMIN/SUPER_ADMIN, bn/en, 320/1440px list/details, pagination/empty search, confirmation/suspension, stale-version feedback, error retry, secret stripping and wrong-role denial; prior dashboard/auth/farm/registry regressions included |
| Visual inspection | Viewed `/tmp/khamar-workspace-qa-sfDANh/directory-ADMIN-bn-320.png` and `directory-SUPER_ADMIN-en-1440.png`: readable labels/results, responsive stacking, visible action controls and one active navigation item; automated checks found no horizontal overflow |
| Real isolated services | Outside-sandbox probes returned **ECONNREFUSED** on PostgreSQL 55432, Redis 56379 and API 3311. No live database concurrency/rollback/token-revocation acceptance was performed; unit assertions about transaction arguments are not a substitute |
| Documentation/diff | `python3 .context/scripts/validate.py` passed (48 documents / 322 links / 95 source entries); `git diff --check` passed. Final Markdown link/whitespace checks recorded below |

Final review: separate read-only reviewer reported two P2 findings (deleted owner projection and inactive animal counting). Both fixed with RED→GREEN regressions; final full API suite is green. Implementer re-reviewed final projections, service locks, unchanged privilege mappings and browser outcomes. Browser-test readiness predicates and the expected non-admin redirect were corrected to match the real DOM and existing middleware; no product redirect behavior was changed.

Local implementation is complete. **Live database and deployed acceptance remain pending**, including actual concurrent writes, audit rollback and access/refresh invalidation across sessions. Exports, CMS publication, clinical editing and later admin batches remain outside ADM-2. Roadmaps and `.context/project.md` now reflect implementation versus those evidence limits. Temporary logs/screenshots may expire between sessions; this ledger preserves results. No schema migrations, configured-live-data writes, provider calls, dependency changes, deployment, staging or commits occurred.

Suggested human commit: `feat(admin): add directories account support and audit viewer`.

Final documentation validation: changed Markdown checks passed for **six documents / 193 local file links**, with changed-line/new-document whitespace checks passing. A whole-file whitespace probe initially encountered preserved historical trailing spaces in the API roadmap; those unrelated historical lines were left intact and `git diff --check` confirms no introduced whitespace errors. Context validation passed **48 documents / 322 local links / 95 source entries**. Final handoff follows the human-managed Git rule: changes retained in the current checkout; no integration operation requested or performed.
