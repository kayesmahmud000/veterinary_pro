# YouTube courses with public demos and free enrollment

Status: **Admin and learner slices implemented locally; live migration/YouTube release acceptance pending.**
Date: 2026-10-15. Original planning inspected 82d857a plus ADM-3; admin execution baseline is ab18a9f. [Execution plan](plan.md).

## Admin-first delivery history

The user subsequently requested the admin dashboard first. The current slice implements Product.contentProvider, CourseLesson persistence, admin curriculum GET/PUT, YouTube create/edit/publication rules and the bilingual editor/preview. Existing internal upload/transcode/DRM/checkout paths reject YouTube course assets. Curriculum read DTO also includes `isPublished` for read-only UI behavior. The versioned editor guards unsaved internal/history/document exits.

At that admin-first handoff, CourseEnrollment, public catalog/demo APIs, learner library/player and free enrollment were future work. Admin copy states this explicitly; publication prepares content and does not establish a working learner journey. Preview is a manually selected official iframe; IFrame API event integration remains with learner delivery. No external dependencies or live database deployment were added. See the admin execution evidence in [plan.md](plan.md).

## Learner delivery update

The user's next continuation authorized the learner slice. CourseEnrollment, public catalog and source-free outline/demo APIs, own enrollment/library/playback APIs and bilingual in-site player are implemented locally. `GET me/courses/:id` additionally returns the source-free outline plus the caller's nullable enrollment, so direct auth-return links can offer explicit registration without searching a paginated library. Enrollment is idempotent and audited in the same transaction. The public BFF omits credentials; personalized responses are private/no-store. Player readiness has a15-second deadline, official IFrame events, retry and cleanup. Public layout follows the shared container. No paid access, progress/certificates or live deployment is implied; see [execution evidence](plan.md).

## Outcome and user decisions

The user wants course videos hosted on YouTube and watched inside this website. Confirmed in this conversation: some videos are public demos, other lessons require enrollment, and enrollment is **free for now**. Anonymous visitors can watch demo lessons; active signed-in users can register for a course and watch its main lessons without leaving the site. ADMIN/SUPER_ADMIN manage courses and their ordered video lessons.

This is a selected slice of API-B2 / WEB-5 and an ADM-3 curriculum extension. The user selected this planning work after ADM-3; ADM-4 is still pending. This document refines the earlier HLS-only course assumptions for **new YouTube courses**; it does not redefine existing paid/internal products. References: [blueprint LMS scope and Sprint 1](../../../vetralink_pro_blueprint.md), [original product contract](../../tasks/task-3.1-product-master-crud/spec.md), [streaming contract](../../tasks/task-3.5-cloudfront-oac-signed-urls/spec.md), [ADM-3](../admin-product-media/spec.md).

Success: publish a free course containing at least one enrollment-only lesson and optionally demo lessons; watch a demo anonymously; sign in and enroll once; open the enrolled course from My courses; select and play its lessons in the site's player. Both bn/en interfaces work on phones and desktops.

Phase 1 includes an ordered lesson list, not nested chapters, watch-history persistence, completion percentages, certificates, quizzes, resource downloads, paid enrollment, YouTube uploads/search/playlist synchronization, or mobile-app implementation. Those remain separate scope. Never seed fictional course videos as real content.

## Pre-implementation baseline and implications

**Confirmed from code at admin execution baseline ab18a9f; the delivery update above describes subsequent changes:**

- `apps/api/prisma/schema.prisma` has Product/Order/OrderItem and ADM-3 Product.version/AdminMediaUpload. There are no course lesson or enrollment models. Product.contentS3Key is one internal asset, not a multi-video curriculum.
- `products/admin-products.service.ts` currently requires an attached key, and `.m3u8` for video publication. ProductEntity also rejects published empty-key products. Both checks must become provider-aware together.
- `media/services/entitlement.service.ts` grants internal content through completed purchases or qualifying subscriptions, with admin preview. This is not free enrollment and must not implicitly grant YouTube course membership.
- Stream delivery uses signed HLS/DRM paths; managed media initiation, attachment and workers use internal storage. They must reject YouTube-course requests before provider/queue side effects.
- `/learning` provides three static record guides; the Courses navigation points to `/learning#courses`. There is no dynamic course catalog, enrolled library, or learner video player. Learners land on Home and have no Dashboard entry. Their earlier deferred enrolled-course navigation can now be added.
- The cookie BFF is a fixed mapping in `apps/web/src/lib/workspace/server.ts`; protected return URLs and middleware are explicit allowlists. Public and enrolled responses need distinct mappings and cache behavior.

