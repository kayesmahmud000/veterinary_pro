# Public product showcase plan

Spec: [spec.md](spec.md)

- [x] Inspect current public UI, typed catalogs, existing verification and shared repository rules.
- [x] Specify original product visuals, animal discovery and real localized learning content.
- [x] Implement preview/cards, animal selector, guide catalog/articles and CSV downloads.
- [x] Review content truthfulness, URL/locale behavior, accessibility and responsive styles.
- [x] Run production build, existing checks and focused HTTP/browser verification.
- [x] Fix findings, re-review, update shared context/roadmap and record evidence.

## Verification

**Observed behavior, 2026-10-07:** local production Next.js 14.2.35 on port 3100, Chrome 154 via CDP, Windows. Screenshots and the isolated browser profile stayed in OS temp. Earlier uncommitted work was preserved.

| Check | Result |
| --- | --- |
| `pnpm --filter @vetralink/web build` with `NODE_ENV=production` | Passed compilation, types, generation and traces. Homepage first-load JS 105 kB; guide pages 96.9 kB. No dependencies added. Windows sandbox initially rejected workers; authorized outside-sandbox run passed. |
| `pnpm --filter @vetralink/web test:planner` | All 3 existing behavioral tests passed outside the sandbox; decimal/boundary parsing and arithmetic remain unchanged. |
| `pnpm --filter @vetralink/web test:localization` on final production server | Passed 36 localized GETs, 27 native language-form submissions, persistence/isolation, 5 unsafe return checks, 12 catalog filters, 4 localized CSV responses and 2 unavailable-template 404s. Includes all guides and unknown guide recovery. CSV checks verify BOM, private/no-store caching, attachment filenames and empty data rows. |
| New hero/species in both languages, 1440/768/375/320 CSS px | 26 assertions per locale/width (208 total) passed: distinct previews/panels, selected states, poultry eggs without milk, sample labels, article links, 44px choices, reduced motion, unique IDs, single landmarks and no page overflow. |
| Existing discovery | 50 homepage assertions and 18 service feature selections passed across both languages: destinations, calculator errors/recovery/zero/bounds, sample views, workflow and FAQ. |
| Learning journey, both languages, 375px | Query filters, selected topic, history Back, reload, actual article content, return to topic and language-change query retention passed. Unknown guide recovery has one header, H1 and main. |
| Keyboard and accessibility | Native Space selects species with visible 3px focus; Tab advances. Native Enter follows a topic filter. Accessibility tree confirms named groups/controls. No app JS exception; rapid navigation canceled prefetch requests. |
| Actual browser downloads | Saved 238-byte Bangla milk and 153-byte English finance CSVs with correct headers. Initial slash-form Windows download destinations failed in the CDP harness; native Windows paths fixed saving without app changes. |
| Visual inspection | Reviewed desktop hero/cards/species/resources, mobile hero/preview/species and complete articles in both languages; finance download at 320px. English 720px reflow has no overflow (narrow-layout equivalent, not native zoom). |
| Formatting/context | Targeted Prettier, `git diff --check` and UTF-8 context validation passed. |

## Review and completion

Original HTML/SVG visuals make the product tangible. Three authored nonclinical guides and two blank templates complement planned platform descriptions. Catalog filters are server-rendered ordinary links; unknown/repeated topics fall back to all guides. CSV filenames come from a fixed catalog and downloads accept no user content.

Review fixed an unnecessary Unicode regex flag for the TypeScript target and a nested dynamic-route 404 missing localized document markup. The three guides now use fixed public pages with a shared article component; unknown URLs use existing root 404 recovery. Final HTTP/browser checks passed after this change. No auth, API, operational farm data, clinical advice, purchases or booking was introduced. Samples and planned capabilities remain labeled.

Browser closed and its temporary profile removed; `.gstack` remains absent. Preview: `http://localhost:3100`. No Git staging/commit/push or deployment. Evidence covers local Chrome emulation, not physical devices or all browser engines.

Suggested human-managed commit: `feat(web): add product showcase and free learning guides`.
