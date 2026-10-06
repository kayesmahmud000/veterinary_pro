# Web and mobile architecture

Client work uses the applicable [senior client engineer](../roles/frontend-ui.md) with [UI/UX Designer and UI Reviewer](../roles/ui-ux.md). Use the [UI workflow](../workflows/ui-change.md); the implementation facts below constrain design choices and must not be replaced by generic assumptions.

## Web: public site implemented; account and application UI pending

Updated 2026-10-06 after public-site localization. `apps/web/src/app/layout.tsx` owns the root document and global CSS. `(marketing)/layout.tsx` owns public navigation/footer; `(marketing)/page.tsx` and the farm-management, learning and veterinary-care routes render informational product content. Root `not-found.tsx` provides 404 recovery. Shared marketing components use CSS Modules, Lucide icons and small client mobile-menu/language-selector components; the remaining page composition is server rendered.

**Confirmed from code:** `src/lib/i18n/` owns typed Bangla/English catalogs, locale validation and number formatting. `getLocalization()` resolves the request's `vetralink-locale` cookie with Bangla (`bn`) as the default, including invalid preferences. The root HTML language and generated metadata use that same locale. The selection action persists a validated preference and redirects to a validated local path/query. Existing public URLs are preserved; cookie-dependent pages render per request rather than as static exports. Separate indexable locale URLs/hreflang are not implemented. See the [localization spec](../../docs/tasks/web-localization/spec.md) and [verification plan](../../docs/tasks/web-localization/plan.md).

Public pages have no API dependency. There is no implemented auth/session flow, API client, global client store, dashboard, private feature navigation or browser offline storage. Do not infer operational farm tools from the public overview pages. Route inventory and implementation evidence live in [public-site spec](../../docs/features/web-public-site/spec.md) and [plan](../../docs/features/web-public-site/plan.md); the [web roadmap](../../apps/web/ROADMAP.md) owns progress.

Next.js App Router supplies routing, with strict TypeScript and `@/*` → `src/*`. The implementation uses global CSS tokens and scoped marketing styles; Tailwind is declared but not configured as the design system. For future account/data features specify session handling, cache isolation, API errors and tenant permissions before adding dependencies. Never treat client navigation as server authorization.

## Mobile: scaffold plus offline library

`apps/mobile/lib/main.dart` contains `VetralinkApp`, a Material 3 app using a teal seed and one text screen. `flutter_bloc` is declared but no feature BLoCs or navigation/auth flows are implemented. Do not invent an established state-management convention beyond this dependency and the architectural intent.

`lib/core/sync/` contains `OfflineDatabase`, `OfflineSyncEngine`, `SyncClient` and Dart sync DTOs. Dio performs HTTP calls, sqflite stores six domain tables plus queue/metadata. `SyncClient` defaults to localhost and accepts an injected Dio/base URL; production device configuration and secure session persistence still need design. The entry screen does not initialize or invoke this engine.

No Android/iOS platform projects are present at the inspected baseline, although mobile CI attempts an Android release build. The database imports `package:path/path.dart` without a direct `path` entry in `pubspec.yaml`; dependency hygiene should be verified during mobile work.

See [offline behavior](../features/offline-sync.md), [UI standards](../engineering/ui.md), and [testing](../engineering/testing.md) before implementing clients.
