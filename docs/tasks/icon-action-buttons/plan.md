# Icon action buttons implementation plan

**Goal:** Compact recognizable secondary actions throughout administrative and public screens, retaining clear labels on decisions and primary navigation.

**Architecture:** Reuse the existing Button/buttonVariants and workspace Tailwind compositions. Add explicit icon sizing, then convert reviewed controls at their existing call sites with Lucide icons and existing locale messages. No runtime text-to-icon inference or global replacement of button contents.

**Tech stack:** Existing React/Next, Lucide, Tailwind and bn/en messages; no new dependency.

**Spec:** [spec.md](spec.md). User authorized the UI audit and changes. Execute sequentially in this checkout, preserving human-managed Git and unrelated work; no staging/commit/push. Brainstorming and writing-plans informed the scoped inventory/design; repository authorization for routine reversible edits takes precedence over additional skill approval ceremonies.

- [x] Shared sizing: add a Button/buttonVariants icon size and static workspace icon utility styles; exclude marked icon actions from mobile full-width growth. Check native button/link/submit/disabled semantics.
- [x] Administrative controls: inspect and convert eligible dashboard shortcuts, view/edit links, directory search/refresh/paging, editor reorder/delete/close and related course/media/support controls. Keep primary mutations and ambiguous actions visibly labelled. Preserve handlers/data selectors and translate accessible names with existing messages.
- [x] Public/learner controls: convert eligible search/reset/paging/close/back utilities and password visibility; keep primary CTAs and navigation labels. Run scoped and adjacent rendered/boundary suites, style checks, TypeScript and an isolated production build. Exercise administrative and public browser flows, inspect screenshots and correct any regressions in accessible selectors or layout. Record actual coverage and remaining limitations here.

Review focus: implicit submit buttons must still submit; links preserve href/navigation; native disabled controls cannot activate; existing confirmation dialogs remain; labels/title remain correct in bn/en; icon actions remain44px on mobile without stretching; monetary/account decisions remain readable; primary CTAs and navigation retain visible names. Styling changes use existing tokens and complete Tailwind classes.

## Implementation and review — 2026-11-03

Implemented165 marked icon-action call sites in41 components. Shared Button/buttonVariants accepts `size="icon"` while preserving default padding; legacy native controls reuse static workspace icon styles. The mobile action-row growth rule excludes marked icon controls. Existing Lucide icons, locale messages, native hover titles,44px targets, disabled states and keyboard focus are retained. Lesson removal/discard controls use red trash icons. Dashboard cards retain visible headings with compact destination actions; navigation destinations and primary/financial/account decisions keep their visible names.

An AST comparison against HEAD confirms unchanged click/submit/change handlers, hrefs, disabled conditions and explicit types across the41 affected consumer components. The final review restored the player next-control's original right alignment. Existing browser selectors that relied on text now also use accessible names. Two initial rendered consultation test failures came from introducing an unresolved UI alias into a legacy isolated harness; using the existing workspace composition for native links fixed that integration without loosening assertions. A new browser-audit route selection initially included `/learning`, whose topic navigation correctly stays labelled and contains no eligible controls; the audit now covers the actual public `/blog` filter controls.

## Verification

All checks below ran against the final local source/build. No Git staging/commit/push, dependency change, backend migration/configuration, live account/enrollment write or deployment occurred.

| Check | Result/evidence |
| --- | --- |
| TypeScript | `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` passed; final Next build repeats type validation. `/tmp/vetralink-icon-actions-types-final.log` |
| Styles | `check:styles` passed; `test:styles` passed14 tests. `/tmp/vetralink-icon-actions-styles.log` |
| Adjacent rendered/boundary regressions |187 tests passed across admin dashboard/directory/billing/consultations/finance/communications/platform/catalog/enrollments, YouTube courses, auth, workspace and public content. `/tmp/vetralink-icon-actions-regressions.log` |
| Production build | `API_BASE_URL=http://127.0.0.1:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-icon-actions/web` passed. Isolated source copy contains no real env files. `/tmp/vetralink-icon-actions-build-final.log` |
| Icon layout/accessibility | `WORKSPACE_BROWSER_FOCUS=icon-actions` passed64 screen checks across ADMIN/SUPER_ADMIN,bn/en,320/1440px, covering dashboard/users/products/orders/triage/media/public courses/blog. Checks require localized names/titles, decorative icons, compact44–52px targets and no page overflow. `/tmp/vetralink-icon-actions-browser.log`; screenshots `/tmp/khamar-workspace-qa-UKHvSu/` |
| Connected administration | `WORKSPACE_BROWSER_FOCUS=admin-release` passed2121 controlled browser checks: overview46,directory171,catalog/media647,billing163,consultations164,finance199,communications99,platform627 plus shared boundary checks. Includes forms, paging, editing, reordering/removal, financial confirmations and file flows. `/tmp/vetralink-icon-actions-admin-browser.log`; screenshots `/tmp/khamar-workspace-qa-izQiQe/` |
| Enrollment and playback | `admin-enrollments` passed96 checks; `course-revalidation` passed6. `/tmp/vetralink-icon-actions-admin-enrollments.log`, `/tmp/vetralink-icon-actions-course-revalidation.log` |
| Public localization/native forms | Proper standalone invocation against the isolated production server passed80 localized GETs,60 native language-form submissions, persistence/concurrency,5 unsafe-return checks,12 catalog filters,4 localized CSV downloads and2 missing-template checks. The selected editorial upstream is an explicit empty404 fixture, preserving unknown-slug behavior; this is not provider acceptance. `/tmp/vetralink-icon-actions-localization.log` |
| Manual visual review | Inspected desktop admin dashboard, mobile Bangla public course search, desktop order detail and mobile Bangla order detail. Icon controls remain compact and identifying content stays visible. |

The localization script was initially invoked as a unit suite without its required production server, then with no editorial upstream; those setup attempts failed with connection refusal and an expected unknown-slug503. Running the documented standalone script with its server and controlled404 fixture passed. No production behavior was changed to satisfy these fixture requirements.

These are local controlled/static/production-build checks. They do not certify deployment, live data/provider delivery or the unrelated historical full learner locale/player-remount baseline; that full learner suite was not rerun for this visual-only task.

Suggested commit: `style(web): use compact icons for secondary actions`.
