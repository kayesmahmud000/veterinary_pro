# YouTube Courses Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan inline, task by task. The user authorized the admin slice first; the subsequent user continuation also authorized the learner slice.

**Goal:** Let visitors watch public course demos and active users freely enroll and watch YouTube lessons inside the website.

**Architecture:** Product remains the course master, with an explicit INTERNAL/YOUTUBE provider. Ordered CourseLesson rows and own CourseEnrollment records provide curriculum and site membership; official embeds handle video playback. Separate public demo and authenticated lesson endpoints prevent source leakage through the catalog.

**Tech stack:** Existing NestJS, Prisma/PostgreSQL, shared Zod/TypeScript, Next.js14/React, Tailwind and official YouTube IFrame API. No new runtime package required.

**Spec:** [spec.md](spec.md). Planning baseline: 82d857a plus ADM-3; admin execution baseline: ab18a9f. Status: **Admin and learner slices implemented locally; release acceptance pending.**

## Global constraints

### Execution update — admin first, 2026-10-15

User explicitly selected implementation of the admin dashboard first. Execute provider/schema and admin curriculum/publication/editor work now, with the internal-media/payment safeguards necessary for safe new products. Learner/public APIs, enrollment model, library and learner playback remain deferred. Reuse ProductsModule for the admin curriculum service to avoid an unnecessary module/circular dependency. Preview uses an authored privacy-enhanced iframe; player event/progress integration belongs to the later learner slice. Work inline in this clean user-managed checkout (HEAD ab18a9f); preserve the human-managed Git policy and use /tmp for isolated builds. No automatic worktree/commit is needed for this existing workflow.

Admin acceptance ledger:

- [x] Provider/parser/schema and provider-aware product/read/publication rules, with RED→GREEN coverage.
- [x] Guarded atomic versioned curriculum GET/PUT and internal-media/checkout safeguards, including disposable PostgreSQL checks.
- [x] Bilingual admin product/editor/preview/media eligibility and fixed BFF/return-path mappings.
- [x] Review, full API/relevant web/build/browser verification and evidence/roadmap handoff.

- User-confirmed: public demos + free enrollment for main lessons; video stays on YouTube and plays in the site.
- Preserve ADM-3 working changes and its additive migration; use only `apps/api/prisma/schema.prisma`. No automatic Git add/commit/merge/push or production migration/deployment.
- YOUTUBE is VIDEO_COURSE-only, priceCents=0, discountPriceCents=null, contentS3Key=""; provider immutable after creation. All existing rows remain INTERNAL.
- Ordinary platform enrollment only; no YouTube engagement gates or fees. Link sharing remains possible. No hidden/obscured player controls/branding/ads, downloads or source proxying.
- Max100 active lessons, title200/summary1000chars, exact11-character video ID, curriculum body512KiB. Catalog/library limit1..50/default20; search<=100chars.
- Current active identity and own membership; global products have no farm scope. Sensitive writes/audit share one transaction; no external calls inside it.
- bn default + en; Tailwind-only; minimum actual player viewport200x200px. Preserve learner Home login and existing auth return/onboarding behavior.
- Nested chapters, progress/resume persistence, certificates/resources, paid checkout/enrollment and playlist sync are deferred.

## Review focus

1. Public page HTML/JSON/prefetch/errors must not contain enrollment-only video IDs; test public outline and direct demo-playback denial in Tasks2/3.
2. YouTube published empty-key products must survive existing entity/search rehydration; test this and unchanged INTERNAL publication in Task1.
3. Switching products/lessons, logout or suspended sessions must not retain a previous private player; test component cleanup and auth isolation in Tasks3/5.
4. Concurrent reorder/enrollment and audit failure must not partially replace lessons or duplicate memberships/audits; prove with real PostgreSQL in Task2.
5. A320px viewport, suppressed Referer, disabled embeds or network blocking must give usable inline recovery; cover player tests/screenshots and real-origin acceptance in Tasks3/5.

## Task 1 — Provider-aware products and additive persistence

**Files:** modify API Prisma schema; add a fresh migration after `20261015090000_admin_product_media`; modify shared `validation/admin-catalog.ts`, enums/index.ts and root index.ts; create shared `validation/youtube-courses.ts`; modify ProductEntity, product repository/interface, admin-products service/repository/projections and adjacent specs. Exact existing paths are under `apps/api/src/modules/products/`.

