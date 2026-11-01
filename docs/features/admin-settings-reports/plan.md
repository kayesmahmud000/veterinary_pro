# ADM-8 implementation and verification

Status: implemented locally; deployed/runtime/provider acceptance remains separate. [Required contracts and acceptance](spec.md).

- [x] Read repository guidance, role perspectives, roadmap, guards/BFF/navigation, current metrics/billing/audit repositories and provider/queue bindings. Starting revision `b88b098`, clean working tree.
- [x] Implement strict shared contracts, additive tables/migration and guarded API services/repositories. Preserve ADM-4 USD pricing, use explicit estimates and cohort series rather than invented historical revenue.
- [x] Implement bilingual Tailwind settings/integrations/system/metrics/report screens, fixed BFF mappings, current actor binding, Super-only middleware/navigation and bounded explicit exports.
- [x] Review security, concurrency, query bounds, privacy, UI state and failure recovery; fix in-scope findings.
- [x] Rehearse populated migration, backup restore and schema diff; run real PostgreSQL invariants plus controlled HTTP/BFF tests, builds/styles and production-browser checks.
- [x] Re-review final state, update owning roadmaps/context and record exact evidence/release limits.

## Rollout and recovery

No production changes in this task. Back up existing database, apply the additive ADM-8 migration through the API package before new API code, then deploy web. Existing clients ignore the tables; reverting application code leaves configuration and append-only audit/diagnostic records intact. Do not drop tables as a routine rollback. Existing worker/provider runtime gaps remain; probe success alone is not dispatch evidence. Release must verify deployed permissions, migrations, durable worker hosting and configured providers separately.

## Evidence

**Observed behavior, 2026-10-19 to 2026-10-20, working tree based on `b88b098`:**

| Check | Actual result and boundary |
| --- | --- |
| Shared contracts | `pnpm --filter @vetralink/shared-types build` passed CJS/ESM/declarations. No framework dependencies added |
| API production build | `pnpm --filter @vetralink/api build` passed Prisma generation and Nest compilation against the active API schema |
| Focused API | `PLATFORM_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55440/adm8_test pnpm --filter @vetralink/api test --runInBand --testPathPattern=administration/platform`: **3 suites / 20 tests passed**. Eleven real PostgreSQL tests, one shared-contract test, five real Nest transport tests with controlled auth/use cases, three controlled Redis/queue/provider-binding tests |
| Full API regression | Same disposable opt-in database, `pnpm --filter @vetralink/api test --runInBand`: **234 suites / 2,134 tests passed; 8 suites / 127 tests skipped**, exit 0, 120.558 seconds. Other opt-in database suites were not enabled; skipped checks are not passes |
| Web boundaries and regressions | `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs scripts/check-admin-communications.mjs scripts/check-admin-finance.mjs scripts/check-admin-consultations.mjs scripts/check-workspace.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-admin-dashboard.mjs scripts/check-auth.mjs scripts/check-public-content.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`: **144 tests passed**, including nine actual ADM-8 BFF/navigation tests with controlled fetch |
| Styling and web build | `pnpm --filter @vetralink/web check:styles` and production `build` passed. Production build ID `XVz6V93skWmh0fni5ek22`; no new styling mechanism/dependency |
| Production Chrome | `WORKSPACE_BROWSER_FOCUS=platform CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs`: **123 checks passed**, actual production Next/BFF against controlled loopback upstream. Both admin roles, bn/en, 320/1440px, exact JSON amounts, date/timezone binding, export artifact clearing, settings save/reload, Super-only redirect, mock/unavailable status, diagnostics, password/stale/uncertain recovery, malformed/private response denial and four ordinary-role denials |
| Visual review | Inspected actual full-page ADMIN Bangla 320px and SUPER_ADMIN English 1440px report screenshots: responsive stacking, wrapped exact amounts, clear period/unit labels, accessible native fields and no horizontal overflow. Eight role/locale/width screenshots are in the temporary directory below |
| Repository/docs | `git diff --check` and `python -X utf8 .context/scripts/validate.py` passed (48 context Markdown documents / 350 local links / 95 curated source entries at this run). Human-managed Git retained |

### PostgreSQL migration and recovery

Used the previously downloaded portable **PostgreSQL 18.4** binaries, a new explicitly disposable loopback cluster at port **55439**, and database `/adm8_test`. Deployed the first **28** unchanged migrations from a temporary copy. Inserted a synthetic baseline account and order (USD 777 minor units), stopped the cluster and preserved a cold backup. Applied only new `20261019160000_admin_platform`; all **29** migrations succeeded and `prisma migrate diff --from-url <local> --to-schema-datamodel prisma/schema.prisma --exit-code --script` returned an empty migration.

