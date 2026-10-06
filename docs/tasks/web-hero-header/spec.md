# Hero spacing and overlay navigation

Status: Complete — 2026-10-07; local verification recorded in [plan.md](plan.md).

## Requested outcome

Give the current photo hero balanced left/right gutters and responsive text/control spacing. Extend its image to the top of the homepage behind a transparent navbar. When the visitor scrolls, keep navigation at the top with an opaque white background; returning to the top restores transparency.

## Contracts and scope

- Preserve the existing manually selected photos, bilingual copy, carousel, CTAs and public routes.
- Constrain the hero container instead of allowing flex growth to consume its gutters. Reserve header-height clearance above content and room below for carousel controls at 320px, 375px, tablet and desktop widths.
- Homepage header overlays the hero from the first server render, with readable light navigation, transparent controls and visible keyboard focus. After 16px of scroll, show white background and dark text without changing header height or shifting content.
- Inner pages and 404 retain an opaque in-flow sticky header. Keep server-rendered navigation/language forms inside a small client surface that owns route/scroll state, synchronizes restored scroll and removes listeners on unmount.
- Mobile dropdown remains opaque and readable in both navbar states. Anchors and focused controls must clear the pinned header. Honor reduced motion.

No dependency, image replacement, API, account, persistence, deployment or Git mutation. Preserve uncommitted work and keep browser profiles outside the repository; `.gstack` stays absent.

## Acceptance

Production build and existing localization checks pass. Inspect both locales in a real local browser at 1440/1024/768/375/320px, all slides, top/scroll/return, route/history transitions, mobile menu and keyboard. Verify gutters, no content/header/carousel overlap, no horizontal overflow and no layout jump when the header changes state. Record actual evidence in the plan.