**Produces:** `ProductContentProvider {INTERNAL,YOUTUBE}`; provider-aware Product props/getter and admin create/read schemas; CourseLesson/CourseEnrollment models as specified; `normalizeYouTubeVideoId(input: string): string`; shared curriculum/course/enrollment/playback DTO schemas and inferred TS types. Public legacy DTOs retain compatibility; never embed lesson source arrays in them.

- [ ] Write failing tests in `products/admin-products.spec.ts`, `entities/product.entity.spec.ts` and new `products/youtube-course-contracts.spec.ts`: legacy defaultINTERNAL; published zero-price YOUTUBE with empty key can rehydrate; cannot publish without an ENROLLED lesson; invalid price/provider/type rejected. Parser cases: approved URL forms normalize to one ID; credentials/lookalikes/repeated-v/invalid-length/playlist-only/HTML rejected.
- [ ] Run `pnpm --filter @vetralink/api test --runInBand admin-products.spec.ts product.entity.spec.ts youtube-course-contracts.spec.ts`; confirm expected new assertions fail.
- [ ] Add enum/defaulted Product field, models, relations, FK/unique/partial indexes. Implement parser and strict schemas from the spec. Propagate provider through Product repository rehydration/serialization. Share provider-aware publication readiness between admin and entity; do not make `contentS3Key` a URL field.
- [ ] Extend admin create only with optional defaultINTERNAL provider; validate YouTube zero pricing on create/edit, provider immutability, and publication against saved curriculum under product lock. Make readiness usable with repository-provided lesson facts without entity-to-database dependencies. Expose provider in admin reads and retain explicit public metadata filtering.
- [ ] Build shared package, generate Prisma from API package, rerun the targeted tests and API build. Rehearse baseline+ADM-3+new migration on an explicitly disposable populated DB; schema diff must be empty and old products INTERNAL. No configured database writes. Review final SQL and compatibility before Task2.

## Task 2 — Curriculum, enrollment, protected playback and legacy guards

**Create under `apps/api/src/modules/courses/`:** `courses.module.ts`, `courses.repository.ts`, `admin-courses.service.ts`, `admin-courses.controller.ts`, `courses.service.ts`, `courses.controller.ts`, `courses.spec.ts`, `courses.database.spec.ts`. Register CoursesModule in AppModule. Import existing Product/Users/Auth/Audit/transaction providers without creating a Products↔Courses module cycle; curriculum readiness queries belong in the product repository or an acyclic shared provider.

**Modify:** product admin publication integration; `media/admin-media.service.ts`, `media-upload.controller.ts`, media upload/stream/DRM/entitlement services, `media/processors/video-transcode.processor.ts`, `orders/services/checkout.service.ts` and relevant existing download guards; audit directory action allowlist and `web/src/lib/i18n/admin-directory.ts`. Trace each registered legacy entry point before adding guards.

**Consumes:** Task1 schemas/models/provider/parser. **Produces:** every new API method/path in the spec. Services: `AdminCoursesService.getCurriculum(claims,productId)` / `replaceCurriculum(claims,productId,input)`; `CoursesService.list(query)` / `bySlug(slug)` / `demoPlayback(productId,lessonId)` / `enroll(claims,productId)` / `myCourses(claims,query)` / `lessonPlayback(claims,productId,lessonId)`. Use inferred shared input/return types and existing JwtPayload. Prisma reads/writes stay in repositories.

- [ ] Write failing tests proving public outline omits sources, demo endpoint denies ENROLLED/foreign/deleted lessons, active enrollment is required, a completed purchase/subscription alone is insufficient, and unpublished/deleted courses are blocked. Admin preview must not weaken the learner endpoint.
- [ ] Add failing transaction tests for duplicate enroll retry, concurrent enrollment, stale curriculum replace, duplicate/foreign lesson IDs, reorder without uniqueness collisions and audit rollback. New DB tests must require an explicit disposable-test URL and never reset an inferred database.
- [ ] Run new and related existing specs; confirm failures describe missing behavior. Implement repository projections/queries, current-user checks, bounded keyset lists and the exact controller routes/errors from the spec. Use product/user locks in the established order and expectedVersion for curriculum writes. Handle unique enrollment concurrency without leaving a failed SQL transaction open or duplicating audit; serialize on the locked product or use conflict-safe insertion.
- [ ] Implement draft-only atomic replacement: temporarily park retained positions, soft-delete omitted IDs, create/update active rows, assign1..N, increment product version once and audit once. All source inputs use the pure canonical parser; no remote validation claims.
- [ ] Add provider checks before internal upload/attach/transcode/HLS/DRM/download/payment effects. Preserve INTERNAL behavior and source isolation. Add `COURSE_CURRICULUM_UPDATED` and `COURSE_ENROLLED` audit labels/projections without video URLs/IDs in public or routine audit snapshots. Enrollment belongs to claims.sub, never body or farm headers.
- [ ] Run targeted tests and opt-in real DB tests; verify populated data/reorder/concurrency/audit rollback, then re-review source leakage, query bounds, module wiring and legacy consumers. No YouTube/S3/payment calls needed for these tests.