Restored that cold backup into a distinct temporary directory/cluster at **55440**, applied migration 29, obtained a second empty schema diff and ran the final real database tests there. Verified the baseline account/name/order/currency/amount and migration count on both clusters after the rehearsal. No applied migration was rewritten, no existing domain table altered and no unknown database reset/dropped. Both task-created clusters are stopped after verification; backup/data/logs remain in `C:/Users/asus/AppData/Local/Temp/vet-adm8-pg`.

Real database cases prove defaults cause no GET write; wrong roles/password/version/demotion/suspension/locked changed password fail; two concurrent settings writers admit one; audit failure rolls back settings/diagnostics/exports; diagnostic replay is actor-bound and does not repeat probes/audits; local-midnight inclusivity/exclusivity, USD/BDT separation, sums above Int32 and annual per-subscription rounding work; 503 synthetic operational audit records (plus one privileged event) page 500+3 without private snapshots/IPs/privileged ADMIN leakage. A real probe observed PostgreSQL UP and deliberately unavailable loopback Redis as UNAVAILABLE without leaking connection credentials/errors.

### Review fixes and evidence limits

**Confirmed from code:** existing ADM-4 billing explicitly prices local plans in USD. New reports name that currency and mark MRR as a current-plan estimate. Existing historical metrics cannot reconstruct old statuses/prices or supply provider invoice currency, so the new range series shows creation cohorts and current order status rather than invented historic revenue/churn. Those legacy routes are unchanged.

Review caught provider fallback semantics: Daily falls back to mock, Stripe can simulate missing-key/legacy mock-intent operations, and SES simulates if its optional SDK is missing. Integration status now exposes safe fallback/simulation flags, distinguishes S3 default credential discovery from missing explicit credentials, and never calls an external provider. Review also removed an invented default support address, disabled settings fields while a write is pending, bound BFF acknowledgements to exact ranges/values/request IDs and kept failed/uncertain forms blocked until explicit reload. Final BFF review also replaced an inherited-property-sensitive response lookup with exact route comparisons; regression cases reject `toString`, `constructor` and `__proto__`. Existing navigation tests were updated to accept newly shipped metrics/settings routes. No unresolved material finding was found in the final scoped re-review; this is the same agent's review, not independent certification.

HTTP/JWT use cases and successful Redis/queue counters in focused transport/probe tests are controlled dependencies. Browser upstream writes persist only in synthetic harness state. Real Redis positive queue/worker observations, provider credential validity, external sending/payment/video/storage behavior, production migration/deployment, cross-browser/device testing and integrated ADM-9 release acceptance are **not established**. No external provider request, production mutation, Git staging/commit/push or deployment was performed. JSON exports are bounded snapshots, not stable multi-page historical snapshots; list-price estimates are not financial receipt statements.

Temporary evidence: `adm8-api-focused.log`, `adm8-api-restored.log`, `adm8-api-regression.log`, `adm8-api-build.log`, `adm8-web-regression.log`, `adm8-web-build.log`, `adm8-browser.log` under `C:/Users/asus/AppData/Local/Temp`. Visually inspected screenshots: `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-ZqSisw`. Final repeated 123-check browser run after the BFF route-lookup fix: `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-CvgZKZ`; the rendered UI is unchanged.

Suggested human commit: `feat(admin): add platform settings diagnostics and reports`. ADM-9 remains the next proposed batch; this task stops after ADM-8.

## UXR-1 implementation and evidence (2026-10-22)

**Goal:** prevent silent loss of existing settings/content drafts. **Architecture:** extract the curriculum exit handling into a shared hook under the existing early popstate provider; connect each editor's saved baseline and explicit reload. Add a language-form marker so save/confirmation forms remain unaffected. **Scope:** existing routes/contracts, bilingual copy and Tailwind only; no persistent browser drafts or Git mutations.

- [x] Add production-browser regressions for the audited silent-loss cases and observe failure before implementation.
- [x] Share exit handling, register both editors, protect explicit reloads, and preserve failed-save drafts and curriculum behavior.
- [x] Review, run focused boundary/style/build/browser checks, re-review and record evidence; update only UXR-1 delivery status.

Review focus: language actions can preserve component state; stale/uncertain saves must not clear drafts; accepted exits must not warn twice; cancelled history must retain URL and router state; same-page/new-tab interactions must not discard edits.

