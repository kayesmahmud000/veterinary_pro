# About services implementation plan

Spec: [spec.md](spec.md)
Goal: Add the reference's eight-service overview to About with Khamar School branding.
Architecture: One static server component, shared localized copy and existing Lucide icons. Tailwind-only styling and native decorative SVG geometry; no new dependencies or external services.

## Steps

- [x] Inspect About, localization, public shell, styling rules and existing verification scripts.
- [x] Add bilingual service labels and introduction in `apps/web/src/lib/i18n/public-pages.ts`.
- [x] Implement `AboutServices` in `apps/web/src/components/marketing/about-services.tsx` and replace the existing introductory paragraph with that section, retaining its introduction text and all following sections.
- [x] Review semantics, service parity, reference layout, narrow-screen readability and translation behavior.
- [x] Run styling guard/tests and production build, then public/localization and responsive browser checks.
- [x] Re-review the scoped diff and record final evidence.

## Constraints and verification decisions

Work in the supplied checkout, preserve unrelated dirty files, and do not commit or deploy. The user explicitly requested implementation; repository instructions authorize routine reversible UI edits without additional approval gates. This is a static presentation change: use existing checks and direct browser inspection rather than adding tests that mirror markup. Keep evidence in this plan, following the repository's proportional workflow.

## Verification evidence

All results below are **Observed behavior**, 2026-10-29, local Linux / Node 22.22.1 / headless Google Chrome. Production checks used an isolated source copy at `/tmp/web-about-services-kn907trl`, with the existing installed dependencies, without disturbing the development server on port 3000.

| Command/check                                       | Result                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @vetralink/web check:styles`         | Passed; no custom CSS or inline styles.                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @vetralink/web test:styles`          | 14/14 passed.                                                                                                                                                                                                                                                                                                                                |
| `pnpm --dir /tmp/web-about-services-kn907trl build` | Passed styling guard, compilation, type checking and production route generation.                                                                                                                                                                                                                                                            |
| `pnpm --filter @vetralink/web test:public-content`  | 6/6 passed.                                                                                                                                                                                                                                                                                                                                  |
| `pnpm --filter @vetralink/web test:public-pages`    | Initial run stopped at `bn /blog/missing`: expected 404, received 503 from the existing editorial upstream. With a local read-only HTTP 404 content fixture, all 60 checks passed.                                                                                                                                                           |
| `pnpm --filter @vetralink/web test:localization`    | Initial run stopped at `/blog/localization-test-missing`: expected 404, received 503. With the same content fixture, passed 80 localized GETs, 60 native locale-form submissions, persistence/isolation, return-URL, filter and CSV checks.                                                                                                  |
| `node /tmp/check-veterinary-about.mjs`              | 10/10 locale/viewport combinations passed at 320, 375, 768, 1440 and 1920px: eight unique service labels, correct title, no horizontal overflow, no clipped SVG text, correct mobile/desktop presentation. Cookie-free navigation confirmed Bangla default. Ran before introducing the content fixture; About has no content-API dependency. |
| Screenshot inspection                               | Inspected Bangla 320px, Bangla 1440px and English 1440px section captures. Readable mobile list, circular desktop diagram, Khamar School center branding and introduction displayed as intended. Captures retained in `/tmp/about-browser-W382F8/`.                                                                                          |
| `git diff --check`                                  | Passed.                                                                                                                                                                                                                                                                                                                                      |

## Review and completion

Independent read-only scoped review found no material issues; final author review checked translated key parity, all eight reference categories, decorative SVG versus semantic list, retained About sections, static Tailwind classes and unrelated-change preservation. No application fixes were needed after review/testing.

The initial wider-suite failures were traced to existing `src/lib/editorial.ts` / middleware behavior: unknown authored slugs consult the content API and propagate unavailability as HTTP 503. No source changes were made for that separate dependency. Fixture-backed passes validate deterministic public-page behavior, not the live editorial API. The requested About section is locally verified; no deployment or Git commit was performed.

Suggested commit: `feat(web): add Khamar School services overview to about page`.
