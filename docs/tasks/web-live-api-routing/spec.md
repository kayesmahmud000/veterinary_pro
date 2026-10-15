# Route web requests to the live API

Status: URL routing verified locally; authorized live course database repair verified
Date: 2026-10-15. Baseline: a21a451 with the earlier Prisma startup fix and a user edit to the web environment example.

The user selected `https://veterinary-api-mocha.vercel.app/` as the live backend and requested that web calls reach it instead of a local API. Auth, workspace, public courses and protected-page identity checks must use `https://veterinary-api-mocha.vercel.app/api/v1` by default. Keep an explicit server-only `API_BASE_URL` override for other environments and isolated test servers.

**Confirmed from code:** all four server request paths default to localhost. `apps/web/.env.example` is an example rather than an active Next environment file, and its current user edit also omits `/v1`. No active web `.env.local` exists. Turbo's strict environment allowlist omits `API_BASE_URL`.

Set the four existing defaults to the selected live API, correct the example, create the local web environment file and pass `API_BASE_URL` through Turbo. Preserve the same-origin browser BFF: browser requests to local `/api/auth`, `/api/workspace` and `/api/courses` are expected while the web server forwards to the live API. Keep credential handling, validated fixed paths, timeouts, cache policy and explicit overrides unchanged. No new routing abstraction, dependencies, schema or deployment is needed.

Acceptance: existing auth/workspace/protected-route/course boundary checks pass; web type/style checks pass; direct live health and authentication checks demonstrate connectivity; verify each default request destination and Turbo environment propagation. Report live application/database errors separately from URL routing. No live account writes, migrations or deployments are included.

## Authorized course database repair - 2026-10-15

After the missing-column diagnosis and the exact pending migration command were explained, the user requested that all necessary repair work be completed. This extends scope to backing up the configured live database, rehearsing recovery and applying the three committed API migrations with `db:deploy`. Preserve existing data and applied migration history; do not reset the database, publish source changes or alter real accounts/content for verification.

Acceptance: a restricted backup can be restored to a disposable database; all three pending migrations apply there and then to the configured live database; no failed/pending migrations remain; public course requests return HTTP 200 and the former public/admin Prisma query projections succeed. Record actual checks and remaining authentication/browser verification limits.
