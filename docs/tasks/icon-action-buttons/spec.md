# Icon action buttons

User request,2026-11-03: reduce oversized/repetitive text buttons across the admin dashboard/admin screens and eligible website controls by using recognizable icons.

Use icon-only controls for secondary utilities: view/edit, refresh/retry, search/filter apply/reset, previous/next/back, close, lesson reordering/removal and password visibility. Prioritize administrative directories, dashboard shortcuts with visible card headings, course/editor/media and support/finance screens. Apply the same judgment to public filters, course pagination/player controls and discovery/demo reset controls.

Keep visible text for navigation/category choices, dashboard destinations without adjacent identifying content, primary create/save/submit/enroll/purchase calls to action, confirmation/cancel decisions, and ambiguous or consequential account/financial operations. Do not infer icons from translated strings at runtime or change URLs, submit types, handlers, validation, permissions, confirmation dialogs or backend behavior.

Every icon action has a localized accessible name and native hover title, a decorative aria-hidden Lucide icon, visible keyboard focus and a44px minimum target. Delete/remove icons are red. Disabled state remains native; form search controls retain submit behavior. Icon links remain links. Compact controls do not stretch to full width in mobile action rows. Preserve bn/en content and existing Tailwind-only styling.

Acceptance: inspect actual affected controls, run relevant regression/style/type/build checks, and exercise representative ADMIN/SUPER_ADMIN and public flows at narrow/wide sizes. Verify accessible names, compact targets, destructive color, form submission and existing dialogs; report existing or unavailable checks honestly. No dependency upgrades, backend changes, migrations, live writes or deployment.
