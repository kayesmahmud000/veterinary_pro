# Web Tailwind Migration Implementation Plan

> Implement in the requested `dev-fontend` checkout. User requested end-to-end migration; proceed within that authorization. Preserve the repository's human-managed Git policy.

**Goal:** Tailwind-only web styling with shared agent guidance and automated enforcement.
**Architecture:** Tailwind 3.4/PostCSS generates styles from components and reusable static utility strings. The global CSS entry contains layer directives only. Existing UI behavior and geometry remain the contract.
**Tech stack:** Next.js 14, React 18, TypeScript, installed Tailwind 3.4, PostCSS, Node tests and Chrome CDP.
**Spec:** [spec.md](spec.md).

## Review focus

- Preserve inner dimensions and media-query boundaries; apply the requested shared `w-11/12` width at 320/375/768/1440/1920px.
- Preserve Bangla line-height and inherited colors in nested headings/cards.
- Keep dialog backdrop, focus ring, disabled/error states and scroll-lock cleanup.
- Preserve overlay header, scrolled state, reduced motion and hero controls.
- Reject raw styles without blocking legitimate SVG presentation attributes or generated build artifacts.

## Steps

- [x] Capture baseline build and rendered public/auth evidence.
- [x] Add and run the styling policy check against the current app; expect failure for missing configuration and existing raw styles.
- [x] Configure Tailwind/PostCSS and migrate shared foundations, public components, auth and workspace utility strings. Remove old CSS Modules and inline presentation.
- [x] Verify generated utilities and fix specificity/responsive regressions against baseline.
- [x] Add the check to the build/CI workflow and update shared agent, UI, architecture and testing documentation.
- [x] Run relevant regression/build/browser checks, context validation, final diff review and record outcomes.

## Execution notes

- Baseline branch: `dev-fontend`; initial worktree clean.
- User explicitly selected this branch/workspace; work in place. No additional branch or worktree is needed.
- Follow the existing installed dependency versions; no Tailwind major upgrade.

- User steering: use `w-11/12` for shared page width and replace visible web brand with Khamar School. Preserve the concurrent auth dropdown/two-column form changes found in the working tree.
- Verification isolation: another process changed the shared `.next` output during browser checks. Discarded those error-page captures and moved subsequent production builds into `/tmp/vetralink-tailwind-verify`.

## Verification and review — 2026-10-07

**Confirmed from code:** Tailwind 3.4 is configured with explicit PostCSS config resolution and source-relative content discovery. Five CSS Modules were replaced by static utility compositions; globals contain layer directives only. Build/CI enforcement and shared agent instructions require Tailwind. Public/workspace outer widths use `w-11/12`. Visible brand and metadata use Khamar School; three original JPEGs are organized under `public/assets/brand`.

**Observed behavior:**

- Isolated production `next build` passed compilation, TypeScript checks, page generation and tracing. Existing workspace `.next` output was left available to the other active process.
- Styling policy passed; 10 policy fixtures and 2 Tailwind compilation checks passed. The config-resolution regression uses the real PostCSS configuration from a different working directory.
- Existing auth (8), workspace boundary (11) and milk projection (3) tests passed.
- Chrome captured 53 scenarios across English/Bangla and 320/375/768/1440/1920px, including public pages, signed-out workspace routes, 404, auth dialogs and scrolled header. No horizontal overflow; 248 rendered shared containers matched `11/12` of their available page width. Header/logo and dialog screenshots were visually inspected. Semantic comparison against the baseline found no unexpected nonempty text-element styling differences beyond the concurrent language-control padding edit.
- Auth browser checks exercised localized responsive registration/login, focus, Escape, scroll locking, exact payloads, cookie/session identity, reload/navigation, cross-tab rotation/logout, expiry and failure/retry against synthetic local services.
- Localization regression passed: 36 GETs, 27 native form submissions, locale persistence/isolation, 5 unsafe return targets, 12 filters, 4 localized CSV downloads and 2 missing-template checks. Assertions now accept utility classes on the form/html and check computed scroll locking.
- Context validator passed: 48 documents, 292 local links, 78 source entries. `git diff --check` passed.

**Review fixes:** Attribute-selector quoting, inherited font-size utilities, font-size/line-height composition, animal heading specificity, overlay header border cascade, PostCSS config discovery outside app cwd, style object/DOM attribute detection, and stale width documentation were corrected and checked. Preserved the concurrent registration dropdown/two-column layout changes.

**Evidence limits:** Browser auth used a controlled upstream; authenticated workspace flows requiring the PostgreSQL/Redis/API test stack were not run. Signed-out workspace rendering and the existing workspace boundary tests passed. No Neon, Upstash, Vercel deployment or Git write actions were performed. Browser captures remain in `/tmp/vetralink-tailwind-baseline` and `/tmp/vetralink-auth-qa-*` for this session.
