# Optional Redis for development and hosted testing

User selected development memory mode on 2026-10-29 and explicitly requested that Vercel testing deployments also run without Redis. PostgreSQL business data and Cloudinary artwork must keep working while Upstash is disconnected.

## Required behavior

- Add explicit `REDIS_ENABLED=false` configuration, parsed strictly. Default remains true for compatibility. An explicit false is supported even with `NODE_ENV=production` on Vercel because this project is currently being tested there. Do not automatically downgrade on Redis errors; later setting true restores normal Redis behavior.
- In memory mode, instantiate no network Redis/BullMQ queue clients or workers in HTTP/serverless or the separate role-notification worker. Do not consume Upstash commands, dispatch outbox work, or register repeatable jobs. Normal PostgreSQL/auth/course/Cloudinary paths remain available.
- Keep workflow rate limiting active using bounded process-local counters with the same scope/user/window/limit behavior. Preserve 429 behavior, window expiration, concurrent calls and the Redis-mode failure behavior.
- Select the existing memory idempotency store without constructing a Redis store. Ensure concurrent claims for the same key cannot both succeed. Memory state is per process and resets on restart/serverless instance replacement; it is deliberately not durable/distributed.
- Queue-dependent operations return an explicit disabled/unavailable error, never a fabricated accepted job or delivery. Do not claim email/reminders/import/transcode/watermark jobs succeeded. Startup queue registration and dispatcher loops must skip cleanly.
- Health/readiness skip the deliberately disabled Redis dependency and identify the selected runtime mode. Administrative platform probes report Redis/queues unavailable without contacting them. Database checks continue to run.
- Preserve default Redis-mode authentication, business persistence, queues, APIs and clients. Do not remove credentials or rewrite unrelated local changes. No dependency additions, migrations, deployments, Git staging/commit/push or billing changes.
- Document both-PC/Vercel configuration, ephemeral state and disabled background features, and how to enable Redis later. Set false in the local API env only after tests pass; preserve its existing Redis URL and provider/auth/database values.

## Acceptance

Focused config/rate-limit/idempotency/queue/health/platform tests, actual Nest DI initialization with Redis construction blocked, complete API regression/build and serverless-wrapper checks. Verify local runtime mode/health with no Redis sockets after restart. Verify thumbnail's real storage path separately from synthetic auth/HTTP fixtures; do not mutate live courses or forge a user session. Report any real authenticated-upload limitation.
