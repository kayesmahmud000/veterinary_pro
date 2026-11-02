# Development startup merge-conflict repair

Date/revision: 2026-11-02 / `120e087`. Status: Verified locally.

## Outcome and acceptance

Restore workspace parsing and executable source after committed merge markers.
Turbo must discover development tasks, pnpm must accept the existing frozen
lockfile, and the affected web route and browser harness must parse. Preserve
Next 15 asynchronous request handling, localized/short course slugs, Express
4.22.3 and both administration/unsaved-editor browser modes.

## Investigation and scope

**Observed behavior:** `npm run dev -- --dry=json` fails at
`apps/api/package.json:37`; `node --check
apps/web/scripts/check-dashboard-browser.mjs` also fails on a conflict marker.
**Confirmed from code/Git:** merge commit `120e087` (parents `120d1cb`,
`f0dbce1`) committed unresolved conflict blocks in the manifest, lockfile,
course page, browser harness and documentation. The manifest also contains
two Express declarations; the lockfile importer requires `^4.22.3`.

Resolve the four files with executable/dependency conflicts and the learner
routes introduced without Next 15 async localization/params compatibility.
**Observed behavior:** web TypeScript reported three localization Promise errors;
source inspection also found synchronous learner course/lesson params.
**Observed behavior:** the first production build rejects duplicate
`/account/courses` and lesson pages in both `(workspace)` and `(learner)`.
Remove the two obsolete workspace pages, retaining the dedicated learner group
required by [the existing learner specification](../learner-course-experience/spec.md).
**Observed behavior with pinned dependencies:** React 19 rejects the uploader's
zero-argument `useRef<AbortController>()`; explicitly initialize it to `undefined`
while retaining its previous runtime value and optional abort behavior.
Existing historical documentation
conflicts are outside this startup repair and must remain disclosed. No package
upgrades, public API, persistence, tenant, clinical, financial or offline contract
changes. Debugging, implementation, Code Reviewer and QA perspectives apply.

## Validation

Repeat the failing Turbo/Node checks; validate frozen lockfile consistency,
shared build, web types/styles and existing course contract tests. Attempt a
bounded development startup and report environment/runtime blockers separately.
No Git index/history changes, deployment or database migrations are authorized.
