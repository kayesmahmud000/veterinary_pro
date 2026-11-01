# YouTube Lesson Durations Implementation Plan — Simple API + Cache

> **For agentic workers:** Use the `executing-plans` skill to implement task by task. Follow Implement → Review → Test → Re-review → Finalize. Delegation requires separate authorization; Git staging, commits, merging and pushing remain human-managed.

**Goal:** Display real per-lesson duration with server-side YouTube lookup and a short-lived metadata cache.

**Architecture:** Enrich the existing public/own course-detail reads after access checks, keyed by their existing server-side video IDs. A singleton service bounds fetches and caches metadata in memory. Shared response validation and one bilingual UI component carry the result; unknown values are omitted from the display.

**Tech Stack:** Existing NestJS/TypeScript, native fetch, Zod, Next.js/React/Tailwind, Jest and Chrome CDP. No new application dependency or infrastructure.

**Spec:** [spec.md](spec.md). Revised 2026-10-30 after the user chose the simpler design. Status: planning complete; implementation not started. The earlier storage/migration/backfill/scheduler plan is superseded.

## Global constraints

- No Prisma/schema/migration, persisted duration fields, admin-save changes, backfill, scheduled workflow, new Redis dependency or hidden video players.
- Optional server-only `YOUTUBE_DATA_API_KEY`; all credential/provider failures preserve valid course reads and learning.
- Add only response-level `durationSeconds?: number | null`; never add it to admin input `lessonFields` or expose restricted source IDs.
- 10-minute metadata TTL; 60-second failure cache; 1000-entry LRU; max 100 IDs/request and chunks of 50.
- Max two active provider batches/instance, 30 batch starts/rolling minute/instance, 1.5-second fetch timeout, 2-second enrichment deadline, 1 MiB body limit, no retry, 10-minute quota/auth cooldown.
- No provider work in catalog/library/enrollment/playback/admin-save paths or database transactions. Preserve current visibility/session and BFF boundaries.
- Local protections do not guarantee a serverless fleet-wide quota. Backend API key restrictions and project quota/alerts are rollout prerequisites.
- Tailwind, existing locale behavior, human-managed Git and normal release authorization apply. This change updates planning documents only.

## Review focus

1. Provider/key/quota failure must not turn a course into an error page (Tasks 1–2).
2. Parallel/cold requests must respect local bounds; document the absence of distributed guarantees (Task 1).
3. Source changes, unpublished courses or user/session changes must not reuse cached access/outline state (Task 2).
4. Partial response, live/missing video or old API without a field must show truthful optional time (Tasks 1–3).
5. Long/hour/day durations and narrow translated titles must stay readable beside actions (Tasks 1, 3).

## Task 1: Bounded metadata service and optional configuration

**Create:** `apps/api/src/modules/courses/youtube-duration.service.ts`, `youtube-duration.service.spec.ts`.
**Modify:** `apps/api/src/config/env.schema.ts`, `env.service.ts`, their tests, `apps/api/.env.example`, `apps/api/.env.vercel.example`, root `turbo.json`.

**Interfaces produced:**

```ts
parseYouTubeDuration(value: string): number | null;
YouTubeDurationService.lookup(videoIds: readonly string[]):
  Promise<ReadonlyMap<string, number>>;
```

The map contains only known positive whole seconds. Internally the service owns TTL/LRU entries (number or unavailable), per-ID in-flight promises, concurrency/budget counters and a cooldown deadline. Provider failures are contained here; callers receive available values, not provider exceptions. Use native fetch and existing dependency injection; no new module/cache framework.

- [ ] Write failing parser cases: `PT12M35S → 755`, `PT1H2M3S → 3723`, `P1DT2H3M4S → 93784`; zero, negative, fractional, calendar month/year, invalid and overflow return null.
- [ ] Write controlled-fetch/clock tests for fixed host/headers/selected fields, ID validation/deduplication, 50-ID chunks, 100-ID cap, response ID validation, partial/unavailable/live results and 1 MiB cap. Assert credential never appears in URL/logs/errors.
- [ ] Add tests for missing key/no network; 10-minute expiration with no stale serving; 60-second failure suppression; 1000-entry LRU; overlapping requests coalesced by video ID; at most two active batches; the 31st start in a rolling minute skipped; quota/auth cooldown expires after 10 minutes.
- [ ] Test a hanging body, delayed fetch and an existing in-flight batch against the 1.5/2-second bounds; abort obsolete requests and release counters/promises in `finally`. A request that cannot start work within its deadline returns fresh hits without starting later/background fetches. Success in one chunk remains available if the other fails.
- [ ] Run the focused tests and observe red; implement the service with the exact bounds above. Optional trimmed key in EnvService/schema/examples and Turbo passthrough must not make startup require new credentials. Do not reuse the Redis workflow limiter for this optional feature.
- [ ] Run `pnpm --filter @vetralink/api test --runInBand --testPathPattern='youtube-duration.service|env.schema.spec|env.service.spec'`; expect all selected cases pass. Review cache memory, aborted waits, negative-cache semantics and redacted diagnostics.

## Task 2: Additive outline response integration

