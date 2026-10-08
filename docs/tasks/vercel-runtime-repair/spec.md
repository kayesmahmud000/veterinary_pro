# Vercel runtime and database repair specification

Status: Locally verified; configured database updated; Vercel rollout pending account access
Date: 2026-10-08. Backend target: `dev-backend` / `1dce99b`. Working checkout: `dev-fontend`.

## Outcome and scope

Prepare the existing backend and web deployments to communicate at
`https://veterinary-api-mocha.vercel.app` and
`https://veterinary-pro-web.vercel.app`. Fix serverless artifact discovery,
build shared contracts before API compilation, and supply accurate public
deployment configuration. Repair the missing consultation database structures
with a new reviewed migration; preserve existing records and migration history.

Backend `API_BASE_URL` is the bare API origin because mail appends `/api/v1`;
web `API_BASE_URL` includes `/api/v1` because its server boundary appends routes.

The user authorized the deployment repair and database updates. Git staging,
commits, merges and pushes remain human-managed. Do not create an administrator
or select a paid worker host/mail provider on the user's behalf. Vercel changes
require a connected account; prepare a reviewable result while it is unavailable.

## Current implementation and evidence

- Confirmed from code: backend `tsconfig.build.json` sets `rootDir: src`,
  producing `dist/serverless.js`; `api/index.js` only discovers `dist/src/serverless.js`.
- Confirmed from code: `vercel-build` compiles API without first building
  `@vetralink/shared-types`. API and web runtime URLs are environment variables.
- Observed behavior: the configured remote database has all 23 existing API
  migrations, no failed migrations, and the latest role/onboarding schema.
  Prisma diff identifies missing consultation enums/tables/payment/scheduling
columns and two declared indexes. Existing named compound indexes have
  different physical names than Prisma defaults, and a useful farm/category
  index exists only in migration SQL.
- Observed behavior: an initial isolated populated rehearsal caught the old
  vet-profile migration's global constraint-name existence check. The new
  migration checks `conrelid` as well, repairing only a missing FK in the current
  schema while preserving already existing production constraints.
- Observed behavior: existing business tables have zero rows except three
  subscription plans; Redis responds PONG. Recheck before any write.
- Confirmed from documentation/code: role notification email requires the
  independent worker and a real mail provider. The Vercel HTTP entry does not
  start this worker. An active reviewer account is also required for approvals.
- Unknown: current Vercel env values/build settings and the live deployed revision.

## Design and compatibility

Use one candidate-path helper for diagnostics and ordinary request discovery,
preferring flat output while retaining legacy nested output. Keep other wrapper
behavior in scope unchanged. Add a Vercel build command that builds the shared
package before the API. Provide environment templates with the exact domains.

Preserve existing physical compound-index names using Prisma `map`, retaining
their existing client `name`. Declare the existing farm/category index. Add only
the missing schema structures in a transaction with bounded lock/statement
waits. Do not use reset/db push, drop tables/data/indexes, or rewrite old SQL.
The latest role feature already on dev-backend must remain intact.

## Acceptance and rollout

1. Disk-based Node regression tests prove flat output loads, stale nested output
   does not take precedence, legacy output remains supported, and diagnostics
   discovers the same artifact. Test must fail on the original wrapper first.
2. Build and focused API checks run on an isolated temporary archive of the exact
   backend revision plus this repair, avoiding accidental compilation of the
   older frontend branch API.
3. Rehearse the complete API migration lineage in an explicitly isolated schema,
   then compare it to the backend schema and exercise representative legacy
   role/data behavior before authorized deployment.
4. Save restricted data/catalog snapshots, apply the new migration to the .env
   database, and verify migration history, data preservation and schema diff.
5. Verify reachable live frontend/backend health. Report account-access limits,
   unexecuted deployment and worker/provider setup separately from local checks.

Recovery favors roll-forward. New migration is transactional; do not drop
new clinical/payment/history structures after applications start using them.

Related: [original deployment spec](../vercel-backend-deployment/spec.md),
[role operations](../../features/role-request-approval/operations.md).
