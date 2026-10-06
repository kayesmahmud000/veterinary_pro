# Hero/header implementation plan

Spec: [spec.md](spec.md)

- [x] Read shared UI rules and current photo-hero/header source; preserve existing local changes.
- [x] Identify flex growth overriding the constrained hero width and define overlay/scroll contracts.
- [x] Implement hero gutters/clearance and route-aware navbar surface/styles.
- [x] Review contrast, fixed-header anchors, mobile dropdown and listener cleanup.
- [x] Keep the hero demo anchor in Next.js history; verify page and header restoration after leaving it.
- [x] Build, run localization checks and inspect desktop/mobile/keyboard states in both languages.
- [x] Correct findings, re-review and record verification/context changes.

## Evidence

**Static/build — passed, 2026-10-07:** `NODE_ENV=production; pnpm exec next build` compiled, checked types, generated pages and completed traces in an isolated same-drive copy under the ignored repository `.next` directory. The first in-place build conflicted with the existing dev server cache; a first OS-temp copy also hit a cross-drive Webpack resolution error. Neither failed attempt is counted as a pass. The final build was repeated after the navigation correction. Dev preview on port 3000 was restarted and its CSS/hero/header checked successfully. No dependency changes.

**HTTP — passed:** `pnpm --filter @vetralink/web test:localization` against the final local production preview on port 3100: 36 localized GETs, 27 native form submissions, persistence, concurrent locale isolation, five unsafe return URLs, 12 catalog filters, four localized CSV downloads and two missing-template checks.

**Rendered browser — passed:** local Windows Chrome 154 through CDP; Bangla and English at 1440/1024/768/375/320px. 270 layout/state assertions checked all three photos and CTA destinations, initial transparent/fixed header, photo starting behind it, header clearance, 24px minimum content/carousel gap, gutters, 44px controls, no horizontal overflow, white scroll state, stable height/content position and transparent return. Actual text gutters: 112.5px at 1440, 48px at 1024 and 20px below 800. Additional all-slide checks at 320×568 passed in both locales (35px header clearance, at least 42px carousel clearance). Loaded desktop/mobile photo screenshots were inspected; initial cold image-optimizer captures were replaced by loaded-photo evidence.

**Navigation/keyboard — passed:** reload at a restored scroll position, native Space opening the mobile menu, readable white dropdown/dark links over both navbar surfaces, Escape closing/restoring focus, and demo anchor clearing the pinned header. Review found the native hero hash anchor created a history entry without Next.js state: after a route change, Back restored the URL while leaving the prior page visible. Replacing it with the existing Next.js Link boundary fixed the reproduced failure. Final Bangla/English checks passed anchor → learning → Back to scrolled home → transparent top → Forward to learning. Browser logs had canceled navigation requests and no application exceptions.

**Re-review:** localized navigation remains server composed; only route/scroll surface state moved into a small client wrapper. Passive scroll/pageshow listeners are removed on cleanup. The menu retains independent state and existing focus behavior. Shared header-height clearance and reduced-motion rules were reviewed. Existing photo carousel, sample farm, guides and earlier uncommitted work are preserved. Context links describe the implemented behavior.

**Repository checks — passed:** targeted Prettier check for the three changed components and two stylesheets; `git diff --check`; `python -X utf8 .context/scripts/validate.py` (48 Markdown documents, 270 local links, 74 source entries). Final loaded-photo screenshots at 1440×900 and 375×667 on the restored dev preview were reviewed.

Evidence is local Chromium/device emulation, not physical-mobile or cross-browser certification. Browser commands/screenshots remain in OS temp; isolated build/dependency junctions are removed after testing. `.gstack` remains absent. Git stays human-managed.
