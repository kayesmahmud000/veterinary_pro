# Web localization implementation plan

Spec: [Bangla and English localization](spec.md)
Scope: Bangla-default localization of the existing public website and roadmap requirements.
Status: **Verified — 2026-10-06**

## Steps

- [x] Inspect project instructions, roadmaps, public-site source and existing verification.
- [x] Define default locale, server rendering, persistence, translation coverage and compatibility.
- [x] Add typed bilingual catalogs, locale/formatting helpers and a validated preference action.
- [x] Translate pages, shell, accessibility, metadata and recovery; add responsive language selection and Bangla typography.
- [x] Review implementation for content coverage, cookie isolation, keyboard behavior and layout regressions; fix findings.
- [x] Run build and behavioral/browser checks in both languages, including invalid preference, refresh/navigation, 404 and no JavaScript.
- [x] Re-review final changes, update roadmap/context and record results.

## Verification evidence

Commands run from repository root unless otherwise stated. No staging, commits, pushes or deployment.

| Check | Expected | Actual |
| --- | --- | --- |
| `pnpm --filter @vetralink/web build` with `NODE_ENV=production` | Compilation and localized routes succeed | Passed; final isolated source build below also passed after the mobile label fix |
| `pnpm --filter @vetralink/web exec next build G:/projucts/veterinary/build/web-localization-qa` with `NODE_ENV=production` | Final source compiles without a concurrent dev build conflict | Passed; all four public pages and 404 are request-rendered; shared first-load JS 87.3 kB |
| `pnpm --filter @vetralink/web exec next start G:/projucts/veterinary/build/web-localization-qa -p 3100` with `NODE_ENV=production` | Isolated production runtime | Passed; used for the following checks and stopped after verification |
| `pnpm --filter @vetralink/web test:localization` | Default/fallback Bangla; English persistence; localized metadata; 404 | Passed: 20 localized GETs, 15 native form submissions, reload persistence, concurrent locale isolation and five unsafe redirect checks |
| `node node_modules/.cache/localization-browser-check.mjs` | Both languages remain usable | Passed after final fix: 30 page/language/viewport combinations (five page states × two languages × 360/768/1440 widths), 44px language targets, keyboard switching, path/query preservation, refresh/navigation persistence, menu Escape/focus/resize, FAQ, 200% CSS zoom, no-JavaScript switching and no external/API requests |
| Screenshot review | Readable Bengali glyphs and unclipped labels | Passed: mobile/desktop Bangla/English captures reviewed; corrected mobile illustration clipping and rechecked final captures |
| `python -X utf8 .context/scripts/validate.py` | Valid context and source anchors | Passed: 48 documents, 263 links, 74 source entries |
| `git diff --check` | No whitespace errors | Passed |

## Review findings and environment

- **Observed behavior:** initial native language submission set the cookie but rendered the old language until reload on Next.js 14.2.35. Fixed by redirecting to the validated current path/query after setting the cookie. The regression now passes for all four pages and 404 recovery; invalid locales do not set cookies, and five unsafe return-URL inputs fall back to home.
- **Observed behavior:** mobile illustration labels were partly clipped by the rounded illustration border. Moved the mobile label downward to keep it inside the visible illustration; final rebuild, browser rerun and screenshot review passed.
- **Observed environment limits:** sandbox build workers failed with `spawn EPERM`; authorized builds ran outside the sandbox. The first unrestricted build mixed development and production React runtimes; explicitly setting `NODE_ENV=production` resolved it. A concurrently rewritten `.next` directory caused missing runtime chunks. Final runtime checks use a copied source tree at `build/web-localization-qa` (ignored build artifacts), with a junction to existing dependencies. No user development process was stopped.
- The attempted dependency-cache copy was excluded by Next.js's TypeScript loader; a copy on another Windows drive hit Next.js path resolution errors. The isolated build on the repository's drive passed. These are verification environment failures, not passing checks.
- Browser scope: isolated headless Chrome 154 on Windows, Node 24.9.0, pnpm 10.18.3, Next.js 14.2.35, production server on local port 3100, API stopped. Temporary CDP check/screenshot artifacts live under `node_modules/.cache/`. This is one browser with viewport emulation and CSS zoom, not physical-device or cross-browser certification. No new production dependency, API integration, migration or deployment.

## Review and completion

Acceptance criteria met for the existing public website. Bangla is the default; English is selectable and persists through a validated cookie, with complete server-rendered copy/metadata and localized numbers. Self-review found and fixed the stale-language native response and clipped mobile illustration label. Final code/UX review found no unresolved in-scope material issue. Roadmap WEB-L1 is complete; bilingual application/release acceptance remains required in the owning future milestones. Separate language URLs/hreflang, future application features and cross-browser/device certification are not claimed.

Updated the public-site requirement supersession, root/web roadmap, docs guide, client architecture, UI/testing context and source manifest. No dependency/lockfile changes, backend/mobile writes, staging, commits, pushes or deployment. Suggested commit: `feat(web): localize public website in Bangla and English`.
