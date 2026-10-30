# Public course detail layout implementation plan

Spec: [required behavior](spec.md).

The user subsequently revised the action placement to a centered thumbnail hover overlay. The original verification below records the first layout; the revision record at the end documents its replacement.

- [x] Extend existing browser acceptance to prove new two-column/stacked geometry, CTA placement, About ordering, top-demo close/focus and locked access; watch it fail on the old layout.
- [x] Add a compact public presentation to the existing enrollment component, preserving the default player enrollment flow and explicit account/action/error behavior.
- [x] Rearrange course details into media/actions + right curriculum, then About. Reuse existing state/access checks, mount only the selected demo, and preserve trigger focus and selected-lesson intent.
- [x] Validate no-demo/long-list and enrolled/admin states, responsive bn/en screenshots, public/learner and admin regressions, TypeScript/style checks and production build.
- [x] Review changes and record actual results/limits; leave work uncommitted.

## Implementation and review — 2026-10-29

**Confirmed from code:** `course-detail.tsx` owns the media/actions + curriculum grid, inline preview, bounded lesson list and following About panel. `course-ui.tsx` adds optional compact presentation while retaining the enrollment request, actor guards, busy/error handling, selected-lesson destination and default player presentation. New action/no-demo copy is bilingual. Browser cases cover the new geometry and existing auth/access behavior. No API/shared-contract/database/dependency changes.

**Review:** checked account context, guest login return, explicit enrollment, existing-member Continue, administrator Manage, private-source isolation, one mounted demo, empty-demo/long-list states and responsive overflow. A read-only reviewer found a focus issue: opening Demo while membership loads saves a trigger that becomes detached when the action branch changes. Reproduced with a delayed-membership browser regression, then added a connected-trigger check with the current top Demo as fallback. The regression failed before the correction (`focus-red.log`) and passed in the final browser run. No other material findings remained after source re-review.

## Local verification

Commands ran from the repository root. Production web output was isolated in `/tmp/vetralink-course-detail/web`, without copying runtime credentials; upstreams and players used controlled fixtures. Logs are in `/tmp/vetralink-course-detail/`.

- Initial old-layout browser run failed on missing media/outline/About regions, establishing the requested behavior was absent.
- `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-course-detail/web` — passed after the final focus correction (`build-final.log`).
- `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` — passed after the final correction (`types-final.log`).
- `pnpm --filter @vetralink/web check:styles` — passed after the final correction; `pnpm --filter @vetralink/web test:styles` — 14 passed (`styles.log`).
- `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-workspace.mjs scripts/check-admin-catalog.mjs` — 57 passed (`contracts.log`).
- `WORKSPACE_BROWSER_FOCUS=admin-courses WEB_TEST_BUILD_DIR=/tmp/vetralink-course-detail/web CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` — 470 passed before the focus-only correction (`admin-browser.log`); screenshots `/tmp/khamar-workspace-qa-mWafgl`.
- `WORKSPACE_BROWSER_FOCUS=courses WEB_TEST_BUILD_DIR=/tmp/vetralink-course-detail/web CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` — **239 passed** after the final correction, including delayed-membership focus (`browser-final.log`); screenshots `/tmp/khamar-workspace-qa-yls5I6`. The earlier run passed 237 before the extra regression. Manually inspected English desktop and Bangla mobile layout screenshots in `/tmp/khamar-workspace-qa-AesxiH`; buttons precede artwork, lessons sit right/stack below, and About follows both panels.
- `python3 .context/scripts/validate.py` — passed: 48 context Markdown documents, 378 links, 95 source entries. `git diff --check` — passed.

**Limits:** browser evidence uses Chrome CDP via the existing repository harness and synthetic HTTP/player responses, not live enrollment persistence, live video delivery, alternate browser engines or a deployment. No Figma reference was supplied; visual checks use the requested arrangement and existing design system. ESLint has no checked-in web configuration (documented tooling gap); no lint pass is claimed. No live database/provider writes or Git staging/commit/push.