**Assumption:** the user's “continue” resumes the first proposed implementation batch in the latest handoff, UXR-1. Other UXR batches and ADM-9 release gates stay open. Existing unrelated ADM-9/audit/planning changes are preserved. The repository's lightweight spec/plan and reversible-work authorization take precedence over skill approval and Git-commit suggestions; implementation runs in this checkout, with an isolated temporary build copy.

### UXR-1 verification record

**Observed behavior, 2026-10-22:** local candidate on `a07d77f` plus existing ADM-9/audit/planning changes and this scoped implementation. Node 22.22.1, pnpm 10.18.3, Next 14.2.35 and Chrome 154.0.8037.97; synthetic identities/HTTP upstreams, actual production Next/BFF/components/router. No API, database, provider or production deployment was changed.

| Verification | Result / evidence boundary |
| --- | --- |
| Baseline settings/content browser regressions | Both failed with zero discard prompts before fixes (`browser-settings-red.log`, `browser-content-red.log`). |
| `NODE_ENV=production API_BASE_URL=http://127.0.0.1:3411/api/v1 pnpm --dir /tmp/vet-uxr1-23ddivdn/web build` | Passed styles, production compilation and type checking. Temporary web source copy excludes credentials/development output, links existing dependencies and limits build CPUs to two through a scratch-only Next config; checkout build output was preserved. |
| `pnpm --filter @vetralink/web check:styles` | Passed. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs scripts/check-admin-communications.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-auth.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs` | **57 tests passed**, no skips (`boundary-tests-final.log`), controlled upstreams. |
| `WORKSPACE_BROWSER_FOCUS=unsaved WEB_TEST_BUILD_DIR=/tmp/vet-uxr1-23ddivdn/web pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **239 checks passed** (`browser-green.log`): settings/content, bn/en at 320/1440px, cancelled links/language/Back/Forward/explicit reload, exact field retention, no unexpected writes, actual native reload and close cancellation, acknowledged save/reopen, conflicting save retention, confirmed discard and locale change. Navigation API is disabled in 320px cases to exercise indexed-history fallback; native-anchor Back/Forward retains the live editor and Next tree. Includes curriculum locale discard and publication recovery-reload regressions. |
| Same browser command with `WORKSPACE_BROWSER_FOCUS=platform`, `communications`, `admin-courses` | **123 + 99 + 165 = 387 existing checks passed** (`browser-<focus>.log`). Recovery reload cases explicitly accept the newly required discard prompt. |
| Visual review | Inspected settings Bangla 320px and content English 1440px viewport captures from `/tmp/khamar-workspace-qa-drP2vH`: readable fields, wrapping, visible focus and unchanged layouts; automated overflow checks passed. Final eight captures are in `/tmp/khamar-workspace-qa-I6nTCP`. Native browser dialog text/buttons are browser controlled. |

Logs/build copies are under `/tmp/vet-uxr1-23ddivdn`; these temporary files may expire. Tests/specs and this record remain in the repository. Cancelled internal navigation uses a simulated answer to native `confirm`; reload/close checks exercise actual Chrome beforeunload dialogs with trusted activation. This is not alternate-browser/mobile-device, screen-reader or deployed acceptance.

**Review and re-review:** a fresh-context read-only reviewer found the publication recovery reload bypass, curriculum rows remaining visible after locale discard and history fallback truncating Forward entries. Each was reproduced before correction and covered by the passing browser suite. Review of the new history indexing found native anchors could lose Next's tree; the failing anchor regression now passes, including actual Back/Forward. Indexed metadata preserves Next state without storing form fields. No outstanding material scoped findings remain in final self-review. Existing failed/uncertain-write restrictions, role/actor boundaries and publication contracts remain enforced.

**Outcome:** UXR-1 locally accepted; UXR-2–11 and ADM-9 release gates remain open. Repository/context links and whitespace are validated separately below. Suggested commit: `fix(web): protect unsaved settings and content edits`. No staging, commit, merge or push.

**Documentation validation:** `python3 .context/scripts/validate.py` passed (48 Markdown documents / 359 local links / 95 source entries); all new UXR-1 evidence anchors were checked and `git diff --check` passed. Final diff preserves pre-existing ADM-9/audit/planning work and contains no API/schema/dependency changes from UXR-1.

## UXR-2 implementation and evidence (2026-10-22)

**Goal:** show readable exact currency totals. **Architecture:** one pure localized report formatter using string splitting/BigInt and Intl parts; USD/BDT two-digit policy and labelled raw fallback. Reuse it in all three report amount locations; leave report data and exports untouched. The user selected this next bounded batch after UXR-1. Existing spec/plan and human-managed Git rules apply; no new approval gate or Git mutation, isolated temporary production build.

