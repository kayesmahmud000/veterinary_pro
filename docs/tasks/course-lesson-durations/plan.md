# YouTube Lesson Durations Implementation Plan — Simple API + Cache

> **For agentic workers:** Use the `executing-plans` skill to implement task by task. Follow Implement → Review → Test → Re-review → Finalize. Delegation requires separate authorization; Git staging, commits, merging and pushing remain human-managed.

**Goal:** Display real per-lesson duration with server-side YouTube lookup and a short-lived metadata cache.

**Architecture:** Enrich the existing public/own course-detail reads after access checks, keyed by their existing server-side video IDs. A singleton service bounds fetches and caches metadata in memory. Shared response validation and one bilingual UI component carry the result; unknown values are omitted from the display.

**Tech Stack:** Existing NestJS/TypeScript, native fetch, Zod, Next.js/React/Tailwind, Jest and Chrome CDP. No new application dependency or infrastructure.

**Spec:** [spec.md](spec.md). Revised 2026-10-30 after the user chose the simpler design. Status: implementation authorized 2026-11-02; local implementation verified, with the existing locale/player baseline limitation below. The earlier storage/migration/backfill/scheduler plan is superseded.

## Global constraints

- No Prisma/schema/migration, persisted duration fields, admin-save changes, backfill, scheduled workflow, new Redis dependency or hidden video players.
- Optional server-only `YOUTUBE_DATA_API_KEY`; all credential/provider failures preserve valid course reads and learning.
- Add only response-level `durationSeconds?: number | null`; never add it to admin input `lessonFields` or expose restricted source IDs.
- 10-minute metadata TTL; 60-second failure cache; 1000-entry LRU; max 100 IDs/request and chunks of 50.
- Max two active provider batches/instance, 30 batch starts/rolling minute/instance, 1.5-second fetch timeout, 2-second enrichment deadline, 1 MiB body limit, no retry, 10-minute quota/auth cooldown.
- No provider work in catalog/library/enrollment/playback/admin-save paths or database transactions. Preserve current visibility/session and BFF boundaries.
- Local protections do not guarantee a serverless fleet-wide quota. Backend API key restrictions and project quota/alerts are rollout prerequisites.
- Tailwind, existing locale behavior, human-managed Git and normal release authorization apply. Implementation is authorized; target deployment and provider setup remain separate.

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

- [x] Write failing parser cases: `PT12M35S → 755`, `PT1H2M3S → 3723`, `P1DT2H3M4S → 93784`; zero, negative, fractional, calendar month/year, invalid and overflow return null.
- [x] Write controlled-fetch/clock tests for fixed host/headers/selected fields, ID validation/deduplication, 50-ID chunks, 100-ID cap, response ID validation, partial/unavailable/live results and 1 MiB cap. Assert credential never appears in URL/logs/errors.
- [x] Add tests for missing key/no network; 10-minute expiration with no stale serving; 60-second failure suppression; 1000-entry LRU; overlapping requests coalesced by video ID; at most two active batches; the 31st start in a rolling minute skipped; quota/auth cooldown expires after 10 minutes.
- [x] Test a hanging body, delayed fetch and an existing in-flight batch against the 1.5/2-second bounds; abort obsolete requests and release counters/promises in `finally`. A request that cannot start work within its deadline returns fresh hits without starting later/background fetches. Success in one chunk remains available if the other fails.
- [x] Run the focused tests and observe red; implement the service with the exact bounds above. Optional trimmed key in EnvService/schema/examples and Turbo passthrough must not make startup require new credentials. Do not reuse the Redis workflow limiter for this optional feature.
- [x] Run `pnpm --filter @vetralink/api test --runInBand --testPathPattern='youtube-duration.service|env.schema.spec|env.service.spec'`; expect all selected cases pass. Review cache memory, aborted waits, negative-cache semantics and redacted diagnostics.

## Task 2: Additive outline response integration

**Modify:** `packages/shared-types/src/validation/youtube-courses.ts`, `apps/api/src/modules/courses/courses.service.ts`, `courses.module.ts`.
**Tests:** existing `apps/api/src/modules/products/youtube-course-contracts.spec.ts`, `apps/api/src/modules/courses/courses.spec.ts`, `apps/web/scripts/check-youtube-courses.mjs`.

**Consumes:** Task 1 singleton lookup. **Produces:** public/own lesson response `durationSeconds?: number | null` (integer 1..2147483647); old responses remain accepted.

