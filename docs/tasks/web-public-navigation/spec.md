# Public navigation, blog, about, help and doctor profiles

User-approved scope: 2026-10-08 chat design, followed by “implement koro”. Parent: [public site](../../features/web-public-site/spec.md), [localization](../web-localization/spec.md), and [web roadmap](../../../apps/web/ROADMAP.md).

## Outcome

Visitors discover farm management/demo, learning/guides, veterinary services/doctors, blog, about and help through bilingual desktop dropdowns and a responsive mobile menu. Existing account navigation remains permission-specific.

## Implementation contracts

- Preserve existing URLs and Bangla-default cookie localization. Every new heading, form, empty state, assistive label and metadata is bilingual. Logo and metadata localization changes already in the working tree are retained.
- Add `/blog`, `/blog/[slug]`, `/about`, `/help`, `/doctors`, `/doctors/[id]`. Blog supplies original bilingual editorial articles on organizing farm records, weekly reviews and preparing a useful record summary. Display editorial attribution and publication date (Asia/Dhaka), related posts, query search and topic filtering. Unknown slugs return 404.
- About explains the platform's purpose, audience and currently available capabilities without invented staff, statistics or endorsements. Help reuses current FAQ and gives working demo/guide/account-entry steps, without invented contact addresses.
- **Confirmed from code:** no public doctor directory exists; current protected vet DTOs include user/email/availability data. Do not expose them. Store expressly published editorial profiles in `src/content/doctors.json`, with two clearly labeled fictional demo records expressly authorized by the user. Validate bilingual names, biography, qualifications, location, specialties, years of experience and optional local portrait. Public list/detail functions exclude unpublished records. Search and specialty filters retain URL state; unknown or unpublished IDs return 404. Fictional doctor profiles are permitted only with `isDemo: true` and explicit demo labels/notices. No real booking availability or ratings are invented.
- Publication is manual source editing, documented alongside the data. No CMS/admin editor or automatic backend sync is included. Approved profile data is a content prerequisite, not inferred from VET account status.
- Header: farm, learning and veterinary groups plus blog/about/help. Submenus expose overview/demo, overview/guides, overview/doctors. Footer exposes direct useful links. Native semantics, keyboard focus, Escape/outside-click dismissal, route-close, no-JavaScript link access and responsive layouts are required.
- Use existing Tailwind tokens/compositions only. The user subsequently authorized shadcn/ui; manually integrate NavigationMenu, Button, Card, Badge and Input with Radix navigation/Slot and CVA dependencies. No backend/database/session/financial/clinical changes. Pricing, paid catalog and booking remain their existing milestones.

## Acceptance

1. All new list/static/blog routes render real bilingual content and localized brand-bearing titles/descriptions. Invalid locale falls back to Bangla; no dead navigation targets.
2. Blog search/topic filtering works through GET URLs; valid posts have full text/date/author/related links, unknown slugs 404.
3. Doctors show two explicitly marked demo profiles and a truthful empty state when no records are published. Valid published fixture profiles render list/detail data; drafts remain inaccessible, local images are optional, malformed publication data is rejected.
4. Header/mobile/footer links work from every route; keyboard, Escape, outside-click, resizing, no-JavaScript access and 360/768/1024/1440-width/zoom behavior are checked in both locales.
5. Focused data tests, style guards/tests, isolated production build, localization and new-route HTTP/browser checks pass. Preserve unrelated changes and human-managed Git policy. Record limitations honestly.

## Course navigation follow-up (2026-10-08)

User requested a course navigation entry. Add a separate localized `কোর্স / Courses` header/mobile/footer/no-JavaScript destination at `/learning#courses`, using the existing learning-plan section. This is navigation to currently described course plans; it does not implement course catalog, purchasing or enrollment. Verify the live anchor, both locales and the extra desktop item at the 1280px breakpoint.

## Active navigation follow-up (2026-10-08)

User requested a distinct active navigation color. Per the follow-up request, change only the text color of the current header/mobile destination: dark amber (`#a26913`, existing focus accent) on light surfaces and amber for the active desktop group on the unscrolled homepage overlay. Add no active background or underline; retain normal hover/open states and ARIA current-page/location semantics. Match exact routes and path-boundary descendants (`/blog/[slug]`, `/doctors/[id]`, learning guides). Highlight the veterinary group for doctor profiles and the learning group for guides. Section links require exact hashes; `/learning#courses` highlights Courses rather than the learning overview. Observe native/hash/Next Link navigation and browser history, preserving menu dismissal and ARIA current-page/location semantics. No footer client conversion or backend changes.
