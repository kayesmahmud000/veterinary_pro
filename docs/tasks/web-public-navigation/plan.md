# Public discovery expansion implementation plan

**Goal:** implement the approved bilingual navigation and public content routes.
**Architecture:** server-rendered pages use the existing locale cookie/catalog. Blog is local bilingual editorial content; doctors use a strict published-only curated data source. Small client navigation components own only menu disclosure state.
**Stack:** existing Next.js 14, React 18, TypeScript, Tailwind 3, Zod and Lucide.
**Spec:** [spec.md](spec.md).
**Execution:** inline with `executing-plans`; changes stay in the user's existing checkout. No Git mutations. User-authorized shadcn dependencies are the only package additions. Temporary build/browser fixtures live under `/tmp`.

## Constraints and review focus

Preserve existing URLs and Bangla-default locale. Use Tailwind only; explicitly marked user-authorized fictional clinician demos and no invented contact details, no private backend data or booking claims. Review unpublished/unknown IDs, malformed/repeated filter queries, bilingual text lengths, dropdown clipping/keyboard dismissal, and no-JavaScript navigation. The user selected two dummy frontend profiles; real doctor content remains pending.

## Tasks

### 1. Content and public data contracts

Files: `src/lib/public-content.ts`, `src/lib/doctor-directory.ts`, `src/content/doctors.json`, `src/content/README.md`, `src/lib/i18n/public-pages.ts`; modify bilingual catalogs/navigation labels. Tests: `scripts/check-public-content.mjs`.

- [x] Add behavior tests for blog search/topic/unknown slug and doctor published-only search/detail/schema behavior; run before implementation.
- [x] Implement bilingual editorial articles, strict curated doctor data and pure lookup/filter functions; expose stable signatures to pages.
- [x] Verify focused data tests and review content/projection boundaries.

### 2. Public pages

Files: new route pages in `(marketing)/blog`, `about`, `help`, `doctors`; shared public-page and directory/article components under `components/marketing`.

- [x] Implement semantic list/detail pages, GET filters, real about/help copy, localized metadata/date/empty states and 404s.
- [x] Verify production types and HTTP behavior, with published/draft fixture behavior covered by the pure data tests.

### 3. Navigation

Files: `lib/public-navigation.ts`, desktop/mobile navigation components, header/footer, `lib/ui/site.styles.ts`, brand/auth breakpoint compositions.

- [x] Add localized groups and direct footer links, dropdown dismissal/focus behavior and mobile nested navigation.
- [x] Verify keyboard, outside click, route/resize/no-JavaScript access and bilingual responsive layout.

### 4. Verification and handoff

- [x] Run focused suites, `check:styles`, `test:styles`, isolated production build, existing localization regression and new public-route/browser checks.
- [x] Review final changes, fix relevant findings, update web roadmap/context and record results here. Request a fresh reviewer per execution skill; preserve human-managed Git policy.
- [x] Final diff/whitespace review and concise handoff with content limitations and suggested commit.

## Evidence

Implementation verified locally on 2026-10-08; final build/HTTP replay recorded below. API vet profile/controller inspection confirms protected clinical/account data is unsuitable as a public directory source. The user expressly requested one or two dummy frontend records; two published `isDemo` records are visibly identified and marked noindex.

