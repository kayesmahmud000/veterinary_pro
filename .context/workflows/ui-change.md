# Workflow: web, mobile or UI change

**Inputs:** user outcome, affected screens/states and current client/API implementation. **Output:** usable behavior with visual, interaction and regression evidence. Read [client architecture](../architecture/clients.md), [UI rules](../engineering/ui.md) and the relevant [role profiles](../roles.md).

**Role progression:** Frontend/Web/UI or Mobile Engineer + UI/UX Designer during discovery/design/implementation; API/Backend when contracts change; Tech Lead for cross-layer impact; UI Reviewer + Code Reviewer + QA during [self-review](self-review.md). Add Security for session/private data and Database for local persistence.

1. Inspect the real entry screen/routes, existing state/components and API contracts. Establish the intended user flow, farm/animal identity, device/browser and network conditions; do not infer mature architecture from scaffold dependencies.
2. Record a proportional spec/plan. Define state ownership, navigation, forms/validation and loading/empty/error/permission/offline/success states. Trace API/shared/Dart/persistence dependencies and compatibility; reuse existing patterns before selecting new tools.
3. Implement the smallest complete flow with clear layout/hierarchy/feedback, semantic controls, focus behavior and responsive handling. Preserve input during recoverable errors; do not show an unacknowledged save as complete.
4. Before final tests, review as a user without developer knowledge and as a fresh code reviewer. Check overflow, spacing, consistency, disabled states, stale responses, duplicate submission and dependent screens. Fix in-scope findings.
5. Test relevant state transitions, slow/no network, failed APIs, permission denial, rapid actions, empty/long data and restart/navigation/farm switching. Inspect rendered UI at appropriate widths/devices with keyboard/zoom/accessibility checks. For sync changes also use the [offline workflow](offline-sync-change.md).
6. Run affected build/tests, re-review the resulting code and UI, then update docs/evidence. State browser/device/tool limitations explicitly. A build, screenshot or mocked API result alone does not prove the entire lifecycle.
