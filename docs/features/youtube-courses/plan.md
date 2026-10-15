# YouTube Courses Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan inline, task by task. This is a planning-only handoff; do not start implementation from the existence of this file.

**Goal:** Let visitors watch public course demos and active users freely enroll and watch YouTube lessons inside the website.

**Architecture:** Product remains the course master, with an explicit INTERNAL/YOUTUBE provider. Ordered CourseLesson rows and own CourseEnrollment records provide curriculum and site membership; official embeds handle video playback. Separate public demo and authenticated lesson endpoints prevent source leakage through the catalog.

**Tech stack:** Existing NestJS, Prisma/PostgreSQL, shared Zod/TypeScript, Next.js14/React, Tailwind and official YouTube IFrame API. No new runtime package required.

**Spec:** [spec.md](spec.md). Baseline: 82d857a plus uncommitted ADM-3. Status: **Proposed; implementation not started.**

## Global constraints

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

**Not performed:** implementation, runtime tests for this feature, new migrations or deployments. All implementation checkboxes remain open; historical ADM-3 evidence does not establish YouTube-course readiness.

**Observed documentation validation, 2026-10-15:** `.context/scripts/validate.py` passes (48 documents / 324 local links / 95 source entries). Local Markdown target checks across the eight planning/context documents pass, as do new-file whitespace/placeholder checks and `git diff --check`. Application tests were not rerun for this documentation-only planning task. Roadmaps/context label the feature proposed, retain ADM-3's local evidence and keep ADM-4 unstarted.

Suggested planning commit: `docs(courses): plan YouTube demos and free enrollment`.
Suggested eventual implementation commit: `feat(courses): add YouTube lessons and free enrollment`.
