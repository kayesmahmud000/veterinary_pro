# White global web background

Status: Locally verified
Date: 2026-10-29

## Outcome and acceptance

The user requests a consistently pure white (`#ffffff`) main background across the web application. Existing section, card, dialog, header, footer and control colors must remain unchanged. This supersedes only the page-background portion of the warm off-white direction in [the public-site specification](../../features/web-public-site/spec.md).

## Implementation and scope

**Confirmed from code:** `src/lib/ui/site.styles.ts` supplies the root body background; `workspace-shell.tsx` and `(learner)/layout.tsx` independently apply `bg-paper` to full-page wrappers. The Tailwind `paper` token is `#fafbf7` and is also used for badges, table headers, dialogs and other intentional surfaces.

Use `bg-white` on the root document/body and the two page wrappers. Preserve the `paper` token and all section-specific styles. Avoid descendant overrides, resets, new dependencies or CSS rules. Frontend/UI implementation with UI reviewer and Code Reviewer + QA self-review perspectives is sufficient; no API, authentication, tenant, persistence or mobile contracts change.

## Validation and recovery

Run the existing style guard, style tests and an isolated production build, then inspect rendered backgrounds at phone/desktop widths and both locales. Check representative intentional surfaces retain their existing colors and navigation remains usable. This is a reversible presentation-only change; restore the four background utility edits to roll back. No migration or deployment is involved.
