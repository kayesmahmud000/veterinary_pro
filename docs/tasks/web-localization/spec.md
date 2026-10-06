# Bangla and English web localization specification

Status: **Verified for the existing public website**
Requirement date: **2026-10-05**. Implementation/verification: **2026-10-06**. Inspected source baseline: **c07395b**, plus this working-tree change.

## Outcome and scope

User requirement: the website supports Bangla and English, with **Bangla as the default**. This supersedes the English-first decision in the [public-site specification](../../features/web-public-site/spec.md). Implement all currently available public pages and establish reusable localization rules for future [web milestones](../../../apps/web/ROADMAP.md). Account, API, database and mobile features remain outside this change.

## Current implementation

**Confirmed from code:** `apps/web/src/app/layout.tsx` sets `lang="en"`; the four public pages, marketing components, mobile-menu labels, metadata and 404 contain English constants. No locale selection or translated message catalog exists. Current pages have no API dependency. Existing public-site browser evidence is historical; localization needs fresh validation.

## Design, contracts and impact

- Supported locales are `bn` (Bangla) and `en` (English). Missing or unsupported preferences resolve to `bn`, regardless of browser language.
- Keep established URLs (`/`, `/farm-management`, `/learning`, `/veterinary-care`). Resolve the locale on the server from a validated `vetralink-locale` cookie. Public pages become request-rendered so HTML, accessibility labels and metadata always use the same language without an English flash or hydration mismatch.
- Provide a semantic বাংলা / English form in the shared header. A small client component captures the current path/query and renders a native form, including during server rendering. A Next.js Server Action validates the selection and saves a first-party, HTTP-only, SameSite=Lax cookie for one year, scoped to `/` and secure in production. It validates the internal return URL and redirects to the current page so a fresh request reads the new cookie, including without JavaScript. Navigation, refresh and later visits preserve the preference. Locale is a presentation preference, never an authorization boundary.
- Use complete, typed message catalogs for both languages. Components receive the selected catalog rather than embedding translatable copy. Brand names remain recognizable. Number presentation uses `Intl.NumberFormat` (`bn-BD` / `en-BD`), including step numbers and the copyright year. Future data screens use explicit units/currency and `Asia/Dhaka` dates; do not reinterpret API data or medical values.
- Use installed system Bengali fonts with relaxed Bangla heading line height and letter spacing; avoid external font requests. Retain responsive layouts, visible focus, 44px controls, semantic landmarks and menu/FAQ behavior.
- Metadata titles/descriptions and document language follow the preference. Distinct indexable locale URLs/hreflang are not claimed: this implementation uses the existing URLs, whose default crawler representation is Bangla. A later SEO requirement can introduce locale URLs through a separate routing contract.

Frontend/Web, UI/UX, Tech Lead, UI Reviewer, Code Reviewer and QA perspectives apply. Risks: missed text, Bangla glyph clipping, header overflow, stale metadata after switching and cookie/request caching mistakes. No new production dependency or backend contract is needed. Rollback reverts web localization and associated docs; there is no data migration.

## Acceptance

1. A fresh visit to each public route and an unknown route renders Bangla content, `html lang="bn"` and localized metadata. Invalid preferences also fall back to Bangla. Unknown routes retain HTTP 404.
2. Switching to English translates all visible public copy, FAQ, illustrative labels, navigation, recovery messages and assistive labels. Switching back restores Bangla. The current URL is preserved; refresh, navigation and a later visit retain selection.
3. Server-rendered output works without the API, external resources or JavaScript. Concurrent visitors with different cookies receive their own locale; no global mutable language state exists.
4. Both catalogs have the same complete typed structure. No raw translation keys or silent English fallbacks appear. Native-language selector labels and the brand are intentional exceptions.
5. Both languages remain readable without horizontal overflow at 360, 768 and 1440 CSS pixels and 200% zoom. Menu Escape/focus, keyboard language selection and native FAQ still work.
6. Web build, focused behavioral/browser checks, context validation and whitespace review pass, or unavailable checks are explicitly recorded. The roadmap links evidence and requires bilingual acceptance for every future web milestone.
