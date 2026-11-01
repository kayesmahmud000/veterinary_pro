# Redis-free development and Vercel testing

**Implementation status — 2026-10-30:** this guide describes the intended complete profile. Current source implements memory workflow limits and skips Redis health/platform probes when `REDIS_ENABLED=false`, but BullMQ registrations remain unconditional and the idempotency provider still selects Redis outside tests. The flag alone does **not** yet disable all Redis clients, workers or queues. Treat the queue/idempotency behavior described below as pending implementation; see [the hosted thumbnail investigation](../course-thumbnail-r2/plan.md#hosted-503-follow-up--2026-10-30). The thumbnail limiter can use the flag independently as a temporary testing mitigation.

This profile is for the project's current development/testing phase, including a Vercel runtime whose `NODE_ENV` is `production`. It is selected explicitly; Redis outages never activate it automatically.

## Local development and the second PC

In `apps/api/.env`, set:

```dotenv
REDIS_ENABLED=false
```

Preserve the existing `REDIS_URL` for later. Keep database/auth/Cloudinary configuration; they are independent services. Restart the API after changing the flag. The web continues to use its existing `API_BASE_URL` (for local development, usually `http://localhost:3001/api/v1`). The second PC needs the same source and flag in its API environment.

In this profile, workflow limits and request idempotency use the API process's memory. Course data remains in PostgreSQL and thumbnails use Cloudinary. Memory counters and replay records reset on restart and are not shared between PCs, API processes or Vercel instances.

Background queues and processors are disabled: queued email delivery, import processing, clinical reminders/escalations, subscription dunning, private-video transcoding/watermarking and the independent role-notification worker do not process work. Operations that require a queue report unavailable rather than pretending a job was accepted. Existing database outbox records are not deleted.

## Vercel testing deployment

On the **API project**, set `REDIS_ENABLED=false` for the deployment environments you use (Preview and/or Production). Deploy the updated backend source after setting it; setting `NODE_ENV=development` on Vercel is unnecessary. The web API origin still needs to point to that API. Cloudinary credentials remain on the API project; this switch does not replace PostgreSQL or Cloudinary configuration.

This repository change does not edit a hosted project's settings or deploy it. A previously deployed backend does not gain this flag's behavior until the updated source is deployed. Health/readiness identify memory mode and continue checking PostgreSQL while skipping the intentionally disabled Redis dependency; platform probes show Redis/queues unavailable.

## Enable Redis later

Set `REDIS_ENABLED=true`, configure a working `REDIS_URL`, and restart/redeploy the API and any worker process. Recheck Redis capacity, queue readiness and pending outbox/jobs before using background features. The disabled testing profile never writes its memory counters/idempotency data back to Redis; those ephemeral records do not survive the switch.

See [requirements](spec.md) and [implementation evidence](plan.md).