- RED/GREEN: real TypeScript data tests initially failed before the content/navigation modules were implemented; `node apps/web/scripts/check-public-content.mjs` passes 5 cases, including draft omission, missing/duplicate/invalid IDs, private-field rejection, translations, local portraits and malformed/repeated filters. Published/draft fixtures are exercised at the data boundary, not a live API.
- `check:styles` and `test:styles` pass (policy and actual Tailwind compilation). Existing planner/auth/workspace focused regressions pass; this change makes no backend mutation.
- An isolated copy at `/tmp/web-public-discovery-eikgv7_1` reuses installed dependencies and builds with `NODE_ENV=production`; production compilation/type validation passes. Tests run on port 3100 with `API_BASE_URL=http://127.0.0.1:9/api/v1`, never a live upstream. The user's `.next`/dev server is untouched.
- `node apps/web/scripts/check-localization.mjs http://localhost:3100`: 80 bilingual/default/invalid-locale GETs, 60 native language-form submissions, persistence, concurrent locale isolation, unsafe return paths, existing guide filters and CSV checks pass.
- `node apps/web/scripts/check-public-navigation-browser.mjs http://localhost:3100`: 85 Chrome checks pass: seven routes in both languages at 360/768/1024/1280/1440 CSS pixels, keyboard Enter/Escape, outside-click/focus/resize dismissal, search/filter reset including Next Link navigation, no-JavaScript links and 720-CSS-pixel / 2x device-pixel reflow. This reflow check approximates 200% viewport behavior; actual native zoom and other browser engines are not certified. Screenshots: `/tmp/public-navigation-chrome-W1kqNQ/screenshots`; Bangla mobile/desktop and English desktop reviewed.
- Independent reviewer identified two reproduced UI issues: unsent filter values surviving clear/client navigation and mobile Escape after focus leaves the menu. Native reset links, keyed forms, document Escape and focus-exit dismissal fix them; browser regressions pass.
- Next 14's thrown dynamic `notFound()` produced an error document without the cookie-localized HTML shell. Narrow blog/doctor middleware assigns missing detail responses HTTP404 while the page renders localized recovery normally. Both status and SSR landmarks/lang are asserted; native language actions still redirect303. Review additionally caught raw percent-encoded pathname versus decoded route params: guarded decode fixes the mismatch, with encoded-known-ID regression checks. Missing details have noindex metadata. Other routes/auth/protected data are outside the middleware matcher.
- Manual content publication is documented in `src/content/README.md`; no CMS, backend doctor synchronization or appointment flow is implemented. Deployment, real clinician content, external providers and alternate-browser acceptance remain outside this scope.

Final replay: production build/type validation passes after guarded URL decoding; `check-public-pages.mjs` passes 60 bilingual checks, including encoded known IDs and localized SSR404/noindex. `check-localization.mjs` again passes 80 GETs/60 language forms. Context validation passes (48 documents, 300 links, 89 source entries); `git diff --check` passes. Temporary production server stopped; no Git staging/commit/merge/push performed.

## Course navigation follow-up

- [x] Inspect existing learning content/navigation and add bilingual course destination plus the existing learning-section anchor. Preserve previous changes.
- [x] Verify content/style/build checks and bilingual browser course navigation/responsive layout; update context and final evidence.

Course follow-up verification: 5 real content/navigation tests, style guard and both style suites pass. Isolated production build/type validation passes. Extended Chrome run passes 99 checks, including both-language course-link navigation to the existing section and learning-page layout at all five widths. Screenshots: `/tmp/public-navigation-chrome-TpyhNT/screenshots`. Context/whitespace checks pass; temporary server stopped. Suggested commit: `feat(web): add bilingual courses navigation`.

## Active navigation follow-up

- [x] Implement shared route/hash matching and a small location hook; add active styling to desktop triggers/links and mobile summaries/links.
- [x] Verify nested routes, hash transitions/back navigation, bilingual responsive menus and focus behavior; record fresh checks.

Active navigation evidence: matching regression initially fails for missing helpers, then all 6 content/navigation cases pass. Isolated production build/type validation and style guard/suites pass. Chrome passes 103 checks in both languages, including actual computed theme-green active backgrounds at five widths, blog/doctor detail grouping, same-page Courses/Guides changes and browser Back, plus existing keyboard/dismissal/filter-reset/no-JavaScript regressions. Desktop Bangla screenshot reviewed at `/tmp/public-navigation-chrome-zcRYqn/screenshots/doctors-bn-1440.png`; temporary server stopped. Back restoration is directly tested; Forward follows the same popstate handler but was not separately asserted. No footer client conversion or backend change.


## Active text color correction

- [x] Replace active backgrounds and underlines with dark-amber text on desktop, submenu and mobile controls; use amber for the homepage overlay group and retain ARIA semantics.
- [x] Verify computed active text/background styles in both locales at all existing browser widths, run the style guard and production build, and review a screenshot.

Text-color correction verification: isolated production build/type validation, Tailwind policy guard and both style suites pass. Six existing content/navigation tests pass. Chrome passes 107 checks, including dark-amber text, transparent backgrounds and no underline at five widths in both locales; homepage overlay/scrolled text colors, hash/history and existing navigation regressions also pass. Screenshot review found theme green too close to default ink, so the final text uses the existing dark-amber focus accent (`#a26913`). Final Bangla desktop screenshot reviewed at `/tmp/public-navigation-chrome-bSgjbe/screenshots/doctors-bn-1440.png`. Browser helper now includes the hash when checking page URLs. Context validation and whitespace checks pass; temporary server stopped. Suggested commit: `fix(web): use text color for active navigation`.
