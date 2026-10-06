# Hero autoplay plan

Spec: [spec.md](spec.md)

- [x] Inspect current slider, responsive controls and bilingual message boundary.
- [x] Add six-second rotation with interaction/visibility lifecycle and translated Play/Pause controls.
- [x] Review timer cleanup, reduced motion, announcements and mobile controls.
- [x] Build and verify real browser timing, both locales, responsive states and navigation cleanup.
- [x] Re-review, update context and record actual evidence.

**Build/static — passed, 2026-10-07:** production `pnpm exec next build` in an isolated same-drive copy (avoids the active dev cache); compile, types, generation and traces completed. Targeted Prettier and `git diff --check` passed. `python -X utf8 .context/scripts/validate.py` passed (48 documents, 272 links, 74 source entries).

**HTTP — passed:** `pnpm --filter @vetralink/web test:localization` against local production port 3100: 36 localized GETs, 27 native forms, persistence/isolation, unsafe returns, catalog filters and localized CSV/404 checks.

**Observed browser behavior — passed:** Windows Chrome 154 via CDP, real timers. Rotation followed 0→1→2→0, with successive measured intervals of 5960ms and 6019ms; exactly one selected photo and the matching CTA remained synchronized. Pause held beyond 6.6 seconds; Play resumed after a fresh interval while retaining button focus. Hover, native keyboard selection/focus, off-screen hero and active hidden-page lifecycle all suspended rotation and resumed correctly. Reduced motion started paused with no photo transition; changing the preference stopped playback, and explicit Play remained functional. Automatic live regions were off and paused/manual regions polite.

Both locales passed all three slides at 1440/1024/768/375/320px, including 320×568: gutters/header/carousel clearance, no horizontal overflow, visible 44px playback control and non-overlapping thumbnails. Bangla autoplay and native Space pause passed. Desktop/mobile screenshots and fully loaded thumbnail evidence were reviewed.

Navigation away unmounted the hero; Back restored working rotation. An initial timing assertion incorrectly started after a 600ms post-navigation wait; measuring from actual hero readiness passed at 6046ms. The existing dev preview on port 3000 also passed real autoplay and overlay/CSS checks. No application runtime exceptions were observed; canceled navigation requests and the dev-tools notice were present.

**Re-review:** timer cleanup, observer/media/visibility teardown, functional wraparound updates, explicit playback/focus behavior, localized labels and responsive controls checked. Existing hero/header and earlier uncommitted work preserved. Context updated. Evidence is local Chromium emulation, not physical-device or cross-browser certification. Temporary build/profile removed after checks; browser artifacts stay in OS temp, `.gstack` remains absent and Git remains human-managed.