**Modify:** `packages/shared-types/src/validation/youtube-courses.ts`, `apps/api/src/modules/courses/courses.service.ts`, `courses.module.ts`.
**Tests:** existing `apps/api/src/modules/products/youtube-course-contracts.spec.ts`, `apps/api/src/modules/courses/courses.spec.ts`, `apps/web/scripts/check-youtube-courses.mjs`.

**Consumes:** Task 1 singleton lookup. **Produces:** public/own lesson response `durationSeconds?: number | null` (integer 1..2147483647); old responses remain accepted.

- [ ] Add failing shared/BFF tests: `755`, null and omitted accepted; zero/negative/fraction/overflow rejected; client duration fields remain rejected in strict admin writes; restricted video IDs and provider metadata stay stripped.
- [ ] Add service tests: current unpublished/missing/unauthorized checks happen before lookup; catalog/library/enrollment/playback do not call lookup. Both public/own detail map source-keyed results to the corresponding lesson IDs, reuse duplicates, return null for unknown and preserve membership fields. No course read performs a database write.
- [ ] Add a source-change regression: a second request with the same lesson ID and a different video ID receives the new source's time/null, never the previous source's cache entry. Cache hits never bypass course visibility or current-user authorization. Concurrent users never share membership data.
- [ ] Implement response-only schema addition and bind `YouTubeDurationService` once in `CoursesModule`. Make private `detail(row)` async, awaiting lookup against that row's active source IDs and then parsing an explicit safe lesson projection. `bySlug()` returns that promise; `myDetail()` must await the enriched detail before spreading it into `myCourseSchema` (never spread a Promise). Leave repository/Prisma/admin writes untouched.
- [ ] Build shared types; run `pnpm --filter @vetralink/api test --runInBand --testPathPattern='courses.spec|youtube-course-contracts|youtube-duration.service'` and `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-workspace.mjs`. Review source privacy and both BFF response parsers.

## Task 3: Shared duration display and integrated verification

**Create:** `apps/web/src/lib/courses/duration.ts`, `apps/web/src/components/courses/lesson-duration.tsx`, `apps/web/scripts/check-course-durations.mjs`.
**Modify:** `apps/web/src/components/courses/course-detail.tsx`, `course-player.tsx`, `apps/web/src/lib/i18n/courses.ts`, `apps/web/scripts/course-browser-cases.mjs`.

**Interfaces produced:** `formatLessonDuration(seconds: number, locale: Locale): string`; `LessonDuration({seconds}: {seconds?: number | null})`, returning no UI for null/omitted time and a decorative Clock, formatted time and localized unit label when known.

- [ ] Write formatter tests: English `755 → 12:35`, `3723 → 1:02:03`, `93784 → 26:03:04`; Bangla equivalents use localized digits and padded minute/second segments. No fake `0:00`.
- [ ] Add controlled browser cases for known/hour/day/unknown/old-API responses in public and player lesson lists. Verify fallback leaves the course usable; there are no extra iframes or direct browser YouTube Data API calls. Preserve demo, Unlock/Enroll confirmation, member/admin actions, session isolation and one-player behavior.
- [ ] Implement one shared Tailwind component beside access status, preserving title/action alignment. No extra per-lesson client fetch, spinner, error panel, course-total time or manual admin field.
- [ ] Run `pnpm --filter @vetralink/web exec node --test scripts/check-course-durations.mjs scripts/check-youtube-courses.mjs scripts/check-workspace.mjs`, style guard/tests, TypeScript and an isolated production build. Run the existing `WORKSPACE_BROWSER_FOCUS=courses` harness in bn/en at 320/768/1440px and inspect screenshots with long titles and duration labels.
- [ ] Run shared/API builds and focused course regressions; complete final source/spec/diff review. Record actual configured-provider verification separately from synthetic HTTP/browser evidence. No database migration/backfill test is required because this design changes neither schema nor writes.

## Rollout and handoff

- [ ] Deploy API/shared response support first, then web under normal release authorization. Set/restrict the backend key and provider-console quota/alerts; do not expose it through `NEXT_PUBLIC_` or modify the selected live web API URL.
- [ ] Verify one known finite video, warm cache behavior and quota/key/timeout fallback. Existing course rows need no backfill. Document up to 2 seconds of additional cold-read delay and that separate serverless instances may repeat provider calls.
- [ ] Against localhost, use controlled upstream fixtures/local API override for implementation tests; the user's configured live API requires deployment to serve the new field. New web must tolerate the old live API meanwhile.
- [ ] Disable/remove the key or roll back API/web to recover; no database rollback, durable cache cleanup, worker or scheduled-job changes. Update owning roadmap statuses with actual evidence only.

## Planning validation

Review the spec against each task, numeric bound and method signature. Ensure there are no remaining persisted-field, save-time enrichment, backfill or scheduler requirements. Validate documentation links, run `python3 .context/scripts/validate.py` and `git diff --check`. Application tests are unnecessary for this documentation-only revision. Suggested human-managed commit: `docs(courses): simplify lesson durations to API and cache`.

**Planning verification — 2026-10-30:** self-review confirmed the three tasks cover the revised flow and failure cases, cache entries contain no access/user state, in-flight waits share the same request deadline, and all old persistence/maintenance interfaces were removed. Cache and provider bounds agree with the spec; both roadmap entries describe the revised scope. New document/roadmap links, context validation and `git diff --check` passed. No application code, tests, credentials, database or deployment changed.
