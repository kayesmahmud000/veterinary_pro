# API request diagnostics plan

Spec: [spec.md](spec.md). Roles: Backend/Web, Security, Code Reviewer + QA.

1. Inspect auth/web/API transport and reproduce connection/path failures with synthetic unauthenticated requests. Preserve existing protected-modal edits.
2. Add failing tests for web diagnostic wrappers and Nest completion logging, including secret exclusion and unchanged results.
3. Add web upstream/final-response diagnostics; register Nest completion middleware in both bootstraps and record safe error codes from the exception filter.
4. Configure the local Next backend URL from the already configured remote API, including `/api/v1`; preserve any existing local configuration.
5. Run focused and neighboring tests, TypeScript/build checks, and a synthetic request against the running web. Self-review logging scope, sensitive data and production opt-in; record exact evidence below.

## Evidence and self-review — 2026-10-09

- **Runtime observed:** local port 3001 refused connections; remote `/auth/login` returned 404, whereas `/api/v1/auth/login` returned 400 validation for an empty synthetic payload. Running local web login initially returned 503 `unavailable`. After correcting the ignored `apps/web/.env.local` server-only URL and enabling `API_DEBUG=1`, a fresh random nonexistent `example.test` account returned 401 `invalid_credentials`. This proves web-to-backend connectivity; no real account/password was used or changed.
- **Regression tests:** new web diagnostics and Nest middleware tests first failed with missing implementations. Success/401/500 severity, transport failures, unchanged response/error identity, secret exclusion and disabled/production behavior now pass. Review identified legacy DRM playback tokens in path parameters; added regressions failed before the redaction fix and pass afterward.
- **Commands passed from repository root:** `pnpm --filter @vetralink/web test:api-diagnostics`; `API_DEBUG=0 pnpm --filter @vetralink/web test:auth`; `API_DEBUG=0 pnpm --filter @vetralink/web test:workspace`; `API_DEBUG=0 pnpm --filter @vetralink/web test:farm-overview`; `pnpm --filter @vetralink/web check:styles`.
- **API tests passed:** `pnpm --filter @vetralink/api exec jest --runInBand --runTestsByPath src/common/middleware/api-response-logger.spec.ts src/common/filters/global-exception.filter.spec.ts src/common/interceptors/response.interceptor.spec.ts src/modules/auth/auth.controller.spec.ts src/modules/auth/services/auth.service.spec.ts` passed 5 suites / 51 tests before the additional production/path regressions. Final focused middleware/filter/interceptor run passed 3 suites / 18 tests. Existing fatal-error fixture logging and ts-jest `.js` warnings are test output, not runtime incident evidence.
- **Compilation passed:** API `tsc --project tsconfig.build.json --noEmit`, web `tsc --noEmit --incremental false`, and `pnpm --filter @vetralink/api build`. From `apps/web`, `pnpm exec next build /tmp/web-api-diagnostics-vz36yn3g` passed production compilation/type/static generation using an isolated copy and shared installed dependencies, preserving the active development `.next` directory.
- **Documentation checks passed:** `python3 .context/scripts/validate.py` and `git diff --check`. Re-review confirmed both current web API route families and all upstream auth/workspace fetches are covered; both Nest bootstraps register the middleware. Responses, timeouts, session/tenant handling and existing protected-modal changes are preserved. Bodies, headers, query values and raw exceptions are excluded from new diagnostics.

## Handoff and limits

Web logs appear as `[api-response]` in its server terminal; API logs appear as `[ApiResponse]` in the API process/hosting logs. Development defaults on, `API_DEBUG=0` disables diagnostics, and production requires `API_DEBUG=1`. Root API environment does not configure Next; the corrected web URL lives in ignored local configuration and must be provisioned separately elsewhere.

Real-account login and deployed API logging remain unverified. No deployment, database migration, enrollment work or Git commit was performed. Suggested commit: `fix(auth): configure backend and add API response diagnostics`.
