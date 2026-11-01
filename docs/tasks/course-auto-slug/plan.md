# Editable automatic course slugs implementation plan

Spec: [requirements](spec.md).

- [x] Add a shared bounded title/custom-slug normalizer and safe Unicode URL-segment schema, with failing-then-passing normalization/contract tests.
- [x] Wire auto/manual mode into the existing wizard. Remove slug required/min-length constraints, normalize before validation/save, preserve custom slugs, dirty/reload and uncertain-create identity.
- [x] Use the shared segment schema and URL encoding across public course routing; preserve rejection of path/query injection.
- [x] Exercise actual create/edit auto/manual/blank/Unicode behavior in the existing bilingual responsive browser harness; run focused contracts/API tests, TypeScript, styling and builds.
- [x] Review changed boundaries, document actual outcomes and limitations, leave unrelated staged files untouched.

No dependencies or migrations were added. Work remains uncommitted and undeployed.


## Verification — 2026-10-29

Implemented editable automatic slugs in the course wizard used by both dashboard entry links and `/admin/courses/new`/`[id]`. Title updates an automatic slug; manual edits opt out; clearing opts back in and a blank/punctuation-only override uses the title at save. Native slug required/min-length/format constraints are removed, with bounded URL normalization before the existing save contract. Existing custom URLs, dirty-state discard/reload, duplicate URL uniqueness and frozen submitted identity on uncertain creates remain protected. Generated Unicode/short slugs are supported across public page/BFF/API and product hydration. Other product types retain their prior slug rules at create and after locked lookup on edit.

| Command/check | Actual result |
| --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Passed CJS, ESM and declaration builds. |
| `pnpm --filter @vetralink/api exec jest --runInBand course-slug.spec product.entity.spec product.repository.spec admin-products.spec youtube-course-contracts.spec courses.spec` | **6 suites / 70 tests passed**: normalization/Unicode/short/fallback/bounds, single route decoding and injection rejection, generic catalogue/direct-read hydration, non-course compatibility and existing product/course policies. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-course-thumbnails.mjs scripts/check-workspace.mjs scripts/check-admin-catalog.mjs scripts/check-youtube-courses.mjs` | **73 tests passed**, including public Unicode/short URL identity and existing thumbnail/workspace/catalogue contracts. |
| `pnpm --filter @vetralink/api build` | Passed after restoring the controller's still-required Zod import for its existing empty enrollment-body validator. Prisma generation only; no database migration. |
| `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` | Passed. |
| `pnpm --filter @vetralink/web check:styles` | Passed Tailwind styling policy. |
| `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-course-slug/web` | Passed in an isolated copy without environment/credential files. |
| `WORKSPACE_BROWSER_FOCUS=admin-courses WEB_TEST_BUILD_DIR=/tmp/vetralink-course-slug/web CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **470 checks passed**, ADMIN/SUPER_ADMIN, bn/en, 320/768/1440px. Added actual auto/manual/blank/short create/edit, preserved custom URLs, locale discard and Unicode public-page checks; existing image, retry, conflict, publication and recovery checks remain green. Screenshots `/tmp/khamar-workspace-qa-eTXKNz`; desktop slug input/help inspected visually. |
| Same browser command with `WORKSPACE_BROWSER_FOCUS=courses` | **192 learner-course checks passed**. Screenshots `/tmp/khamar-workspace-qa-4BZsnX`. |
| `python3 .context/scripts/validate.py`, `git diff --check`, task links, Git index comparison | Passed; staged state unchanged by this task. Existing white-background changes were preserved. |

## Review and corrections

A separate read-only review identified the old generic ProductEntity slug validator rejecting new Unicode/short course records, and a new-draft locale-discard callback incorrectly switching to manual mode. Both were reproduced before their fixes: generic repository hydration failed for Bangla/one-character slugs, and the browser showed a blank slug after locale discard and a new title. Course-aware hydration plus unchanged non-course create/edit rules and an empty-draft automatic-mode reset corrected them. All focused suites passed afterward. The review found no additional concrete retry-identity/manual-overwrite/route-injection defect.

Actual production-browser testing also showed this Next 14 runtime passing percent-encoded dynamic route params: a generated Bangla public URL returned 404 despite the standalone schema accepting its decoded slug. Public page and BFF now decode exactly once and validate one bounded segment; encoded separators, malformed/double encoding, query/fragment syntax and noncanonical whitespace remain rejected. The actual Unicode page check passed after the fix. No framework/Next upgrade or route allowlist broadening was needed.

Final source/review pass confirms no unresolved material in-scope finding. The locale issue was fixed because it affected the requested visible auto-generation behavior even though saving still had a fallback. Generic product/read compatibility is covered with controlled repositories; no live database/provider write or production deployment was performed. Existing missing ESLint configuration remains unchanged; no lint success is claimed. Logs live under `/tmp/vetralink-course-slug/`.

Suggested commit: `fix(courses): generate editable slugs from course titles`.
