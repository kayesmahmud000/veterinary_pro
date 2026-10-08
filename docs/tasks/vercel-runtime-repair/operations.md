# Deploy the repaired backend and web configuration

Local verification is separate from deployment. This task targets backend
commit `1dce99b` and preserves the newer role/onboarding code on `dev-backend`.
The working checkout is `dev-fontend`; the exact branch-targeted patch is
prepared at `/tmp/vetralink-backend-vercel-repair.patch` for human integration.

## Vercel API project: veterinary-api

Use `apps/api` as Root Directory and the repaired `dev-backend` revision.
The checked-in `vercel.json` builds shared types before API compilation;
ensure the monorepo shared package is included in the build.
Keep all existing database/Redis/JWT/PII secrets. Import only
[api-public.env.example](api-public.env.example) into Production and Preview.
It sets NODE_ENV, CORS_ORIGINS, WEB_BASE_URL and the bare-origin API_BASE_URL.
Local `.env` values do not update the Vercel dashboard.

The new schema repair migration has been rehearsed with synthetic populated
data. See [plan.md](plan.md) for its actual configured-database deployment
status. Do not run `migrate dev`, reset, db push or reapply old migration SQL.

Redeploy the repaired source. Check `/api/v1/health` has a successful body
with database and Redis up, then verify `/api/docs` and login/registration.
The wrapper's landing/ping and HTTP status alone are insufficient: existing
bootstrap failures can be returned as HTTP 200 with success false.

## Vercel web project

Import [apps/web/.env.vercel.example](../../../apps/web/.env.vercel.example)
into the web project's Production and Preview settings:
`API_BASE_URL=https://veterinary-api-mocha.vercel.app/api/v1`.
Redeploy after changing the environment. Check browser registration/login,
session refresh, FARMER onboarding and role-request navigation against the
repaired backend. The backend API_BASE_URL has no `/api/v1`; the web variable
does. These applications consume the variable differently.

## Role notification email and reviewers

The HTTP deployment does not start `role-notifications.worker.js`. For real
mail, configure either Resend or SES, a verified sender, and the required
provider credentials on a persistent worker host. Use the same DATABASE_URL,
REDIS_URL and WEB_BASE_URL. Worker startup after the latest backend build:

```sh
pnpm --filter @vetralink/api worker:role-notifications
```

Default EMAIL_PROVIDER=mock is suitable for controlled testing and does not
deliver real email. No paid provider or worker host has been chosen or created.
The database initially has no users, so approval requires an authorized first
reviewer account. Do not promote an arbitrary account. Follow the existing
[offline bootstrap runbook](../../features/role-request-approval/operations.md)
with the operator's chosen existing account.

## Access and recovery limits

Vercel account connection is required to change dashboard settings or deploy
directly. No live settings/deployment change is claimed until tool evidence
confirms it. Git staging/commit/merge/push remain human-managed under
[repository policy](../../../.context/agent-instructions.md).

The new migration is transactional with bounded lock/statement waits. Preserve
the restricted pre-repair snapshot and use roll-forward if a compatible
application has begun writing new consultation/payment/history records.
Existing public diagnostic/exception-stack disclosure remains an unrelated
release concern; this repair changes artifact discovery, not that contract.
