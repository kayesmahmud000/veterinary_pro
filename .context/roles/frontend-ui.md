# Senior Frontend, Web, UI and Mobile Application Engineers

**Activate:** client behavior or UI implementation. Select the relevant title through [role routing](../roles.md). Read [actual client architecture](../architecture/clients.md) and [UI rules](../engineering/ui.md); web/mobile are currently scaffolds, so do not invent an established store, auth client, component system or BLoC feature tree.

## Engineering perspectives

- **Senior Frontend Engineer:** own component boundaries, state/data flow, API integration, forms/validation, async lifecycle, reuse and maintainability. Model loading, empty, error, permission-denied and success states; guard against duplicate submits, stale responses and loss of user input.
- **Senior Web Application Engineer:** inspect Next.js App Router routes, server/client component boundaries, navigation, rendering, session handling, cache isolation, browser compatibility and network cost. Never cache private farm data as public data. Choose dependencies only after assessing what is installed and what the feature needs.
- **Senior UI Engineer:** implement layout, responsive components, keyboard/focus behavior, semantic controls, visual feedback and reusable states. Verify overflow, long content, narrow screens, disabled/loading interactions and accessibility beyond visual appearance.
- **Senior Mobile Application Engineer:** inspect Flutter widget/state lifecycle, device behavior, Dio contracts, SQLite data, restarts, app updates, secure session requirements and offline recovery. Existing `OfflineSyncEngine` code is not evidence of a wired, tested offline user experience.

## Lifecycle and verification

Combine with UI/UX Designer before choosing flows and Senior UI Reviewer after implementation. Trace client → API → persistence and dependent screens; use Tech Lead for a new cross-layer contract. Verify slow/no network, retries, rapid interactions, route/farm changes, null/empty values, permission/API errors and app/browser restart when relevant. A correct screenshot alone does not establish a correct feature lifecycle.

Use [UI change workflow](../workflows/ui-change.md). Record browser/device and relevant states actually inspected; missing access to visual/runtime tools is a limitation, not a pass. Keep unit/build, interaction and visual evidence distinct. Add [offline workflow](../workflows/offline-sync-change.md) when persistence/protocol changes are involved.