## Task 3 — Public course discovery, free enrollment and in-site lesson player

**Create:** web `src/lib/courses/server.ts`, `client.ts`, `src/lib/i18n/courses.ts`; public BFF `src/app/api/courses/[[...path]]/route.ts` (optional catchall includes the catalog root); marketing `src/app/(marketing)/courses/page.tsx` and `[slug]/page.tsx`; workspace `src/app/(workspace)/account/courses/page.tsx` and `[id]/lessons/[lessonId]/page.tsx`; components under `src/components/courses/` named `course-catalog.tsx`, `course-detail.tsx`, `course-library.tsx`, `course-player.tsx`, `youtube-player.tsx`; player loader `src/lib/courses/youtube-player.ts`; tests `scripts/check-youtube-courses.mjs`.

**Modify:** fixed mappings in `src/lib/workspace/server.ts`; workspace navigation/return-path rules; public navigation; existing AuthControls and bn/en account/navigation messages. Reuse current auth/session client and UI primitives, including API response diagnostics. Do not build a second auth system.

**Consumes:** Task2 public/private API DTOs. **Produces:** route flow in the spec, plus `YouTubePlayer({videoId,title,locale})`; deterministic official-URL/script-loader helpers with no stored progress. Public course SSR receives only source-free outline data; demo/private source fetch occurs only for the selected permitted lesson.

