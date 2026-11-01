# YouTube lesson durations — API with short-lived cache

Status: Planned; implementation not started.
Updated: 2026-10-30. This revision supersedes the earlier persisted-metadata/backfill/scheduler design at the user's request.

## Outcome and scope

Show real YouTube duration beside each lesson in public course details and the enrolled player's lesson list. The backend fetches duration on demand and temporarily caches metadata. Existing courses work automatically from their existing video IDs.

Planning only: no application implementation, credential provisioning, provider calls with credentials or deployment in this change. No database migration/storage, admin-save enrichment, backfill command, scheduled job, new Redis dependency, hidden players or manual duration input.

## Confirmed current implementation

- `apps/api/src/modules/courses/courses.repository.ts` already selects the server-side `youtubeVideoId` for active published lesson outlines.
- `courses.service.ts`: public `bySlug()` and authenticated `myDetail()` share `detail()`; catalog/library lists use `card()`. Enrichment belongs only in the two detail reads, after their current visibility/identity checks.
- `packages/shared-types/src/validation/youtube-courses.ts`: public `courseSchema.lessons` has no duration and strips restricted video IDs. Shared `lessonFields` also feeds admin inputs and must remain unchanged.
- Existing course BFFs validate public/own responses with these shared schemas. Browsers receive safe lesson IDs, not restricted YouTube IDs.
- `course-detail.tsx` and `course-player.tsx` render lesson title/status/actions; the existing player is mounted only on explicit demo/playback paths.
- Courses have no established distributed metadata cache/rate gate. The application's existing workflow limiter may depend on Redis; it is not a suitable new dependency for this optional display feature.

## Chosen flow

1. Resolve the course and user through existing guards/services. Missing/unpublished/unauthorized courses cause no duration-provider requests.
2. Gather the same outline snapshot's video IDs, deduplicate them, and read the backend duration cache.
3. Fetch uncached IDs from the official YouTube Data API; merge successful values by video ID into that outline's lesson IDs.
4. Return optional nullable `durationSeconds` through the existing detail response. The UI renders a time only when known. No duration or provider outage may turn a valid course response into a 5xx.

The cache stores metadata only, never course outlines, user identity, membership, authorization decisions or raw provider responses. Changing a lesson source naturally changes its cache key. Every request still applies current visibility and user checks; cached metadata grants no playback access.

### Contracts

Add `durationSeconds: z.number().int().min(1).max(2147483647).nullable().optional()` to the response-only `courseSchema.lessons` object, not shared admin-input `lessonFields`. Return a positive integer or null; tolerate older APIs omitting the field.

| Existing endpoint under `/api/v1` | Existing permission | Proposed change |
| --- | --- | --- |
| `GET /courses/slug/:slug` | Public, published course | Add optional nullable `lessons[].durationSeconds` |
| `GET /me/courses/:id` | Current authenticated user; existing visibility | Same additive field; preserve membership projection |

No endpoint/body/Prisma change. Catalog, library, curriculum saves, enrollment and playback routes do not call the duration provider. Timestamps, restricted video IDs, credentials and provider errors stay internal.

### Provider, cache and quota bounds

- Optional server-only `YOUTUBE_DATA_API_KEY`; missing key disables lookups without breaking startup or courses. Restrict the key to YouTube Data API in the provider console.
- Fixed HTTPS URL `https://www.googleapis.com/youtube/v3/videos`, `part=contentDetails,snippet`, fields `items(id,contentDetails/duration,snippet/liveBroadcastContent)`, credential in `X-Goog-Api-Key`. No redirects, arbitrary URLs, scraped pages, SDK dependency or logged secrets.
- Accept only normalized 11-character video IDs, at most 100 unique IDs/detail request; chunks of 50, no more than two provider batches concurrently per API instance. Reuse overlapping in-flight ID lookups on the same instance.
- Total enrichment deadline 2 seconds per detail request, including waiting for an in-flight batch; each provider fetch is aborted within 1.5 seconds. Response body at most 1 MiB. No retry or background continuation after timeout. The request returns whatever fresh cached/successful values are available; other durations are null. The UI may wait up to 2 additional seconds on a cold read; warm hits add no provider wait.
- Bounded in-memory cache of at most 1000 video entries, LRU eviction, positive and confirmed-unavailable entries valid for 10 minutes. Transport/invalid-response failures use a 60-second negative cache. Purge expired entries on access/admission and never serve expired values. Cache/in-flight coordination is shared by the Nest singleton within an instance, not recreated per request.
- At most 30 provider batch starts per rolling 60 seconds per instance; a full concurrency slot or exhausted local budget returns available cached values immediately. Quota/authentication failures start a 10-minute instance-wide cooldown. Requests during cooldown perform no provider fetch; fresh known values may still be returned.
- These are instance-local protections. Serverless cold starts/parallel instances reset or duplicate local work; they are not a distributed quota guarantee. Provider-console project quota limits/alerts are the deployment-wide boundary. Higher traffic may later justify shared caching, but it is outside this slice. Do not promise cross-instance deduplication or a fixed fleet-wide call count.
- Parse finite day/hour/minute/second ISO 8601 values; reject zero, negative, fractional, calendar month/year, invalid and overflow values. Live/upcoming or missing/private/deleted videos produce no duration. Partial batch failure preserves other successes and fresh hits.

### User interface

Reuse one formatter/component in both lesson lists. Add a decorative Clock icon plus localized `m:ss`, e.g. `১২:৩৫` / `12:35`; use `h:mm:ss` for one hour or longer, allowing hours above 24. Provide localized accessible unit labels.

For null/omitted/failed duration, omit the time and retain title/access/actions. Do not display `0:00`, an error panel or an extra video-loading spinner. Preserve existing title/action alignment and Enroll/Unlock/Demo behavior. Test long Bangla/English titles at 320/768/1440px. No course totals/progress and no additional iframe per lesson.

## Acceptance and rollout

Acceptance includes provider parsing, TTL/eviction, coalescing and concurrency budgets, bounded timeout, cooldown, missing key, partial success and old response compatibility. Course authorization/visibility, source privacy, existing enrollment/player behavior and database no-write behavior must remain intact. Use controlled HTTP/clock fixtures and real browser layout checks; no migration/backfill/database write is needed for this feature.

Deploy API/shared response support, then web. Configure the backend-only key and provider quota/alerts separately under normal release authorization. Verify a known finite video and outage fallback; record actual cold/warm behavior and quota rather than claiming every lesson always has a time. Localhost web retains its selected live backend URL, so local API source changes require either a local test override or deployment before they appear against the live URL. Disable/remove the key or roll back API/web to turn the optional feature off; no database recovery or cleanup job is needed.

## External references checked 2026-10-30

- [YouTube Data API setup](https://developers.google.com/youtube/data/getting-started): enablement and credentials.
- [videos.list](https://developers.google.com/youtube/data/reference/rest/v3/videos/list): metadata batch query and quota accounting.
- [Video resource duration](https://developers.google.com/youtube/data/reference/rest/v3/videos#contentDetails.duration): ISO 8601 values, including day-long videos.
- [IFrame API](https://developers.google.com/youtube/iframe_api_reference#Retrieving_video_information): duration requires a loaded video's metadata; loading every lesson's player is unnecessary for this design.