- [x] Add failing shared/BFF tests: `755`, null and omitted accepted; zero/negative/fraction/overflow rejected; client duration fields remain rejected in strict admin writes; restricted video IDs and provider metadata stay stripped.
- [x] Add service tests: current unpublished/missing/unauthorized checks happen before lookup; catalog/library/enrollment/playback do not call lookup. Both public/own detail map source-keyed results to the corresponding lesson IDs, reuse duplicates, return null for unknown and preserve membership fields. No course read performs a database write.
- [x] Add a source-change regression: a second request with the same lesson ID and a different video ID receives the new source's time/null, never the previous source's cache entry. Cache hits never bypass course visibility or current-user authorization. Concurrent users never share membership data.
- [x] Implement response-only schema addition and bind `YouTubeDurationService` once in `CoursesModule`. Make private `detail(row)` async, awaiting lookup against that row's active source IDs and then parsing an explicit safe lesson projection. `bySlug()` returns that promise; `myDetail()` must await the enriched detail before spreading it into `myCourseSchema` (never spread a Promise). Leave repository/Prisma/admin writes untouched.
- [x] Build shared types; run `pnpm --filter @vetralink/api test --runInBand --testPathPattern='courses.spec|youtube-course-contracts|youtube-duration.service'` and `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-workspace.mjs`. Review source privacy and both BFF response parsers.

## Task 3: Shared duration display and integrated verification

**Create:** `apps/web/src/lib/courses/duration.ts`, `apps/web/src/components/courses/lesson-duration.tsx`, `apps/web/scripts/check-course-durations.mjs`.
**Modify:** `apps/web/src/components/courses/course-detail.tsx`, `course-player.tsx`, `apps/web/src/lib/i18n/courses.ts`, `apps/web/scripts/course-browser-cases.mjs`.

**Interfaces produced:** `formatLessonDuration(seconds: number, locale: Locale): string`; `LessonDuration({seconds}: {seconds?: number | null})`, returning no UI for null/omitted time and a decorative Clock, formatted time and localized unit label when known.

- [x] Write formatter tests: English `755 → 12:35`, `3723 → 1:02:03`, `93784 → 26:03:04`; Bangla equivalents use localized digits and padded minute/second segments. No fake `0:00`.
- [x] Add controlled browser cases for known/hour/day/unknown/old-API responses in public and player lesson lists. Verify fallback leaves the course usable; there are no extra iframes or direct browser YouTube Data API calls. Preserve demo, Unlock/Enroll confirmation, member/admin actions, session isolation and one-player behavior.
- [x] Implement one shared Tailwind component beside access status, preserving title/action alignment. No extra per-lesson client fetch, spinner, error panel, course-total time or manual admin field.
- [x] Run `pnpm --filter @vetralink/web exec node --test scripts/check-course-durations.mjs scripts/check-youtube-courses.mjs scripts/check-workspace.mjs`, style guard/tests, TypeScript and an isolated production build. Run the existing `WORKSPACE_BROWSER_FOCUS=courses` harness in bn/en at 320/768/1440px and inspect screenshots with long titles and duration labels.
- [x] Run shared/API builds and focused course regressions; complete final source/spec/diff review. Record actual configured-provider verification separately from synthetic HTTP/browser evidence. No database migration/backfill test is required because this design changes neither schema nor writes.

## Rollout and handoff

- [ ] Deploy API/shared response support first, then web under normal release authorization. Set/restrict the backend key and provider-console quota/alerts; do not expose it through `NEXT_PUBLIC_` or modify the selected live web API URL.
- [ ] Verify one known finite video, warm cache behavior and quota/key/timeout fallback. Existing course rows need no backfill. Document up to 2 seconds of additional cold-read delay and that separate serverless instances may repeat provider calls.
- [ ] Against localhost, use controlled upstream fixtures/local API override for implementation tests; the user's configured live API requires deployment to serve the new field. New web must tolerate the old live API meanwhile.
- [ ] Disable/remove the key or roll back API/web to recover; no database rollback, durable cache cleanup, worker or scheduled-job changes. Update owning roadmap statuses with actual evidence only.

## Planning validation

Review the spec against each task, numeric bound and method signature. Ensure there are no remaining persisted-field, save-time enrichment, backfill or scheduler requirements. Validate documentation links, run `python3 .context/scripts/validate.py` and `git diff --check`. Application tests are unnecessary for this documentation-only revision. Suggested human-managed commit: `docs(courses): simplify lesson durations to API and cache`.

**Planning verification — 2026-10-30:** self-review confirmed the three tasks cover the revised flow and failure cases, cache entries contain no access/user state, in-flight waits share the same request deadline, and all old persistence/maintenance interfaces were removed. Cache and provider bounds agree with the spec; both roadmap entries describe the revised scope. New document/roadmap links, context validation and `git diff --check` passed. No application code, tests, credentials, database or deployment changed.

## Implementation and review — 2026-11-02

**Confirmed from code:** optional backend-only configuration, bounded metadata parsing/cache/coalescing, safe public/own response enrichment and shared bilingual lesson time display are implemented. Unknown times omit the time without changing actions. API and web roadmaps will distinguish local completion from provider/deployment gates. No database, curriculum-save, durable cache, scheduler or live configuration changes. Work remains uncommitted.