Suggested commit: `feat(web): rearrange public course detail layout`

## Revision: centered thumbnail hover actions — 2026-10-29

Required behavior: thumbnail is the background; center Enroll/Demo over it and reveal on mouse hover. Preserve keyboard and touch access, the right curriculum and About ordering.

- [x] Update spec and browser expectations; observe the old header-button layout fail the new overlay geometry assertion (`overlay-red.log`).
- [x] Use a relative thumbnail frame, absolute artwork and centered readable action panel. Reveal with hover/focus-within; keep visible when hover is unavailable. Keep account/selected-lesson/error content and long-content scrolling. Respect reduced motion.
- [x] Hide the thumbnail frame during inline demo playback without remounting its enrollment state. Restore trigger focus in the post-render effect when closing, including membership branch changes.
- [x] Read-only reviewer checked the revised source/spec and found no additional Critical/Important issues. Parent browser checks cover rendered behavior. An initial mobile run exposed aspect-ratio/min-height expansion beyond the viewport; explicitly constrain frame width and assert against horizontal overflow.
- [x] Complete fresh build, types/styles, bilingual mouse/keyboard/touch browser checks, screenshots and final scope/docs verification.

**Observed revision evidence:**

- The same isolated production build command above passed after the final width/focus changes (`overlay-build.log`). Fresh `tsc --noEmit --incremental false` and `check:styles` passed; `test:styles` passed 14 tests (`overlay-types.log`, `overlay-styles.log`).
- The public/learner browser command above passed **275 checks** (`overlay-browser.log`), covering centered geometry, no horizontal overflow, hidden mouse-idle actions, hover/focus reveal, visible touch actions, actual mouse/touch Demo activation, hidden overlay during playback, restored thumbnail/focus and existing auth/enrollment/error paths.
- Fresh `WORKSPACE_BROWSER_FOCUS=admin-courses` with the same isolated build passed **470 checks** (`overlay-admin-browser.log`), including the updated Chrome launch profile; screenshots `/tmp/khamar-workspace-qa-gwfQl5`.
- Manually inspected English 1440px hover and Bangla 320px touch screenshots in `/tmp/khamar-workspace-qa-QmF7uD`. Fonts and thumbnail image completion are awaited before screenshots.
- The browser harness now starts Chrome with a desktop pointer profile: this Linux headless runtime otherwise reports `(hover:none)` even on desktop. A small CDP probe confirmed the profile and touch switch; disabling touch does not restore that initial mouse profile. Course cases therefore run mouse viewports before touch viewports, explicitly assert the input media mode, and use real pointer/touch events.
- Final context validation passed (48 documents, 378 links, 95 source entries), as did `git diff --check`. Final re-review found no outstanding material issue; changes remain uncommitted.

The earlier synthetic-browser/provider/deployment and lint-tooling limits still apply. Suggested revised commit: `feat(web): show course actions over thumbnail on hover`.

## Revision: clean hover actions and enrollment confirmation — 2026-10-30

Scope: remove the thumbnail white panel/account copy, align lesson actions with titles, and require confirmation from thumbnail Enroll and lesson Unlock. Existing API/access rules and the protected-player enrollment component retain their contracts. Frontend/UI implementation, UI/UX, Code Reviewer and QA perspectives apply; no schema, financial, clinical or offline changes.

- [x] Inspect existing detail/enrollment components, browser fixtures and task contracts.
- [x] Extend browser cases and observe the missing confirmation fail against the baseline.
- [x] Implement shared detail confirmation, clean overlay and responsive title/action rows.
- [x] Review focus, auth/actor changes, duplicate submits and error/retry behavior.
- [x] Run isolated production build, types/styles, relevant contract/browser checks and visual inspection.
- [x] Re-review final diff and record results/limits.

