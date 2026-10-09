# Configuration, runtime and deployment

Apply [Senior Production/Incident or Production/Release Engineer](../roles/debugging-production.md) as appropriate, with Tech Lead, Security and QA for affected release boundaries. Use [Performance Engineer](../roles/performance.md) for measured resource/latency problems and [evidence labels](../engineering/evidence.md) for runtime claims.

## Configuration sources

`apps/api/src/config/env.schema.ts` (`EnvSchema`, `validateEnv`) and `env.service.ts` define typed configuration. Use `.env.example` / `.env.vercel.example` for names, never real secret values in documentation. Some code reads `process.env` directly; audit consumers when changing configuration.

| Group | Names to inspect |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_REPLICA_URL`, `REDIS_URL`, `CORS_ORIGINS` |
| Auth/PII | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `AES_PII_ENCRYPTION_KEY`, `HASH_PEPPER` |
| Storage | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_MEDIA`, `S3_BUCKET_DELIVERIES`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` |
| Payments/media | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MFS_WEBHOOK_SECRET`, `HLS_DRM_KEY_SECRET`, `DRM_TOKEN_EXPIRATION_SECONDS` |
| Delivery/video | `CLOUDFRONT_DISTRIBUTION_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY`, `CLOUDFRONT_URL_EXPIRATION_SECONDS`, `DAILY_API_KEY` |
| Mail | `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `AWS_SES_REGION`, `API_BASE_URL` |
| Database diagnostics | `SLOW_QUERY_THRESHOLD_MS`, `DB_CONNECT_RETRY_DELAY_MS` |
| Outside schema | `RSA_PRIVATE_KEY`, `RSA_PUBLIC_KEY` in `PkiCryptoService`; `STRICT_PROD_INTEGRATIONS` / Vercel variables affect validation |

The schema has development secret defaults and does not reject all such defaults in production. Its Vercel early return bypasses additional integration checks unless `STRICT_PROD_INTEGRATIONS` is truthy. `S3_FORCE_PATH_STYLE` uses boolean coercion; verify actual string parsing before relying on values like `"false"`. Production requires explicit independent secret provisioning and verification, not just successful schema parsing. `turbo.json` lists only a subset of integration environment variables; assess cache/env behavior for any new build-time variable.

## Local development

`infrastructure/docker-compose.yml` runs PostgreSQL 16, Redis 7 (password/AOF), MinIO; it does not start the API/web/workers. Default ports are 5432, 6379, 9000/9001. Use the existing `docs/guides/docker-guide.md` with the actual Compose file, checking for drift.

If a local env file does not exist, create one from `infrastructure/.env.docker.example` without overwriting existing credentials. Then:

```sh
docker compose --env-file infrastructure/.env.docker -f infrastructure/docker-compose.yml up -d
pnpm --filter @vetralink/api dev
# In another terminal:
pnpm --filter @vetralink/web dev
```

API defaults to 3001, web to 3000. Configure the API's own environment separately to reach the backing services; Compose's env file is not automatically API configuration. Provision the intended MinIO buckets and any required provider tools. FFmpeg-based processing needs the executable in its runtime; a JavaScript dependency/build does not supply it. Avoid `down -v`, reset commands and root `clean` as routine troubleshooting.

Next reads its server-only `API_BASE_URL` from web configuration such as `apps/web/.env.local`; root API configuration is not automatically loaded. Include `/api/v1` in that web upstream URL. Web auth/workspace routes and upstream calls emit `[api-response]` diagnostics; Nest main/serverless HTTP completion emits `[ApiResponse]`. Logs include status, timing and safe identifiers, exclude bodies/query values/credentials, and mask UUID and DRM-token path segments. Development logging defaults on; `API_DEBUG=0` disables it and production requires `API_DEBUG=1`. Web logs appear in the web process terminal; deployed API logs require the deployed logger version and hosting logs. See [diagnostic evidence](../../docs/tasks/api-request-diagnostics/plan.md).

## Entry points and deployment evidence

Persistent Node: `src/main.ts` enables shutdown hooks, listens on a port, installs Helmet/CORS/validation/envelopes/Swagger. `start:prod` says `node dist/main`; verify emitted build layout before treating that command as a validated release launcher.

Serverless: `api/index.js` prefers compiled `dist/serverless.js` and supports legacy `dist/src/serverless.js`; `src/serverless.ts` caches an Express/Nest handler. The production `tsconfig.build.json` excludes specs/scripts, and `nest-cli.json` cleans generated output before compilation. [Role build repair evidence](../../docs/tasks/vercel-role-build-compatibility/plan.md) verifies flat output without stale nested/spec artifacts. `vercel.json` rewrites requests and sets a 30-second function limit. The wrapper serves landing/ping/diagnostics outside Nest; these responses do not prove database readiness. Serverless CORS reflects origins if unset, CSP is relaxed for Swagger, and bootstrap errors can return HTTP 200 with stack information. Review [known gaps](../known-gaps.md) before public exposure.

Do not assume a serverless HTTP handler provides a durable worker scheduler or long-lived Socket.IO runtime. Specify and verify a compatible hosting arrangement for BullMQ processors, repeatable jobs, FFmpeg and consultation chat. The repository contains no application Dockerfiles, worker deployment manifests, reverse-proxy/WAF config or production backup automation at baseline. Those are planned topology in historical architecture docs.

## Release expectations

Use [release review](../workflows/release-review.md). Require identified release revision, runtime/build paths, secure config, migrated schema, compatible worker/realtime hosting, smoke/negative tests, provider delivery evidence and rollback/restore plan. Prisma `db:deploy` applies migrations; never use `db:migrate`/reset against production.

Probe `health`, `health/liveness`, `health/readiness` under `/api/v1`; inspect their controller/indicator behavior. Test actual authenticated and tenant-scoped flows too. Monitor latency/errors, DB connection pressure, queue backlog/retries, webhook duplicate/failure rates and sync conflicts. Correlate trace IDs and job IDs without logging tokens, PII, medical payloads or signed URLs. No monitoring backend or alerting SLA is established merely by Nest logs or these requirements.
