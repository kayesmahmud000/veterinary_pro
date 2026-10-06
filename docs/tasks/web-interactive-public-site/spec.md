# Interactive public website specification

Status: Verified (local public-site scope)
Started: 2026-10-06; verified: 2026-10-07

## Outcome and scope

Make the existing public website modern and useful to explore: visitors choose their goal, try a clearly labeled sample farm workspace, estimate milk output/value, explore the connected workflow and find relevant answers. Preserve the existing forest-green, warm-paper identity and all four public URLs.

## Current implementation

**Confirmed from code:** `LandingSections` renders an illustrative farm, three working service links, static workflow and native FAQ. `ProductOverview` renders three descriptive cards per service. Bangla-default localization, public navigation and availability notices already exist. No public operational dashboard, booking, catalog or checkout exists. See [public-site spec](../../features/web-public-site/spec.md) and [localization spec](../web-localization/spec.md).

## Design and roles

Frontend/Web Engineer and UI/UX Designer implement small client components inside the server-rendered marketing shell. Code Reviewer, UI Reviewer and QA perspectives check behavior after implementation. No additional dependency, external font, image service or API is needed. Use ordinary labeled buttons with selected states and native form/accordion semantics. Keep marketing content visible on initial render.

## UI contracts

- Hero goal choices change supporting copy, preview and the service destination; the main heading remains stable. A separate anchor reaches the working sample demo.
- The hero is a full-width, viewport-height banner with three locally bundled, natural farm photographs: a cow with its herd, two goats, and a person gently touching a cow. The active photo, short localized caption and service destination stay synchronized. Photo thumbnails and previous/next buttons offer manual control; navigation wraps, carries localized alternative text, has a visible position indicator, does not auto-rotate, and respects reduced-motion preferences.
- Sample workspace supports animal selection, milk projection and finance views. Animal/finance values are fictional and explicitly labeled. There is no save action or clinical advice.
- Milk calculator accepts Bangla/ASCII digits, one decimal separator, finite nonnegative quantities up to 10,000 liters/day and prices up to BDT 10,000/liter. Blank, malformed, negative and excessive input produce translated field errors and no stale result. Zero is valid. Select 7 or 30 days; projected liters = daily liters × days, value = liters × price. Label constant-yield assumptions and no data storage. Input persists while switching views, reset restores examples.
- Clickable workflow steps reveal a different localized record example. Feature explorers on the three service pages reveal existing descriptive content and meaningful per-feature highlights; farm page links to the homepage demo.
- FAQ search filters question and answer text, announces result count and supports empty-result recovery. Native disclosure remains accessible. Demo availability is answered explicitly.
- All new visible and assistive copy comes from typed Bangla/English catalogs. Units, currencies and calculated values follow locale.

## Boundaries and edge cases

No auth, tenant, API, database, payment, medical writes or persistence changes. Do not fabricate testimonials, customer counts, prices for real products, credentials, contacts or available bookings. Public demos execute locally after hydration; no operational offline support is promised. Each selection uses keyboard-accessible controls, visible focus, non-color cues and touch targets of at least 44px. Avoid heavy slider dependencies, auto-rotation and continuous animation. The three original animal photos are sourced from [Unsplash](https://unsplash.com/license) under its free license and are stored locally so the hero does not rely on a third-party image request at runtime:

- Cow with herd: [Unsplash photo](https://unsplash.com/photos/black-and-white-cow-on-green-grass-field-during-daytime-31zGUjQzqWY)
- Goats: [Unsplash photo](https://unsplash.com/photos/brown-and-white-goats-AlfgSap679Y)
- Gentle cow care: [Unsplash photo](https://unsplash.com/photos/a-hand-touching-a-cows-nose-8r3qx9smZvU)

## Acceptance and rollout

- Production web build and existing localization smoke pass.
- Meaningful calculator boundary tests cover Bangla decimals, zero, 7/30-day calculations, malformed values and bounds.
- Rendered checks in both languages cover goal destinations, all demo views, animal selection, projection errors/recovery, reset, workflow/features, FAQ search/no-results, mobile navigation and language persistence.
- Inspect 375px and desktop, 200% zoom/narrow 320px, keyboard and reduced motion; no horizontal overflow or clipped controls.
- Keep local browser profiles outside the repository; record only concise verification evidence in the plan. No Git mutation or deployment. Reverting these frontend changes restores the previous public pages without data migration.