- [x] Add exact-value/locale/boundary formatter tests and rendered report assertions; observe baseline failures.
- [x] Implement formatter and primary amount labels/rendering; preserve report meaning/export values.
- [x] Review, test, visually inspect, re-review and record evidence; update UXR-2 status only.

Review focus: amounts beyond safe integers; Bangla fractional zeroes/grouping; unknown codes without an exponent; 30-digit amounts wrapping on phones; raw exports and current-estimate/cohort meaning. Acceptance uses the existing platform boundary and production-browser harness, not live financial writes.

### UXR-2 verification record

**Observed behavior, 2026-10-22:** local UXR-2 candidate, preserving existing UXR-1/ADM-9/audit/planning work. Node 22.22.1, pnpm 10.18.3, Next 14.2.35 and Chrome 154.0.8037.97. Actual production Next/BFF with synthetic identities and controlled HTTP upstreams; no live financial/provider/database mutations.

| Verification | Actual result and boundary |
| --- | --- |
| Before implementation | Two formatter tests failed because the new formatter did not exist (`unit-red.log`); production-browser regression on the prior UXR-1 build failed because localized `USD ১২,৩৪৫.৬৭` was absent (`browser-red.log`). |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs` | **11 tests passed**, including exact USD/BDT examples, zero, one minor unit, fractional/trailing zeroes, leading zeroes, values beyond Number safety and 30-digit contract maximum in both locales; unsupported denominations remain labelled raw units, malformed values fail. An initial manually transcribed Bangla maximum-value expectation omitted one two-digit group; corrected against the 28-digit whole-part grouping. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs` | **38 tests passed, no skips** (`regression.log`); includes the focused 11 tests above and existing role/navigation/style boundaries. |
| `pnpm --filter @vetralink/web check:styles` | Passed (`styles.log`). |
| `NODE_ENV=production API_BASE_URL=http://127.0.0.1:3411/api/v1 pnpm --dir /tmp/vet-uxr2-1h41omul/web build` | Passed production compilation, type checking and styling (`build.log`). Credential-free isolated source copy links existing dependencies; scratch-only Next config limits build CPUs to two. Checkout build/development output is preserved. Existing optional sharp/cache warnings remain nonfatal. |
| `WORKSPACE_BROWSER_FOCUS=platform WEB_TEST_BUILD_DIR=/tmp/vet-uxr2-1h41omul/web pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **267 checks passed** (`browser-platform.log`), both administrative roles, bn/en, 320/1440px. Exact MRR/order/month amounts, zero/one/max/unknown-code fixtures, currency/status separation, raw JSON amounts unchanged, overflow checks and existing settings/diagnostic/export/failure/security cases. |
| Same browser command with `WORKSPACE_BROWSER_FOCUS=unsaved` | **239 checks passed** (`browser-unsaved.log`); UXR-1 exit protection/curriculum/recovery remains intact. |
| Visual review | Inspected actual full-page ADMIN Bangla 320px and SUPER_ADMIN English 1440px reports from `/tmp/khamar-workspace-qa-ssmQPQ`. USD 12,345.67 is primary; localized zero/one and large exact totals remain visible; the 30-digit total wraps within the narrow card. Current-estimate/cohort/provider qualifications and export minor-unit explanation remain visible. Eight report captures retained there. |

**Review:** fresh-context read-only code review found no material scoped issue and independently ran the 11 focused tests. Final self-review checked all three amount locations, BigInt/string-only conversion, cached locale formatters, bounded inputs, unknown-code labelling, Tailwind wrapping, unchanged counts/data/export serialization and preservation of unrelated local work. No unresolved material scoped finding remains.

**Outcome:** UXR-2 is locally accepted. Only USD/BDT have the documented two-digit conversion policy; other codes intentionally keep their explicit raw-unit representation. Tests are controlled local Chrome evidence, not alternate-browser/device, live provider or deployed acceptance. Logs and scratch builds are under `/tmp/vet-uxr2-1h41omul` and may expire. UXR-3–11 and ADM-9 release gates remain open. Suggested commit: `fix(web): display exact report currency amounts`; no Git staging, commit, merge, push or deployment.

**Documentation validation:** `python3 .context/scripts/validate.py` passed (48 Markdown documents / 361 local links / 95 source entries). New UXR-2 evidence links/anchors and `git diff --check` passed.

## UXR-3 implementation and evidence (2026-10-22)

**Goal:** identify and recover from report-date errors without losing applied results. **Architecture:** pure form validator reuses shared query schema and its field schemas, maps relation errors and mirrors the existing selected-timezone future-end rule. Reports owns field issues and unapplied-state notice; reuse Field for linked inline errors. No shared/API/schema/dependency changes. User's “go next” selects this bounded UXR-3 batch; preserve prior work and human-managed Git. Build only in a credential-free temporary copy.

- [x] Write validator and production-browser regressions; observe baseline failures.
- [x] Add date-only localized messages, field associations/focus and unapplied notice; preserve applied queries/exports.
- [x] Review, run relevant tests/build/browser/style checks, inspect rendered errors and re-review; record evidence and UXR-3 status.

Review focus: simultaneous missing fields, relation errors masking invalid calendars, UTC versus Dhaka midnight/tomorrow, clearing stale errors during correction, preventing invalid requests or exports from replacing applied data.

### UXR-3 verification record

**Observed behavior, 2026-10-22:** local UXR-3 candidate retaining existing ADM-9/audit/planning and UXR-1/2 changes. Node 22.22.1, pnpm 10.18.3, Next 14.2.35, Chrome 154.0.8037.97; production Next/BFF/components with synthetic identities and controlled HTTP upstreams. No API/schema/dependency, live database/provider, Git or deployment changes.

| Verification | Actual result and boundary |
| --- | --- |
| Before implementation | Two date-helper tests failed because the helper was absent (`unit-red.log`). Production browser on the prior UXR-2 build failed the reproduced reversed-range case: the end control had no `aria-invalid` (`browser-red.log`). |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs` | **13 tests passed** (`unit-green.log`). Date tests cover missing fields, invalid calendars/minimum year, unsupported timezone, reversed/equal ranges, 367-day rejection and exact 366-day leap range, Dhaka midnight transition and differing UTC/Dhaka tomorrow limits. Existing currency/BFF/export/security tests remain included. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-admin-platform.mjs scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs` | **40 tests passed, no skips** (`regression.log`), including the focused 13 above. |
| `pnpm --filter @vetralink/web check:styles` | Passed (`styles.log`). |
| `NODE_ENV=production API_BASE_URL=http://127.0.0.1:3411/api/v1 pnpm --dir /tmp/vet-uxr3-y8jcmcrc/web build` | Passed styles, production compilation and type checks (`build.log`); credential-free temporary copy links existing dependencies and uses a scratch-only two-CPU build config. Checkout build/development output preserved. |
| `WORKSPACE_BROWSER_FOCUS=platform WEB_TEST_BUILD_DIR=/tmp/vet-uxr3-y8jcmcrc/web pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **627 checks passed** (`browser-platform.log`), both admin roles, bn/en at 320/1440px. Reversed/equal/over-limit/future/missing dates have precise associated errors and first-field focus; invalid submissions make no report read and retain the exact prior report; unapplied notices and disabled exports remain. Correction clears errors; actual Enter applies Dhaka half-open instants once; UTC selection restores for existing export/currency/security tests. |
| Same browser command with `WORKSPACE_BROWSER_FOCUS=unsaved` | **239 checks passed** (`browser-unsaved.log`), preserving prior settings/content/curriculum exit protection. |
| Visual review | Inspected actual ADMIN Bangla 320px and SUPER_ADMIN English 1440px invalid-date viewport captures under `/tmp/khamar-workspace-qa-cix7mY`: readable translated summary/inline messages, invalid control boundaries, wrapped layouts and desktop unapplied notice. Eight role/locale/width error captures plus full-page reports retained there. Native date widget formatting remains browser controlled. |

**Review and re-review:** fresh-context read-only review found no material scoped issue and independently ran the 13 focused tests. Final self-review confirmed reuse of shared field/calendar rules, invalid-field precedence, selected-timezone future bounds matching API, no report request on rejected edits, date-only validation copy, field associations/focus, correction lifecycle and unchanged export/actor/currency behavior. Server validation remains authoritative; transient upstream failures retain existing report-loading/retry behavior. No unresolved material scoped finding remains.

**Outcome:** UXR-3 locally accepted. Raw browser/log artifacts are under `/tmp/vet-uxr3-y8jcmcrc` and the screenshot directories above; temporary files may expire. Controlled Chrome checks do not establish screen-reader, alternate-engine/device or deployed acceptance. UXR-4–11 and ADM-9 release gates remain open. Next proposed work is UXR-4 account-recovery contract preparation. Suggested commit: `fix(web): explain report date validation errors`; no staging, commit, merge, push or deployment.

**Documentation validation:** `python3 .context/scripts/validate.py` passed (48 Markdown documents / 363 local links / 95 source entries). New UXR-3 evidence links/anchors and `git diff --check` passed.