These are baseline source observations, not deployed behavior. ADM-3 was committed before admin execution; its migration still precedes this feature's migration.

## Approach and limits

Use the official embedded YouTube player with a stored canonical video ID per lesson, and separate platform enrollment. Choose this over a single embedded playlist because individual lessons need demo/access labels and reliable ordering. A full protected hosting migration has greater operational cost and is unnecessary for the selected free release. Keep existing internal delivery available for its current products.

**Confirmed from current official documentation (checked 2026-10-15):** embedded-player terms prohibit charging to watch; ordinary site login is allowed. Keep enrollment as ordinary free platform course registration, with no YouTube likes/subscriptions/rewards required. Do not obscure branding, links, controls or ads. See [Developer Policies](https://developers.google.com/youtube/terms/developer-policies). Enrollment is a site membership boundary; that policy does not establish private-video protection.

Public or Unlisted videos with embedding enabled may be used. Unlisted links can be reshared; Private videos are unsuitable for this general viewer flow. See [privacy settings](https://support.google.com/youtube/answer/157177?hl=en). A viewer can discover the YouTube ID/link during playback. Do not promise domain restriction, DRM, prevention of sharing/download/screen recording, removal of YouTube links, or a guarantee that the viewer can never leave the site. No scraping, proxying or downloading YouTube media into the internal pipeline.

## Data and invariants

Use the active API schema only. Proposed additive changes:

| Record | Fields / rules |
| --- | --- |
| Product | `contentProvider: ProductContentProvider` with `INTERNAL` default and `YOUTUBE` alternative. Existing products default to INTERNAL. YOUTUBE is valid only for VIDEO_COURSE; provider is immutable after creation in this slice. YouTube courses have priceCents=0, discountPriceCents=null, contentS3Key=""; subscription tier does not grant or restrict their access. |
| CourseLesson | UUID id; productId FK RESTRICT; title varchar(200); summary text max1000 at boundary; youtubeVideoId varchar(11); access enum PUBLIC_DEMO / ENROLLED; position int; createdAt/updatedAt/deletedAt. Maximum100 active lessons per course. Active `(productId, position)` unique partial SQL index; ordered read index. IDs survive edits and reordering; omitted lessons are soft-deleted. |
| CourseEnrollment | UUID id; userId/productId FKs RESTRICT; createdAt; unique(userId, productId); index(userId, id). No payment/order fields or arbitrary client-supplied userId. |

Provider choice is explicit when creating an admin product; old clients default to INTERNAL. Editing cannot switch providers. Existing internal products are not automatically converted or repriced. General admin edits must reject nonzero prices/discounts on YouTube products. New YouTube products are marked adminManaged; legacy product mutation paths cannot bypass these rules.

One shared readiness rule serves publication checks in the entity and admin service: INTERNAL keeps its existing asset contract; YOUTUBE requires a saved nonempty curriculum with at least one ENROLLED lesson, valid IDs, zero price/null discount and empty internal key. Demo lessons are optional; every lesson must have its own valid source. Existence/embeddability cannot be proven by URL syntax: admin preview and real playback acceptance are required before launch.

Admin curriculum writes require the product to be unpublished, current active admin authorization and expectedVersion. Lock the current actor then Product in the existing transaction order, compare version, replace the ordered set, increment Product.version once, and write one atomic audit. Duplicate/foreign/deleted lesson IDs and concurrent stale submissions fail without partial changes. Reordering parks retained positions at temporary negative values before assigning the final positive1..N positions, inside the same transaction, to preserve the partial unique index. No remote requests inside transactions.

Enrollment rechecks active identity and published/nondeleted YOUTUBE product under locks. Insert once using the unique membership constraint; repeat requests return the same enrollment. Audit creation in the same transaction, with no duplicate audit on retry. Unpublication/deletion blocks subsequent lesson reads but retains lesson/enrollment history. Suspension/session invalidation blocks authenticated access. No farm membership/header is relevant to this global course catalog.

## API contracts

All paths below are under `/api/v1`. Responses use the existing envelope and strict shared Zod projections. UUID/path association is checked server-side; requests have bounded bodies/queries. No new generic proxy.

| Method/path | Access and data |
| --- | --- |
| Existing POST admin/products | Extend create schema with contentProvider defaultINTERNAL. YouTube creation requires VIDEO_COURSE, zero price, null discount. Add contentProvider to admin product read projection. |
| GET admin/products/:id/curriculum | Current active ADMIN/SUPER_ADMIN; YOUTUBE only. Return `{productId, version, lessons:[{id,title,summary,access,position,youtubeVideoId}]}` including drafts. |
| PUT admin/products/:id/curriculum | Same roles, unpublished YOUTUBE only; body `{expectedVersion, lessons:[{id?:uuid,title,summary,access,videoUrl}]}` max100, max512KiB. Array order is authoritative; empty draft curriculum allowed; response is saved curriculum/new version. Removing a row soft-deletes it. |
| GET courses | Public published YOUTUBE catalog only; search max100chars, limit1..50/default20, UUID cursor, id ascending. Return card summaries/id/slug/title/description/counts, provider and FREE_ENROLLMENT label; no internal keys or lesson video IDs. |
| GET courses/slug/:slug | Public published course overview, ordered lesson outline `{id,title,summary,access,position}` and FREE_ENROLLMENT label. No video IDs, embed URLs or personalized enrollment state. |
| GET courses/:id/lessons/:lessonId/demo-playback | Public; published course and active PUBLIC_DEMO lesson belonging to it. Return `{productId,lessonId,title,provider:"YOUTUBE",videoId}`. An ENROLLED lesson returns404 without source data. |
| POST me/courses/:id/enrollment | Current active user, any platform role; empty body, idempotent200 `{id,productId,createdAt}`. No purchase or subscription check; no enrollment into drafts/deleted/internal products. |
| GET me/courses/:id | Current active user; published source-free course outline plus own nullable enrollment. No lesson sources; private/no-store. |
| GET me/courses | Current active user only; keyset limit1..50/default20. Published, nondeleted enrolled YouTube course summaries plus enrollment ID/time. No other user's membership, no draft content. |
| GET me/courses/:id/lessons/:lessonId/playback | Current active user and own enrollment; published course, active matching lesson. Return same safe playback DTO. Admin draft preview uses the protected admin curriculum screen, not a learner authorization bypass. |

Errors:401 invalid/inactive session;404 absent/unpublished/wrong-course lesson or public request for a locked video;403 COURSE_ENROLLMENT_REQUIRED for authenticated nonmembers at protected playback;409 PRODUCT_VERSION_CONFLICT, COURSE_MUST_BE_UNPUBLISHED or CONTENT_PROVIDER_MISMATCH;400 INVALID_YOUTUBE_URL / invalid curriculum / invalid pricing. Explicit projections keep sources out of public outline, page prefetch, SEO/JSON-LD, errors and logs. Public demo sources are intentionally public.

`normalizeYouTubeVideoId(input: string): string` is shared, pure and performs no fetch. Accept HTTPS `youtube.com` / `www.youtube.com` / `m.youtube.com` watch?v=ID, /embed/ID, /shorts/ID and `youtu.be/ID`; also `www.youtube-nocookie.com/embed/ID`. IDs match exactly `[A-Za-z0-9_-]{11}`. Reject credentials, nondefault ports, lookalike hosts, ambiguous/repeated v parameters, fragments, playlist-only/channel/live URLs, raw HTML and arbitrary schemes. Strip unrelated query parameters, including tracking/start/list, when normalizing. Do not accept user-provided iframe HTML or arbitrary iframe origins. Store only the ID.

INTERNAL asset initiation/attachment, manual/managed transcode, HLS session/manifest, DRM-token and checkout routes reject YOUTUBE products without storage/queue/payment/signer side effects. Propagate contentProvider through entity/repository rehydration so published YouTube empty-key records remain readable by existing product/search consumers. Generic paid entitlement must not substitute for enrollment. Preserve existing INTERNAL tests/contracts, including ebooks/tools. Keep raw/internal download paths unavailable to YouTube courses.

## Web flows and player

- Public `/courses` and `/courses/[slug]` use the marketing shell. Course cards show Free enrollment, public demos and lesson outline; the main CTA is Enroll free / Continue course. Public demos play in-page without login. Preserve `/learning` guides; update Courses navigation to `/courses` and retain existing `/learning#courses` links with a real discoverable course-catalog link.
- The enrollment CTA opens existing auth modals when needed, with a validated course/lesson return path. After sign-in, show the free enrollment action; do not mutate membership automatically during GET or login restoration. A lost enrollment response safely retries. Server membership remains authoritative.
- `/account/courses` is My courses; `/account/courses/[productId]/lessons/[lessonId]` uses the existing protected workspace shell with player, course title, ordered lesson selection and Previous/Next controls. A nonmember receives a clear enrollment action. Demos remain reachable through the public course page. No forced autoplay or automatic next lesson.
- Add My courses to signed-in public account controls and appropriate self-service workspace navigation, including LEARNER; preserve Home as learner's normal login destination and do not introduce a learner Dashboard. Extend return-path allowlists for exact UUID course/lesson routes and `/admin/products/:id/curriculum`; existing `/account` and `/admin` middleware families already protect these paths.
- `/admin/products/[id]/curriculum` edits ordered rows (title, summary, link, demo/enrolled), previews each video, displays source/access labels and saves atomically. Use buttons for moving lessons as well as any drag affordance; confirm removal before saving. Stale saves keep the draft and offer explicit reload. Published curricula are read-only until unpublication. Product create/detail/publication and media actions display the chosen provider and route to the appropriate editor.
- Keep bn default/en selectable, Tailwind-only shared primitives, labeled keyboard controls, loading/empty/error/offline/retry states. User-written course/lesson text is not automatically translated.

Use a purpose-built small YouTube component, no new player dependency. Construct an authored iframe on `https://www.youtube-nocookie.com/embed/<ID>`; attach the official IFrame API only for ready/error events, with one shared script loader and cleanup on lesson change/unmount. Parameters: autoplay=0, controls=1, playsinline=1, rel=0, enablejsapi=1, origin from the site's actual configured/validated origin and hl=bn/en. Use `referrerPolicy="strict-origin-when-cross-origin"`, a descriptive iframe title and fullscreen support. Keep an actual iframe viewport at least200x200px, including320px phones; `aspect-video` alone produces an undersized height there. No authored inline styles or DOM style mutations.

Privacy-enhanced embeds and player behavior are documented by [YouTube Help](https://support.google.com/youtube/answer/171780?hl=en), [player parameters](https://developers.google.com/youtube/player_parameters) and [IFrame API](https://developers.google.com/youtube/iframe_api_reference). The API reports invalid/private/embedding-disabled/referrer failures (2,5,100,101,150,153); provide localized retry/unavailable states and never silently navigate users away. `rel=0` limits related content to the same channel; it does not remove recommendations. Branding/ads remain YouTube-controlled. Privacy-enhanced mode is not a promise of no external data sharing.

Only mount/load the player for a selected authorized/demo source; no hidden players or catalog-wide embeds. No external request on an anonymous locked lesson. No-store/private responses for personalized data and playback; avoid storing video IDs or memberships in persistent browser storage. If deployment headers impose CSP, allow only the official origins needed for iframe/API operation, retaining existing restrictions; test Referer delivery/error153. Do not add a broad permissive CSP. State the external YouTube embed in the site's privacy/help copy.

## Acceptance, rollout and recovery

- Unit/API tests prove provider-aware reads/publication, strict URL parsing, demo vs member separation, current identity checks, same-course matching, draft/deleted denial, idempotent enrollment, stale curriculum conflicts, pricing restrictions and every legacy provider bypass guard.
- Real disposable PostgreSQL tests prove populated upgrade preserves INTERNAL defaults, curriculum replace/reorder/audit rollback and concurrent enrollment producing one row/audit. No production reset/backfill or root-schema edits.
- BFF tests prove fixed public/protected mappings, body/response projection, no farm/header impersonation, no video source in public outlines, no-store and return-path safety.
- Browser acceptance uses bn/en at320/1440px: anonymous demo, locked lesson without source request, auth-return/enroll/retry, own library, lesson selection, logout/suspension isolation, admin ordering/removal/conflict/unpublish, unavailable video and no horizontal overflow. Controlled player tests do not prove YouTube delivery.
- Real configured-origin acceptance with team-owned Public/Unlisted embeddable videos must confirm mobile/desktop playback, Referer, fullscreen, disabled/private video recovery and provider attribution. No API key, OAuth, YouTube upload integration, S3/FFmpeg job or payment provider is required for this slice's video flow; existing application runtime dependencies still apply.

Deploy ADM-3 migration first, then the new additive migration. Upgrade/drain API writers and workers with provider checks before enabling YouTube creation/publication; deploy web last. Old API binaries do not understand published empty-key YouTube products. No automatic conversion, cleanup or change to existing paid products/orders. Before API rollback, unpublish YouTube products and stop new writes; retain an API version that understands the provider or execute a reviewed forward recovery. Hiding the feature's web links alone is not a safe old-API rollback. Preserve lessons, enrollments and audit history.

The later user instructions authorized both implementation slices. Live migrations, deployment and Git integration were not performed; retain the deployment acceptance limits in the plan.