- [ ] Write boundary tests for exact public GET mappings, protected me/* methods, rejected unknown paths/IDs/query keys, stripped response fields, no-store/private headers and no forwarded farm or arbitrary authorization headers. Public proxy never forwards cookies/tokens to YouTube; browser talks directly to the official player.
- [ ] Write source/helper tests for canonical embed origin, safe origin parameter, iframe referrer policy, narrow minimum height, lazy mount, ready/error handling and cleanup; auth tests cover logout/source clearing and validated exact return URLs. Run them first and confirm the missing behavior fails.
- [ ] Implement public BFF with a fixed courses route table, no cookies forwarded, bounded requests, upstream envelope parsing and explicit source-free schemas. Treat a missing catchall path as `[]`, mapping GET `/api/courses` to upstream `/courses`; test that root as well as slug/demo paths. Add me/courses routes to the existing authenticated BFF, enforcing current identity, existing CSRF checks, response association and private no-store caching.
- [ ] Implement catalog/detail with free/demo/enrollment copy; preserve existing learning guides. Add My courses navigation and library; keep learner login Home behavior. Enroll through POST only after an explicit click, and retry a lost response safely. Preserve return destination through login without a mutation during SSR/restoration.
- [ ] Implement inline public demo and protected lesson player/list/Previous/Next using one small official player component. Author the iframe in React/Tailwind and bind IFrame API events to it; scripts load once, listeners/player are destroyed on switch/unmount, stale fetches are aborted/ignored. Display localized ready/unavailable/referrer/network states with retry; do not autoplay, hide branding or redirect automatically. Honor200x200px minimum even on320px devices.
- [ ] Run `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-auth.mjs scripts/check-protected-routes.mjs scripts/check-workspace-navigation.mjs scripts/check-public-content.mjs`; run styles and TypeScript checks. Review logged-out HTML/prefetch payloads for locked video IDs and test account switching before Task4.

## Task 4 — Administrative YouTube curriculum workflow

**Create:** `web/src/app/(workspace)/admin/products/[id]/curriculum/page.tsx`, `web/src/components/workspace/admin-course-curriculum.tsx`; focused copy in `web/src/lib/i18n/courses.ts` and tests in `scripts/check-youtube-courses.mjs`.

**Modify:** `admin-products.tsx`, `admin-media.tsx`, `i18n/admin-catalog.ts`, fixed admin BFF mappings, navigation/return-path allowlists, and admin-catalog browser fixtures. Keep current media upload flows functional for INTERNAL products.

**Consumes:** Task1 provider-aware admin schema, Task2 versioned curriculum GET/PUT, Task3 player component. **Produces:** provider selection during VIDEO_COURSE creation, curriculum editing/preview and provider-specific publication guidance.

- [ ] Write failing tests for provider visibility, fixed curriculum GET/PUT paths/body limit, conflict recovery, published read-only state and invalid YouTube prices/links. Verify media upload product selection excludes YOUTUBE products without changing INTERNAL eligibility.
- [ ] Add provider choice to new video product form; set free pricing for YouTube and show the source immutably in details/edit. Replace the pending curriculum notice only for YOUTUBE products with the real editor link. Show saved lesson/demo counts and publication requirements.
- [ ] Implement add/edit/remove/reorder with title/summary/link/access labels, stable IDs and button-based order controls. Save the complete array/version atomically. Preserve unsaved rows on failure/conflict; reload is an explicit discard action. Preview only saved/validated canonical IDs via the shared player. Published courses require confirmed unpublication first.
- [ ] Run focused Node and controlled browser checks for ADMIN/SUPER_ADMIN bn/en; prove nonadmins cannot call the API or BFF, stale windows conflict, refresh preserves edits, reordering survives reload and public demo flags change only after save/publication. Re-review empty/loading/error/focus/mobile behavior.

## Task 5 — Integrated verification, rollout evidence and handoff

**Create:** `web/scripts/check-youtube-courses-browser.mjs`, using existing Playwright/browser-harness conventions and an isolated production build. Update this plan with actual results, and update API/web/root roadmaps and shared context only for evidence obtained.

- [ ] Add controlled browser coverage: anonymous demo/no login; locked source not fetched; sign-in return then explicit free enrollment; safe duplicate retry; own library vs another user; all lessons play/select inside site; logout/suspension cleanup; missing/deleted/embed-disabled video; no overflow; admin publication/order/conflict. Run bn/en at320/1440px and inspect screenshots. Check enrollment does not trigger payment, DRM, S3 or queue work.
- [ ] Review as Code Reviewer + QA, UI Reviewer and security/database/architecture perspectives; fix in-scope findings and rerun affected checks. Do not describe self-review as independent review. Keep provider immutability and old-API rollback compatibility explicit.
- [ ] Run shared/API builds, full API suite including opted-in disposable DB tests, relevant web regression scripts, styles and web production build. Run existing dashboard/media browser regression plus the new course browser script; assert unchanged INTERNAL upload/playback contracts.
- [ ] On an authorized configured origin, manually check team-owned Public/Unlisted videos in Chrome/Firefox/mobile Safari, Referer/error153, fullscreen, private/removed/disabled-video recovery and external player attribution. Record this separately from controlled browser passes. If unavailable, leave live provider acceptance pending; do not claim delivery from mocks.
- [ ] Validate documentation/local links and `git diff --check`; record commands, results, skips and environment. Migration order: ADM-3, new additive schema, compatible API/workers, web, then publish course content. Retain provider-aware API for recovery; no reset, automatic conversion or object cleanup.
- [ ] Complete implementation acceptance only when code/tests support it; distinguish local completion from rollout acceptance. Suggest a human-managed commit; do not run Git integration or deploy from this plan.

## Planning verification and handoff

**Performed:** inspected current product/media/entitlement/schema, public learning/navigation and auth/BFF boundaries; checked official YouTube embedding/player/privacy/policy documentation; incorporated both user clarifications; self-reviewed this spec/plan for public-source leakage, immutable provider, empty-key compatibility, concurrency, private caches and mobile viewport requirements. Documentation links and context validation are recorded below after checking.

**At the planning handoff:** implementation, feature runtime tests, migrations and deployments had not been performed. The later admin-first execution update/evidence supersedes this planning-time status for the admin slice only; learner tasks remain open.

**Observed documentation validation, 2026-10-15:** `.context/scripts/validate.py` passes (48 documents / 324 local links / 95 source entries). Local Markdown target checks across the eight planning/context documents pass, as do new-file whitespace/placeholder checks and `git diff --check`. Application tests were not rerun for this documentation-only planning task. Roadmaps/context label the feature proposed, retain ADM-3's local evidence and keep ADM-4 unstarted.

Suggested planning commit: `docs(courses): plan YouTube demos and free enrollment`.
Suggested eventual implementation commit: `feat(courses): add YouTube lessons and free enrollment`.


## Admin execution evidence — 2026-10-15

**Confirmed from code:** admin routes and UI from the execution update are implemented. New files live with ProductsModule rather than a separate CoursesModule; `CourseEnrollment` and all learner/public APIs remain deferred. CourseLesson writes are bounded complete replacements under actor/product locks with Product.version and atomic audit. The same endpoint returns a consistent version/lesson snapshot. Source normalization is pure, persisted IDs remain stable and removed rows stay soft-deleted. Per-route validation permits512KiB curriculum bodies while default SchemaValidationPipe limits stay32KiB; standalone and serverless JSON parsers permit512KiB and retain raw-body handling.

**Review:** a fresh-context read-only reviewer found two P2 issues: legacy raw upload requests could initiate storage for a YouTube product, and internal/history navigation could discard unsaved lessons. Added provider checks before legacy initiation, direct URL, part URL and completion calls, with a failing regression then22 focused media tests passing. The browser reproduced sidebar draft loss before the correction; the editor now uses the existing NavigationGuardProvider pattern for internal links/history plus beforeunload. Final re-review and tests are the implementer's verification, not a second independent sign-off.

**Observed verification:**

- Shared package and API builds pass (`/tmp/yt-shared.log`, `/tmp/yt-api-build.log`). Isolated web production build passes at `/tmp/web-youtube-md0ctiz_`, without copied env files (`/tmp/yt-web-build.log`). Web TypeScript and Tailwind checks pass.
- Full API run with explicit synthetic disposable `DATABASE_URL`, `ADM3_TEST_DATABASE_URL` and `YT_TEST_DATABASE_URL` passes 221 suites / 1,983 tests (`/tmp/yt-api-final.log`). One existing opt-in Redis role-workflow suite /26 tests remains skipped. Initial full-suite attempts without DATABASE_URL were environment setup failures; the explicit disposable URL resolved them.
- Ten relevant web regression scripts pass109 tests (`/tmp/yt-web-regression.log`), including strict fixed curriculum GET/PUT, safe response projection, wrong-product response rejection and all four nonadmin roles denied. No farm header is forwarded.
- The additive migration was applied only to the prior populated disposable PostgreSQL16.14 database at loopback55439, after ADM-3. Schema diff is empty (`/tmp/yt-migration.log`, `/tmp/yt-schema-diff.log`). Five new real-DB tests pass: existing INTERNAL default preserved, ordered identity/publication/rehydration, audit rollback, concurrent version conflict and removed-ID reuse denial. Existing six ADM-3 database tests pass in the final full suite. External storage/queue responses remain controlled where those tests need them.

- Full isolated production browser run passes **480 checks**, including118 new YouTube admin checks across ADMIN/SUPER_ADMIN, bn/en,320/1440px; catalog/media subtotal177 and directory171 (`/tmp/yt-browser-final.log`, screenshots `/tmp/khamar-workspace-qa-uChUPp`). Source selection/free pricing, lesson create/save/reorder/remove/reload, inline preview URL/minimum height, stale conflict retention, confirmed publication/read-only state, cancelled sidebar navigation and browser Back all pass. Inspected narrow Bangla and wide English screenshots. These are controlled API/browser checks; they do not establish actual team-video playback from YouTube on the release origin.
- A final compatibility regression reproduced failure on unscoped legacy raw-video keys being mistaken for UUID product IDs. Product lookup now applies only to UUID partitions, preserving those existing upload paths; the final API suite includes this RED→GREEN regression. The YouTube browser fixture initially used an invalid underscore in SUPER_ADMIN-derived slugs; fixed the synthetic fixture to use valid hyphens, retaining product slug validation.
- Context validation passes48 documents /324 local links /95 source entries; changed Markdown targets, new-file whitespace and `git diff --check` pass. Temporary PostgreSQL was stopped after tests. Application manifests/lockfile and root Prisma tree are unchanged; work remains uncommitted.

**Completion and rollout:** all four admin acceptance ledger items are complete locally. Broad task checkboxes above remain open where they include deferred learner functionality; no CourseEnrollment or learner/public delivery is claimed. Apply `20261015120000_youtube_course_curriculum` after ADM-3 before starting the updated API, then upgrade/drain writers/workers before the web flow. No live database migration or deployment was performed. Real YouTube playback/privacy/embedding/Referer/fullscreen acceptance with actual team-owned video links on the configured origin remains a release check. Preserve the provider-aware API for recovery; hiding UI alone does not make an old API compatible with published empty-key YouTube courses.

Suggested human-managed implementation commit: `feat(admin): add YouTube course curriculum`.

## Learner continuation — 2026-10-15

User selected “go with next” after the admin delivery. Execution baseline d8e41c3, clean checkout; retain inline execution and human-managed Git. Complete public catalog/demos, persisted free enrollment, own library and protected in-site player now; progress/certificates/paid enrollment remain deferred.

Ruling: add `GET me/courses/:id` returning the source-free course outline plus the caller's nullable enrollment. This lets direct lesson/auth-return routes offer explicit enrollment, and public details show Continue for existing members, without searching a paginated library or exposing membership publicly. It is authenticated, private/no-store, active-user and published-course checked like the other me/* routes.

- [x] Enrollment schema/shared contracts and source-safe public/member API with atomic idempotent registration.
- [x] Fixed public/protected BFF, course discovery/demos/auth-return/library/player and bilingual navigation.
- [x] Real database concurrency/rollback and controlled player/browser/security/regression verification.
- [x] Review fixes, final docs/roadmaps and release limits; no live migration/deployment/Git integration.


## Learner verification evidence — 2026-10-15

**Confirmed from code:** new additive migration `20261015150000_course_enrollment` follows the admin curriculum migration. CoursesModule uses repository projections for public outlines/cards, active own membership for protected sources, and actor→product locks for registration. Duplicate POST retries reuse one enrollment/audit, with no payment or subscription effect. Course removal/unpublication hides access without deleting membership history. Public BFF is a fixed GET table with no forwarded cookies/auth/farm headers; me/courses uses current identity, exact associations, existing CSRF rules and private/no-store responses. Course-specific identity checks do not alter legacy me/role-requests behavior.

**Review:** fresh-context reviewer found a player readiness hang after SDK resolution and a public-container policy mismatch. Added a15-second iframe readiness deadline/error/Retry and used the shared public container. The reviewer saw the readiness fix in source and independently ran the10 course boundary/player tests and diff check; final layout/browser verification is the implementer's re-review. No other material findings were returned. Player DOM is isolated under a React-owned container so official destroy/iframe replacement cannot remove React-owned children during lesson switches.

**Observed checks:**

- Shared/API builds and web TypeScript/Tailwind checks pass. Isolated production build lives at `/tmp/web-learner-courses-he9xr4oq`, with no copied env files (`/tmp/ytl-web-build.log`). No new application dependencies or lockfile edits.
- Full API regression passes223 suites /1,995 tests with explicit disposable database URLs (`/tmp/ytl-api-full.log`). One existing opt-in Redis suite /26 tests remains skipped. The suite includes five new real-PostgreSQL learner tests, seven service boundary tests and the prior admin/database regressions.
- New learner PostgreSQL tests prove source-free public projections/demo separation, concurrent idempotent registration with one audit, own-user library/playback, audit failure rollback/retry, publication withdrawal, and current-version/suspension denial (`/tmp/ytl-db.log`). Migration applied only to disposable loopback PostgreSQL16.14/adm3_test on55439; schema diff is empty (`/tmp/ytl-migration.log`, `/tmp/ytl-schema-diff.log`). No configured database migrated.
- Twelve relevant web Node regression scripts pass125 tests (`/tmp/ytl-web-regression.log`), including all six roles on own enrollment, no arbitrary userId/farm headers, public source stripping, strict route/query mapping and validated player origin/parameters. Existing navigation assertions were updated for released Courses/My courses destinations; legacy hash navigation remains covered.
- Focused controlled browser run passes53 learner checks before the strengthened explicit-after-login assertions (`/tmp/ytl-browser-focused.log`). Official player is stubbed and external frame requests blocked for deterministic error/hang/cleanup tests; screenshots verify layout only. Full final browser evidence follows below. No real team-owned video or configured-origin playback acceptance was available.

Ruling: extend the existing browser fixture/harness with `course-browser-cases.mjs` and `WORKSPACE_BROWSER_FOCUS=courses` instead of cloning the harness. The full dashboard run includes these course checks along with admin/internal media/farm/profile/auth regressions. Source-free server projections and controlled player tests do not establish DRM/privacy of YouTube links or actual external video delivery.


**Final learner acceptance:** the full isolated production browser run passes **536 checks**, including56 learner checks,118 YouTube admin checks and the existing directory/internal media/farm/profile/auth flows (`/tmp/ytl-browser-final.log`, screenshots `/tmp/khamar-workspace-qa-KSjVtl`). The strengthened sign-in case verifies no enrollment is created by login/GET, then registers only after the explicit action. Both languages and320/1440px layouts pass, as do lost-ack retry, own-library separation, lesson player cleanup, unavailable-video retry and15-second iframe readiness recovery. Inspected public mobile and enrolled desktop/mobile screenshots. Controlled playback uses a stub official API and blocked external frames; it does not claim real YouTube delivery.

Documentation context validation passes48 documents /325 local links /95 source entries; changed Markdown links, new-file whitespace and `git diff --check` pass. The temporary PostgreSQL cluster is stopped after verification. Changes remain uncommitted; no live migration/deployment/provider account writes occurred.

**Release order and limitations:** apply `20261015150000_course_enrollment` after both earlier admin migrations before deploying CoursesModule/web. Preserve enrollment rows/audit history during rollback; roll back UI/routes while retaining compatible API/schema, without dropping data. Real team-owned Public/Unlisted video playback, Referer/fullscreen/privacy on the configured release origin remains pending. One existing opt-in Redis suite /26 tests is skipped; no progress persistence, certificates, paid enrollment or general ADM-4 work was started. The requested local admin + learner free-course scope is complete.

Suggested human-managed commit: `feat(courses): add free enrollment and YouTube learner playback`.

## Dedicated admin course entry — 2026-10-15

The user requested dashboard course fields and video addition. Extend the existing admin slice with a discoverable course workspace; retain prior local/live evidence distinctions and unrelated Prisma/API URL fixes in the working tree.

- [x] Inspect product creation, curriculum editor, navigation, role gates, shared/API contracts and adjacent unit/browser checks.
- [x] Add `/admin/courses` with simple course creation and scoped course list; continue to an administrative lesson editor route.
- [x] Add dashboard/sidebar entry, bilingual copy and validated protected returns, reusing existing protected product/curriculum APIs.
- [x] Review form defaults, error/draft recovery, role boundaries, publication and existing product/media compatibility.
- [x] Verify navigation/BFF checks, real rendered admin creation/lesson saving/reload in bn/en at 320/1440px, type/style checks and isolated production build.
- [x] Inspect screenshots, re-review final diff, update roadmap/context and record exact evidence/remaining live limits.

Scope: frontend discoverability/forms using existing APIs. No live account writes, migration/deployment, payment/progress/certificate work or Git integration.

**Compatibility finding:** broader catalog regression reached the existing managed upload flow and reproduced a 404 at `/admin/media/uploads/[id]`. Both the working tree and HEAD had only the media inventory page, despite a complete `AdminMedia id` detail component and existing links/return allowlist. The global `uploads/` ignore rule also excludes this source path. Restore the small UUID-validated page wrapper and add a source-only ignore exception so the expected existing route remains reviewable/versioned. This adds no media API or upload/provider behavior. Re-run the catalog regression after the repair.

### Dedicated entry verification and completion

**Confirmed from code:** administrative Courses and personal My courses are distinct. The course-only form reuses ProductForm with three labeled inputs and fixed VIDEO_COURSE/YOUTUBE/free defaults. It continues to the course editor after a successful create; failed creation retains input. The course list always sends both provider/type filters and supports existing search/publication/cursors. The alias editor shows the selected course name, preserves existing save/version/draft guards and links back to management and publication. UUID validation, middleware, current-role gates and the existing BFF enforce access. No API/shared contract/schema/dependency changes were needed.

**Review:** added the selected course name so administrators can identify the curriculum before editing. Replaced the course-only form's subscription-tier explanation with a draft/next-step hint. The compatibility regression above is RED→GREEN after restoring the missing upload-detail wrapper. A manual ignore check confirms runtime `uploads/` remains ignored while only the administrative route source becomes visible to Git. Final self-review found no unresolved issue in the new entry/form/editor path; it is not an independent external audit.

**Observed verification, Windows / Node 24.9.0 / Chrome:**

- From `apps/web`, `node --test scripts/check-workspace-navigation.mjs scripts/check-protected-routes.mjs scripts/check-admin-catalog.mjs scripts/check-admin-dashboard.mjs scripts/check-youtube-courses.mjs` passes **62 tests**. Added role-separated course navigation/validated returns and provider/type-filter forwarding coverage; existing nonadmin denial remains exercised.
- `node --test scripts/check-auth.mjs scripts/check-workspace.mjs scripts/check-admin-directory.mjs scripts/check-api-diagnostics.mjs` passes **35 tests**. `pnpm --filter @vetralink/web test:styles` passes **12 tests**. Total Node checks: **109 tests**, zero skipped/failing tests.
- Web `tsc --noEmit --incremental false` passes. Final isolated production build also passes type validation and all 34 generated pages, including both course routes and the restored media detail route. Artifact: `G:/projucts/vetralink-live-api-check-df76d1512e334fd59829a3ce277e388a` with linked existing dependencies and no real env files. Production build/guard ran on a copy with only the unchanged Tailwind entry's CRLF normalized to LF; the user's running `.next` directory was untouched.
- Root `pnpm --filter @vetralink/web check:styles` still reports the previously established CRLF comparison issue in unchanged `globals.css`. The isolated LF copy passes the actual guard. No stylesheet rules or guard policy were changed, and the original check is not claimed passed.
- With `CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe`, `WEB_TEST_BUILD_DIR` pointing at that isolated build and `WORKSPACE_BROWSER_FOCUS=admin-courses`, `node scripts/check-dashboard-browser.mjs` passes **165 checks**. This covers ADMIN/SUPER_ADMIN, bn/en, 320/1440px, dashboard entry, labeled creation/defaults, invalid slug, failed-create draft retention/retry, video/demo saving/reload/reopen, scoped search, publication/read-only and all four nonadmin roles denied. Initial screenshots: `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-csyPwj`.
- Final `WORKSPACE_BROWSER_FOCUS=catalog` run against the final build passes **342 checks**, including **118 existing YouTube admin** and **165 new workspace** checks, plus existing product/media upload/processing/attachment/retry behavior. Log: `.tmp-admin-course-catalog.log`; final screenshots: `C:/Users/asus/AppData/Local/Temp/khamar-workspace-qa-Y7OAaC`. The earlier run failed specifically at the missing upload-detail route and was rerun after the wrapper repair. All upstream writes use the controlled synthetic fixture; no live account/content writes occurred.
- Inspected rendered Bangla 320px creation/video forms and English 1440px creation/list screenshots. No clipping/overflow was found. User-authored synthetic course/lesson text is deliberately not auto-translated. These are Chrome viewport checks, not real mobile-device or alternate-engine certification.
- Context validation passes 48 documents / 329 local links / 95 source entries; `git diff --check` passes. Temporary browser/Next/API fixtures were stopped by the harness.

**Local completion and live limits:** the requested admin course input/video workflow is complete locally, with existing product/media behavior verified after the route repair. A fresh read-only request to the supplied live `/api/v1/courses?limit=1` still returns HTTP 400 `DATABASE_ERROR` / `Database query constraint violation.` Its actual Prisma cause remains unconfirmed; this task did not migrate the live database, deploy the source or exercise real-account saves/real YouTube playback. Keep the earlier release order and provider/database acceptance requirements. Git index/history writes remain human-managed.

Suggested human-managed commit: `feat(admin): add dedicated course creation and video workspace`.

**Subsequent Courses 400 diagnosis, 2026-10-15:** live runtime log and read-only configured-database queries now confirm missing product/course schema, with P2022 for `products.content_provider` / `products.version` and all three 20261015 media/curriculum/enrollment migrations pending. This supersedes the earlier unconfirmed-cause limitation. [Full diagnosis and prepared production repair](../../tasks/web-live-api-routing/plan.md) record the evidence; no production migration was executed during the diagnostic request.

**Authorized live database repair, 2026-10-15:** the user then authorized the necessary repair. All three migrations are now applied to the configured live database after a restricted backup was restored and rehearsed on disposable PostgreSQL 18. Ten existing real-database admin/learner tests pass there; production has 27 applied migrations, none pending/failed, no Prisma schema difference and matching fingerprints for all 34 original tables. Live public course GETs and the running local web course BFF now return HTTP 200. [Deployment and recovery evidence](../../tasks/web-live-api-routing/plan.md) supersede the earlier migration/database-error limitation. No source deployment or real-account course save/YouTube playback is claimed.