**Confirmed from code:** `CourseEnrollmentDialog` reuses the existing actor-scoped, empty-body, idempotent enrollment request through `EnrollmentButton`. Detail state chooses the selected lesson or first lesson. Native modal semantics trap focus; Cancel/Escape restore the opener, and cancellation is disabled during submission. Guest confirmation closes before opening login with the exact return route. The thumbnail compact presentation omits account copy; the full protected-player presentation remains available. Lesson number badges share the title area to preserve space for long titles beside actions on narrow screens. No backend/schema/provider/dependency changes.

**Review:** a read-only reviewer and the implementation self-review identified white-on-white membership error text from an overly broad foreground override, and missing guest session-error recovery in the dialog. Both were corrected. A new controlled-session browser test failed before the latter fix (`session-red.log`) and passed afterward. Visual inspection also led to a wider mobile title area. Final read-only source re-review reported no remaining material findings.

**Observed local evidence** (2026-10-30; logs `/tmp/vetralink-course-confirmation/`):

- Baseline isolated production build passed; extended browser acceptance then failed as expected on missing Unlock confirmation (`browser-red.log`).
- `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-course-confirmation/web` — passed (`build-final.log`). Isolated source copy excludes runtime credentials.
- `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` — passed (`types-final.log`).
- `pnpm --filter @vetralink/web check:styles` — passed; `pnpm --filter @vetralink/web test:styles` — 14 passed (`styles-final.log`).
- `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-workspace.mjs` — 24 passed (`contracts.log`).
- `WORKSPACE_BROWSER_FOCUS=courses WEB_TEST_BUILD_DIR=/tmp/vetralink-course-confirmation/web CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` — **380 passed** (`browser-final.log`). Covers bn/en at 320/768/1440px, transparent thumbnail action panel without email, title/action alignment, Unlock/Enroll confirmation, Cancel/Escape without writes, focus return, guest session-error retry and selected-lesson login, enrollment failure/retry, duplicate Confirm suppression, exact selected/first lesson navigation, existing membership/admin actions and prior demo/player regressions.
- Manually inspected final Bangla 320px details and confirmation plus English desktop details. Final screenshots: `/tmp/khamar-workspace-qa-KXNrsM/`; no horizontal overflow.
- `python3 .context/scripts/validate.py` and `git diff --check` — passed.

**Limits:** browser HTTP/player responses are controlled fixtures, not live enrollment persistence or actual YouTube playback/deployment. Checks use Chrome; alternate browser engines were not exercised. Existing lint-tooling limitations remain. No live writes, Git staging/commit/merge/push or deployment.

Suggested commit: `feat(web): confirm course enrollment and simplify hover actions`.

## Follow-up: deeper thumbnail shade — 2026-10-30

User requested a darker thumbnail hover shadow. Scope: change the existing Tailwind overlay from 40% to 70% black, preserving hover/focus/touch controls. This is a visual-only adjustment with no access, API or enrollment changes.

- [x] Inspect the existing overlay and update the visual requirement.
- [x] Increase the black overlay opacity using the existing Tailwind utility.
- [x] Verify actual browser hover rendering and button visibility; run style/build checks and review the final diff.

**Observed browser verification:** `node /tmp/vetralink-deep-hover.mjs` passed against the running localhost web and its selected live backend using read-only public course data. Chrome computed the hovered background as `rgba(0, 0, 0, 0.7)`; idle hiding, keyboard reveal, visible touch controls, minimum 44px buttons and 320px horizontal sizing passed. Inspected `/tmp/vetralink-deep-hover.png`: artwork is darker and both actions remain readable. No enrollment or account writes.

`pnpm --filter @vetralink/web check:styles` passed; `test:styles` passed 14 tests. Review confirmed a single utility change with existing interaction classes retained. Production build result and final checks follow.

The isolated production build `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-course-confirmation/web` passed (`/tmp/vetralink-deep-hover-build.log`). Context validation and `git diff --check` passed. Final review found no material issue in the scoped visual change; prior local-login documentation remains untouched. Suggested commit: `style(web): deepen course thumbnail hover overlay`.
