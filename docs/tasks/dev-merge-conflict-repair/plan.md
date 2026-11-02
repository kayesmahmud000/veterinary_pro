# Development startup merge-conflict repair plan

Spec: [spec.md](spec.md).

- [x] Inspect repository guidance, Git state, conflicting branches and consumers.
- [x] Reproduce the Turbo manifest failure and browser-harness syntax failure.
- [x] Resolve manifest/lockfile and combine compatible web-route/harness changes.
- [x] Reproduce learner localization type errors; await localization and route
      params in the four affected learner server components/metadata handlers.
- [x] Reproduce production-build duplicate course routes; remove the two obsolete
      workspace pages retained alongside their dedicated learner replacements.
- [x] Reproduce the remaining React 19 uploader-ref type error after installing
      pinned dependencies; explicitly initialize its ref with `undefined`.
- [x] Review changes for lost behavior, duplicate dependencies and scope.
- [x] Verify task discovery, frozen lockfile, web compilation/styles/course tests
      and bounded development startup.
- [x] Re-review final diff and record outcomes and limitations.

## Evidence

Baseline working tree was clean. Both reproductions failed on committed merge
markers. No Git index/history writes were performed.

**Observed checks:**

- `npm run dev -- --dry=json`: succeeds and discovers API, shared-types and web
  development tasks (the original command failed before edits).
- All four workspace manifests parse without duplicate object keys.
- `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile`:
  passes with the repaired existing lockfile; no dependency resolution changes.
- `pnpm --filter @vetralink/shared-types build`: passes CJS, ESM and declarations.
- Browser harness `node --check`: passes (failed before edits).
- Existing course/workspace/protected-route/auth/style/Tailwind checks:
  **56 passed, zero failures/skips** after route repair. Command:
  `pnpm --filter @vetralink/web exec node --test scripts/check-youtube-courses.mjs scripts/check-workspace.mjs scripts/check-protected-routes.mjs scripts/check-auth.mjs scripts/check-styles.test.mjs scripts/check-tailwind.mjs`.
- One-off server-component execution checks pass async localization/metadata,
  Promise route params, short/Bangla/encoded slugs, malformed segment rejection
  and course/lesson UUID rejection. Dependencies are controlled; this is not
  real browser/provider acceptance.
- Initial web type check exposed three localization errors; fixed. Initial
  production build exposed duplicate workspace/learner course routes; fixed.
  Subsequent `pnpm --filter @vetralink/web build` passed compilation, types and
  production generation with installed Next 14.2.35 / React 18.3.1.
- Bounded `npm run dev -- --ui=stream`: shared watchers build, Prisma generates,
  Next reports Ready and Nest reports zero compilation errors. The timeout stops
  the process group (exit 137 after escalation); this is a bounded smoke check,
  not clean lifecycle exit or API/database readiness evidence.
- `python3 -X utf8 .context/scripts/validate.py`: passes 49 Markdown documents,
  398 local links and 100 source entries. `git diff --check` passes.

**Dependency environment follow-up:** installed Next/React were older than the
manifest/lockfile's 15.5.28/19.3.1. Full offline frozen installation failed because
the pinned Multer tarball was absent from the local store. Online
`pnpm install --frozen-lockfile` then succeeded, including Prisma generation;
installed versions now match Next 15.5.28 / React 19.3.1. No dependency versions
were changed in the lockfile. The same 56 regression checks pass again with these
pinned versions. `pnpm --filter @vetralink/api exec tsc --noEmit --incremental false -p tsconfig.build.json`
also exits 0 after installation. The final `pnpm --filter @vetralink/web build`
passes on Next 15.5.28, including styling, compilation, type checks and production
generation. Next regenerates its tracked `next-env.d.ts` route-type reference and
documentation link; these are the standard generated Next 15 declarations.

The first pinned build/type check failed solely on the uploader's zero-argument
`useRef`. Explicit `undefined` initialization preserves its runtime behavior and
satisfies React 19. After the correction,
`pnpm --filter @vetralink/web exec node --test scripts/check-course-thumbnails.mjs scripts/check-admin-catalog.mjs`
passes **49 tests, zero failures/skips**, supplementing the 56 checks above.

**Review:** keep a single Express `^4.22.3` declaration matching the lockfile;
preserve Sharp optional metadata and all administration/unsaved-editor harness
modes. Await Next request values without weakening slug/UUID validation. Remove
only obsolete duplicate pages; learner pages keep the same URLs, middleware and
dedicated layout. No API/schema/auth contract or styling redesign is introduced.
Documentation conflict markers predating this repair remain outside scope.

## Completion

Acceptance criteria pass locally. Final pinned-dependency dev smoke regenerates
Prisma, starts shared build watchers and reaches Next Ready in 3.7 seconds.
The bounded launch is stopped after verification; API/database readiness and
deployed/provider/browser acceptance are not established. Final diff review
confirms no dependency upgrades/resolution changes, schema changes, Git
index/history writes or unrelated application redesign. Remaining conflict
markers are documentation-only and intentionally disclosed rather than silently
choosing between historical release/planning records.

Suggested human-managed commit: `fix(dev): resolve committed merge conflicts and course compatibility`.
