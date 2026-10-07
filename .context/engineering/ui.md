# UI and UX requirements

UI work requires the applicable [Frontend/Web/UI/Mobile Engineer](../roles/frontend-ui.md), [UI/UX Designer and dedicated UI Reviewer](../roles/ui-ux.md), plus QA perspectives. Use the [UI workflow](../workflows/ui-change.md) and [self-review cycle](../workflows/self-review.md) to assess actual user behavior independently of the original design intent.

Audience: farm staff entering records in barns, owners reviewing finance, veterinarians examining history and prescribing, buyers accessing educational content. Favor readable forms, clear units, farm/animal identity and safe recovery on slow networks. Do not transplant the reference project's travel branding, luxurious spacing, animations or component libraries.

Web presentation uses configured Tailwind CSS 3.4 and Lucide. Public pages, auth dialogs and protected workspaces share theme tokens and static utility compositions. Flutter uses a Material 3 teal seed. Reuse the existing web foundations and define missing application patterns in the owning feature spec. Do not add a UI framework merely to satisfy a checklist.

## Required Tailwind workflow for every web agent

- Write standard Tailwind utilities directly in JSX. Extract repeated combinations into adjacent `*.styles.ts` files or reusable components. Use the shared `cn` helper for conditional/overriding class combinations.
- Keep complete literal class names, including responsive/state variants, in scanned `src/**/*.ts` and `src/**/*.tsx` files. Use finite literal maps for runtime choices; never construct fragments such as `bg-${color}`.
- Define shared colors/fonts in `apps/web/tailwind.config.ts`. Reuse the existing page container and workspace shell compositions so widths stay consistent. Per user direction, outer page containers use centered `w-11/12`; keep narrower inner text/dialog widths where appropriate. Exact arbitrary values/variants are allowed where the existing design needs them.
- Do not create custom CSS selectors, CSS Modules, Sass/Less, styled-jsx, CSS-in-JS, inline `style` props or DOM `.style` mutations. Do not move custom CSS into Tailwind plugins or inject styles through strings.
- `apps/web/src/app/globals.css` contains only `@tailwind base`, `@tailwind components` and `@tailwind utilities`. Native SVG geometry/presentation attributes are allowed. These infrastructure/asset allowances do not permit raw component styling.
- Preflight and the built-in `container` plugin are intentionally disabled to preserve native defaults. Public header, footer and page content share a centered `w-11/12` container without a maximum-width cap. Document-level defaults and locale/reduced-motion rules are Tailwind compositions in `src/lib/ui/site.styles.ts`; do not enable resets or override the shared width locally.
- Run `pnpm --filter @vetralink/web check:styles`, `test:styles`, a production build and relevant browser checks. Build runs the styling guard, and web CI runs its regression tests. See the [migration spec](../../docs/tasks/web-tailwind-migration/spec.md) and [evidence](../../docs/tasks/web-tailwind-migration/plan.md).

Web content must support Bangla and English with Bangla as the default. Reuse `apps/web/src/lib/i18n/` for copy, locale selection and number presentation; translate assistive labels and every form/loading/error/offline state as features are introduced. Keep API identifiers and stored values stable. The [localization spec](../../docs/tasks/web-localization/spec.md) owns the contract, and the web roadmap requires both-language acceptance for each future milestone.

Every data flow needs loading, empty, success, validation, permission-denied and recoverable-error states. Offline workflows must show pending/synced/conflicted status without promising a server save before acknowledgement. Preserve entered data on timeouts; avoid duplicate financial/clinical submissions and misleading optimistic success. Make farm switching and selected animal conspicuous.

Use semantic web controls, labels, keyboard navigation, visible focus, readable contrast, non-color status cues and touch-friendly controls. Test narrow phones and larger screens, zoom, long names, large values and translated text. Respect reduced-motion preferences. Accessible error messages should identify the field and recovery action without raw server errors.

Display explicit measurement units, currencies, date/time zones and relevant withdrawal warnings. Do not fabricate clinical advice or default a dangerous value to zero merely to render a screen. Confirmation/undo behavior should match the reversibility and clinical/financial impact of the action.

Inspect actual behavior in a browser/device when UI changes. Builds cannot validate layout, focus, touch behavior or offline recovery. Follow [client architecture](../architecture/clients.md) and [testing](testing.md).
