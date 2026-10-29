# White global web background implementation

Spec: [spec.md](spec.md)

- [x] Inspect root styles, route layouts, shared workspace shell, Tailwind theme and adjacent style/browser checks.
- [x] Change only document/body and full-page workspace/learner wrappers to `bg-white`; keep `paper` and section styles unchanged.
- [x] Review diff for scope, cascade and layout regressions.
- [x] Run style guard/tests, isolated production build and focused browser verification.
- [x] Complete final review and record evidence and limitations.

## Verification

**Observed behavior, 2026-10-29, local Linux / Node 22.22.1 / pnpm 10.18.3:**

| Command/check (repository root unless stated) | Result |
| --- | --- |
| `pnpm --filter @vetralink/web check:styles` | Passed; Tailwind policy preserved. |
| `pnpm --filter @vetralink/web test:styles` | 14/14 passed, including real Tailwind compilation. |
| `pnpm --dir /tmp/web-white-background-f7jisqj8 run build` | Production compilation, type checking and all 50 static-generation entries passed. Isolated source copy with linked existing dependencies; no dev build artifacts replaced. |
| `WORKSPACE_BROWSER_FOCUS=background WEB_TEST_BUILD_DIR=/tmp/web-white-background-f7jisqj8 node /tmp/web-white-background-f7jisqj8/scripts/check-white-background-browser.mjs` | 21 checks passed: 5 existing HTTP access-boundary checks and 16 route/locale/viewport scenarios. |
| `python3 .context/scripts/validate.py` | Passed: 48 context documents, 376 links, 95 source entries. |
| `git diff --check` | Passed. |

The temporary browser probe reuses the existing dashboard harness's controlled upstream, synthetic identity and Chrome lifecycle. It checks `/`, `/about`, `/account/profile` and `/account/courses` in bn/en at 320/1440px: computed document/body backgrounds are `rgb(255, 255, 255)`, as are the workspace and learner wrappers. White remains under emulated dark preference. The homepage's three colored service cards, public footer and representative `bg-paper` surfaces retain their original computed colors. No horizontal overflow or runtime exceptions were observed. Screenshots are in `/tmp/khamar-workspace-qa-rA9Wbn`; the mobile homepage and desktop About/course-library screenshots were visually inspected.

An initial `pnpm run build` invoked from outside the repository failed because the host selected an unavailable pnpm 12.5.1. Running the recorded `pnpm --dir ... run build` command from the repository used its pinned pnpm 10.18.3 and passed.

## Review and limits

The source diff contains four background utility edits across three files. Theme tokens, section styles, typography, spacing and application logic are unchanged. No schema, permission, clinical, financial or offline contracts are affected. The dev server remains running against its original build directory.

Final self-review and a separate reviewer-agent static review found no concrete source issues. The reviewer did not rerun the build/browser checks; the local runtime evidence above was collected by the implementing agent. Verification records and task status were finalized after that review.

This evidence covers local production rendering with controlled HTTP data and Chromium, including sampled background colors and viewport overflow. It does not certify every application workflow, other browser engines or a deployed environment. No deployment or Git staging/commit was performed.

Suggested commit: `fix(web): use white global page backgrounds`
