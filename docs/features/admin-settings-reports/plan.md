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
