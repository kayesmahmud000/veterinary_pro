# Web and mobile architecture

Client work uses the applicable [senior client engineer](../roles/frontend-ui.md) with [UI/UX Designer and UI Reviewer](../roles/ui-ux.md). Use the [UI workflow](../workflows/ui-change.md); the implementation facts below constrain design choices and must not be replaced by generic assumptions.

## Web: scaffold, not a complete portal

`apps/web/src/app/layout.tsx` defines metadata and `<html lang="en">`; `page.tsx` renders a simple title/description with inline styles. These are the only application UI source files at the baseline. There is no implemented API client, authentication state, router guard, global client store, reusable component library or feature route group.

Next.js App Router supplies file-based routing. Keep server components by default and introduce client components only for interactive behavior. `apps/web/tsconfig.json` enables strict checking and `@/*` → `src/*`. Tailwind is declared in the package but a stylesheet/configured design system is not present. Do not describe React Query, Zustand, Axios, Firebase, DaisyUI or Radix as installed architecture.

For a new UI feature, document the actual contract, token/session handling, cache isolation, environment config and user flow in its spec before introducing dependencies. Never cache private tenant data as public data. A UI guard complements server authorization; it cannot replace it.

## Mobile: scaffold plus offline library

`apps/mobile/lib/main.dart` contains `VetralinkApp`, a Material 3 app using a teal seed and one text screen. `flutter_bloc` is declared but no feature BLoCs or navigation/auth flows are implemented. Do not invent an established state-management convention beyond this dependency and the architectural intent.

`lib/core/sync/` contains `OfflineDatabase`, `OfflineSyncEngine`, `SyncClient` and Dart sync DTOs. Dio performs HTTP calls, sqflite stores six domain tables plus queue/metadata. `SyncClient` defaults to localhost and accepts an injected Dio/base URL; production device configuration and secure session persistence still need design. The entry screen does not initialize or invoke this engine.

No Android/iOS platform projects are present at the inspected baseline, although mobile CI attempts an Android release build. The database imports `package:path/path.dart` without a direct `path` entry in `pubspec.yaml`; dependency hygiene should be verified during mobile work.

See [offline behavior](../features/offline-sync.md), [UI standards](../engineering/ui.md), and [testing](../engineering/testing.md) before implementing clients.
