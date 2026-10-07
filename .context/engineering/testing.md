# Validation and command reference

Adopt [Senior QA/Test Engineer and Code Reviewer](../roles/quality.md) perspectives for validation. Derive edge/regression cases from affected callers and risks; use the [mandatory self-review cycle](../workflows/self-review.md) and [evidence labels](evidence.md). Passing checks establish only the behavior and environment they actually cover.

Commands are from repository root unless a working directory is shown. Inspect package scripts before running them: a script name alone is not proof of working tooling. Use the pinned pnpm version. No install/build/test was needed to author the initial documentation snapshot.

## Setup and build

```sh
pnpm install --frozen-lockfile
pnpm --filter @vetralink/api db:generate
pnpm --filter @vetralink/shared-types build
pnpm --filter @vetralink/api build
pnpm --filter @vetralink/web build
```

Install runs lifecycle scripts, including Prisma generation. Runtime tests need appropriate non-production configuration; never point tests at live data. Shared types export built files from `dist`, so build them before focused API tests. Root `pnpm build` uses Turbo dependency ordering. Root `pnpm dev` starts workspace dev tasks; mobile is a separate Flutter workflow.

## Checks by change

| Change | Relevant verification |
| --- | --- |
| API logic | `pnpm --filter @vetralink/api test --runInBand --testPathPattern=modules/animals` (replace path with affected area), then related suites |
| Cross-cutting auth/guards/envelopes | Focused negative-case suites, `pnpm --filter @vetralink/api test --runInBand`, API build |
| Shared contracts | Shared-types build, API/web builds, affected serialization and Flutter tests |
| Prisma schema | `pnpm --filter @vetralink/api exec prisma validate`, generate/build, repository and migration tests against disposable PostgreSQL |
| Web | `pnpm --filter @vetralink/web build`, browser interaction/responsive/accessibility checks in Bangla and English; `pnpm --filter @vetralink/web test:localization` against a local production server on port 3100 |
| Flutter | From `apps/mobile`: `flutter pub get`, `flutter analyze`, `flutter test`; device smoke tests for changed flows |
| Infrastructure | `docker compose --env-file infrastructure/.env.docker -f infrastructure/docker-compose.yml config --quiet` after local env setup; targeted runtime smoke tests |
| Context/docs only | `python3 .context/scripts/validate.py`, `git diff --check`, manual source/claim review |

Do not use `--passWithNoTests` to claim validation. Add a regression test that fails under the old behavior for significant bug fixes. Tests should assert behavior, not reproduce implementation details. Cover success and meaningful failure/edge cases for changed services/controllers, especially authorization, atomicity and retry semantics.

## Actual tooling limits

API Jest configuration is embedded in `apps/api/package.json`: `rootDir: src`, `.*\.spec\.ts$`, ts-jest and Node environment. Existing `*.int.spec.ts` files also match. Supertest suites such as `animals.int.spec.ts` mock services and security dependencies; these are HTTP-boundary tests, not proof of real PostgreSQL/Redis integration. Inspect fixtures and module overrides before assuming infrastructure requirements.

`test:cov` exists, but no 80% `coverageThreshold` is configured in this baseline. The historical 80% goal is a requirement to establish, not an enforced gate. API CI generates Prisma/builds shared types/API; it does not execute Jest. Web CI builds only. Mobile CI runs tests and attempts APK build; missing platform scaffolding needs reconciliation.

API `test:e2e` references absent `apps/api/test/jest-e2e.json`. API lint invokes ESLint without a local ESLint configuration/direct dependency; web uses `next lint` without a checked-in ESLint setup. Report these as tooling gaps, not successful checks. There is no web test script or browser test harness at baseline.

Load scripts in `infrastructure/load-testing/` cover auth, ERP, tele-vet and sync. Read their environment inputs, fixtures and thresholds before running. Use an authorized isolated target and synthetic data; retain actual k6 outputs and host/data/concurrency details. Staged scripts and thresholds are not measured performance results.

## Completion evidence

Added 2026-10-06: the web `test:localization` smoke script verifies the existing public routes against a local production server (default `http://localhost:3100`), including default/invalid locale, metadata, native selection forms, cookie persistence, visitor isolation and return-URL validation. Pass a different local origin as a script argument when needed. Run with `NODE_ENV=production` for production build/start. Avoid building into the same `.next` directory while a dev server uses it; use an isolated temporary copy for runtime verification. This script does not replace rendered browser, cross-browser or application integration checks.

Added 2026-10-07: `pnpm --filter @vetralink/web test:planner` uses Node's test runner and the existing TypeScript compiler to test the real local milk-estimate utility without a server or generated files. It covers Bangla/ASCII decimals, malformed/bounded inputs, zero and 7/30-day calculations. Browser checks still verify selection, validation feedback, projections and locale-aware presentation.

Extended 2026-10-07: `test:localization` also covers the three public learning guides, unknown-guide 404, valid/invalid/repeated topic queries and localized CSV downloads (UTF-8 BOM, empty rows, safe attachment names, private caching and missing-template 404). The [product showcase plan](../../docs/tasks/web-product-showcase/plan.md) records rendered URL/history, keyboard, responsive and actual-download evidence.

Added 2026-10-07: `pnpm --filter @vetralink/web test:auth` tests the real web auth boundary with controlled upstream responses. `test:auth:browser` requires Node 22+ and Chrome (optional `CHROME_PATH` override); it launches temporary production web/mock-auth servers on 3210/3211 and headless CDP on 9333, then verifies bilingual modals, cookies, failures/retry, actual concurrent tab refresh/logout and public localization regressions. Build the web first; keep these ports free. It uses synthetic users and never connects to the configured live API/database. See the [auth evidence plan](../../docs/tasks/web-auth-modals/plan.md) for outcomes and live acceptance limits.

Record exact commands, working directory, result, applicable environment and skipped/blocked checks. A build proves compilation only. Changes to migrations, money, cross-tenant access, offline conflict resolution or clinical persistence need stronger evidence than mocks. Do not repair unrelated tooling as a hidden addition to an otherwise scoped task.

Added 2026-10-07 role workflows: shared/API/web builds, full API regression, opt-in common/security/role-workflow.database.spec.ts against explicitly isolated PostgreSQL/Redis, and role-notifications.spec.ts recovery/privacy checks. Web test:workspace covers Zod/BFF origin/method/query/tenant/private projections and nested errorDetails codes; test:workspace:browser runs production Next + Chrome against the isolated real API and mock mail worker. It requires ROLE_TEST_DATABASE_URL and fixed local ports; [runbook](../../docs/features/role-request-approval/operations.md) records setup, counts and unverified production/provider/alternate-browser limits.