**Review corrections:** source review found (1) HTTP 400 invalid-key responses needed the instance cooldown, (2) a generic span could not reliably expose the duration label, and (3) malformed per-video results needed the 60-second failure TTL. Provider regressions failed before the fixes (`/tmp/vetralink-duration-review-red.log`); a Chrome accessibility regression failed before textual unit content (`/tmp/vetralink-duration-accessibility-red2.log`). A further malformed JSON coercion test failed before replacing unnecessary String coercion (`/tmp/vetralink-duration-malformed-red2.log`). Source re-review found no outstanding Critical/Important issue after these corrections.

**Test-harness ruling:** existing readiness predicates could run before session restoration or mistake pending identity for pending membership. Wait for actual membership fixture traffic and settled action controls. Chrome splits JSX text into multiple StaticText nodes; the accessibility assertion verifies their combined readable units, with per-viewport AX evidence, rather than requiring a single text node. These changes retain existing flow assertions.

**Evidence so far:** shared build, API build, web production build, TypeScript, 14 style tests and 37 web formatter/render/BFF/workspace tests passed. The production web copy is `/tmp/vetralink-lesson-durations/web`, excluding real env files and using the synthetic upstream. Final provider suite and browser results follow below.

## Final local verification — 2026-11-02

- `pnpm --filter @vetralink/shared-types build` — passed (`/tmp/vetralink-duration-shared.log`).
- `pnpm --filter @vetralink/api build` — passed after the final provider fixes (`/tmp/vetralink-duration-api-verified-build.log`). Prisma generation only; no migration/database writes.
- `pnpm --filter @vetralink/api test --runInBand --testPathPattern='youtube-duration.service|courses.spec|youtube-course-contracts|admin-course-curriculum.spec|env.schema.spec|env.service.spec'` — **92 passed in six suites** (`/tmp/vetralink-duration-api-verified-tests.log`). Existing env-validation tests intentionally emit redacted validation errors for invalid fixtures.
- `pnpm --filter @vetralink/web exec node --test scripts/check-course-durations.mjs scripts/check-youtube-courses.mjs scripts/check-workspace.mjs` — **37 passed** (`/tmp/vetralink-duration-web-reviewed.log`).
- `pnpm --filter @vetralink/web check:styles` and `test:styles` — passed, **14 style tests** (`/tmp/vetralink-duration-styles-final.log`); `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` — passed (`/tmp/vetralink-duration-types-final.log`).
- `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-lesson-durations/web` — passed (`/tmp/vetralink-duration-web-final-build.log`). The isolated copy excludes runtime credentials; its node_modules link uses existing installed dependencies.
- Root course browser harness with that build: all new duration/Chrome AX checks pass in bn/en at 320/768/1440px, then the unchanged historical `Language switch does not recreate active video` assertion fails (2 vs1), accurately recorded in `/tmp/vetralink-duration-browser-complete.log`. This original suite is **not reported green**.
- Independent baseline: an isolated build using the **HEAD course-player.tsx without duration UI**, on the same current Next.js15.5.28, reproduces `{before:1,after:2,remounted:true}` (`/tmp/vetralink-duration-baseline-browser.log`). No locale/auth/player production fix was added to this task.
- A temporary copy of the browser harness changed **only that assertion** to require the independently observed baseline count (`before+1`). With the final duration build it passed **405 checks** (`/tmp/vetralink-duration-browser-baseline-aware.log`), including all remaining session/error/retry cases and zero browser YouTube Data API requests. This diagnostic run establishes no extra duration-related remount; it does **not** prove the historical no-remount requirement or replace the strict root test.
- Screenshots/AX records: `/tmp/khamar-workspace-qa-1E9rYL/`. Manually inspected Bangla 320px detail and English1440px player from the equivalent preceding final-build captures in `/tmp/khamar-workspace-qa-vdgxvk/`: time remains legible, actions align, unknown time is omitted and there is no horizontal overflow.
- `python3 .context/scripts/validate.py`, local document links and `git diff --check` — passed.

**Completion and limits:** all three implementation tasks are complete locally. Source review corrections were addressed and relevant regressions run red/green; final source self-review found no remaining duration-specific material defect. The independent existing locale/player issue is retained in `.context/known-gaps.md`. Browser/API provider data is controlled, not actual credentialed YouTube acceptance. Active local API env files have no YouTube key; no live key, deployment, account, data or provider settings changed. Root browser acceptance retains the stated pre-existing failure. Deployment/provider setup gates above remain unchecked and must not be inferred complete.

Suggested human-managed commit: `feat(courses): show cached YouTube lesson durations`.
