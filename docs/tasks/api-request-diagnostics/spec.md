# API request diagnostics

Date: 2026-10-09. Scope: diagnose failing web login and show every API response outcome in the appropriate server terminal.

Observed behavior: running local web login returned 503 `unavailable`; local API port 3001 refused connections. The backend configured in root `.env` returned 404 at `/auth/login` and 400 validation at `/api/v1/auth/login`. Root `.env` is backend configuration; Next needs its own server-only `API_BASE_URL` with `/api/v1` in `apps/web/.env.local`.

Required behavior: log method, endpoint, HTTP status, duration and safe trace/error identifiers for every web API response, every upstream auth/workspace fetch and every Nest HTTP response (including validation/guard failures). Network failures must identify safe connection codes without masking the original failure. Logs use info/warn/error severity, are on by default in development, off in production unless `API_DEBUG=1`, and can be disabled with `API_DEBUG=0`.

Do not log request/response bodies, credentials, cookies, authorization headers, personal/clinical/farm records or query values. Strip URL credentials/query/fragment and mask UUID and legacy DRM-token path parameters. Existing HTTP responses, auth/session/tenant rules, timeouts and retry behavior remain unchanged. Backend response logging covers both main and serverless bootstraps. Correct only the local web backend configuration; no deployment, migration or account/password changes.

Acceptance: safe logging tests cover success, HTTP failure, transport failure, production/explicit disablement and unchanged response/error behavior; existing auth/workspace/farm suites and API transport tests pass; affected TypeScript/build checks pass. Repeat synthetic live login and report the actual status. Real account login remains unverified without the user's credentials; never ask for passwords in chat.
