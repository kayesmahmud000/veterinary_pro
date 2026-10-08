# UI components

These local shadcn/ui-style source components use the documented Radix
composition and Next.js `Link` with `asChild`:
https://ui.shadcn.com/docs/components/radix/navigation-menu
https://ui.shadcn.com/docs/components/radix/button
https://ui.shadcn.com/docs/components/radix/card
https://ui.shadcn.com/docs/components/radix/input

They are adapted for React 18, Tailwind 3, the existing `cn` helper and site
colors (`ink`, `green`, `paper`, `line`, `amber`). No Tailwind 4 migration, global
CSS/reset changes, remote font, CSS animation package or unrelated component
installation is required. Radix owns navigation keyboard/disclosure behavior;
Button composes links through Slot. Card/Input/Badge are native elements.

This is a manual integration. `components.json` is intentionally not installed;
a future CLI installation must be configured for these existing aliases/theme
and reviewed for the repository's mandatory Tailwind-only styling policy.
