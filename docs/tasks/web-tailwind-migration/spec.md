# Web Tailwind migration

Status: implementation authorized by the user's request on 2026-10-07.

## Outcome

All web presentation uses the installed Tailwind CSS 3.4 utilities. Replace the five CSS Modules and custom global stylesheet rules while preserving existing Bangla/English appearance, dimensions, responsive breakpoints, keyboard focus, native dialogs, header overlay/scroll state, hero playback and workspace states. User follow-up adds a shared `w-11/12` page width and Khamar School branding using three supplied logo assets. Existing auth form edits made concurrently are preserved.

## Contract

- Configure Tailwind and PostCSS for `apps/web/src/**/*.{ts,tsx}`; keep the existing dependency versions.
- `src/app/globals.css` contains only the three Tailwind layer directives. No handwritten selectors, CSS Modules, Sass, styled-jsx, CSS-in-JS or authored inline style declarations in web source.
- Use standard utilities first, theme tokens for shared colors/fonts, and literal arbitrary utilities/variants for exact existing geometry, complex selectors and gradients. Reusable static utility strings may live in adjacent `*.styles.ts` files; do not concatenate utility fragments dynamically.
- Per user follow-up, public and workspace outer containers use centered `w-11/12`; retain readable inner text/form widths. Rename visible web branding and metadata to Khamar School, move supplied JPEG originals to `public/assets/brand/`, and reuse one accessible brand component. Internal package/cookie identifiers remain technical contracts.
- Translate dynamic chart width to semantic HTML/native attributes or a finite utility map. Replace body inline scroll locking with a Tailwind class while preserving cleanup.
- Minimal framework layer directives and Tailwind theme configuration are infrastructure; they are not permission to write custom component CSS or plugins that repackage old styles.
- Shared `.context` instructions require this policy for every agent. A web styling check runs during build/CI and rejects violations.

## Acceptance

1. All existing UI components render through Tailwind-generated styles; old CSS Modules are removed.
2. Styling guard fails on raw CSS, inline styles and CSS-in-JS, and passes on the migrated app.
3. Web production build and existing planner/auth/workspace checks pass.
4. Browser checks cover public pages and auth at narrow and desktop widths, both languages, dialog focus/close, header states and no horizontal overflow. Compare baseline and migrated rendered geometry/screenshots.
5. Context documentation and source manifest point to current files; context validation and git diff whitespace checks pass.

## Risks and recovery

Tailwind Preflight changes browser defaults; configure it deliberately to retain existing defaults and encode the required foundation with utilities. CSS specificity, overlapping responsive queries, descendants, pseudo-elements and locale rules need rendered comparison. Keep verification artifacts under `/tmp`; use the uncommitted diff for human-managed recovery. No Git commit/push or live service changes are part of this task.
