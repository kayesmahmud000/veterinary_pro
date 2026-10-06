# UI and UX requirements

UI work requires the applicable [Frontend/Web/UI/Mobile Engineer](../roles/frontend-ui.md), [UI/UX Designer and dedicated UI Reviewer](../roles/ui-ux.md), plus QA perspectives. Use the [UI workflow](../workflows/ui-change.md) and [self-review cycle](../workflows/self-review.md) to assess actual user behavior independently of the original design intent.

Audience: farm staff entering records in barns, owners reviewing finance, veterinarians examining history and prescribing, buyers accessing educational content. Favor readable forms, clear units, farm/animal identity and safe recovery on slow networks. Do not transplant the reference project's travel branding, luxurious spacing, animations or component libraries.

Existing web UI has a small global CSS token set and scoped public marketing styles; Flutter uses a Material 3 teal seed. No dashboard navigation or established application form/state library exists. Reuse existing public foundations when applicable and define missing application patterns in the owning feature spec. Do not add a UI framework merely to satisfy a checklist.

Web content must support Bangla and English with Bangla as the default. Reuse `apps/web/src/lib/i18n/` for copy, locale selection and number presentation; translate assistive labels and every form/loading/error/offline state as features are introduced. Keep API identifiers and stored values stable. The [localization spec](../../docs/tasks/web-localization/spec.md) owns the contract, and the web roadmap requires both-language acceptance for each future milestone.

Every data flow needs loading, empty, success, validation, permission-denied and recoverable-error states. Offline workflows must show pending/synced/conflicted status without promising a server save before acknowledgement. Preserve entered data on timeouts; avoid duplicate financial/clinical submissions and misleading optimistic success. Make farm switching and selected animal conspicuous.

Use semantic web controls, labels, keyboard navigation, visible focus, readable contrast, non-color status cues and touch-friendly controls. Test narrow phones and larger screens, zoom, long names, large values and translated text. Respect reduced-motion preferences. Accessible error messages should identify the field and recovery action without raw server errors.

Display explicit measurement units, currencies, date/time zones and relevant withdrawal warnings. Do not fabricate clinical advice or default a dangerous value to zero merely to render a screen. Confirmation/undo behavior should match the reversibility and clinical/financial impact of the action.

Inspect actual behavior in a browser/device when UI changes. Builds cannot validate layout, focus, touch behavior or offline recovery. Follow [client architecture](../architecture/clients.md) and [testing](testing.md).
