# About services section

Status: Verified locally
Date: 2026-10-29

## Outcome and scope

Add the supplied reference's service overview to `/about`, with Khamar School replacing PraniSheba Vet. Retain all eight categories: treatment, breeding, grass cultivation, deworming and vaccination, farm planning, farm management, supplies, and dairy farm management. Preserve existing About content and bilingual locale behavior.

## Current implementation and design

**Confirmed from code:** `apps/web/src/app/(marketing)/about/page.tsx` renders the shared public shell and translated introductory, mission, audience and values content from `src/lib/i18n/public-pages.ts`; it has no service diagram.

Use a server-rendered `AboutServices` component in `src/components/marketing/about-services.tsx`. At wide desktop widths, show the circular eight-service diagram beside an introduction headed “What is Khamar School?”; stack at intermediate widths. Below 768px, render the same services as a readable two-column semantic list. Use native SVG geometry, Lucide icons and complete Tailwind classes. Reuse the existing introduction without importing the reference's government-approval or hospital claims.

## Contracts, impact and acceptance

No API, authentication, clinical workflow, persistence or dependency changes. This is informational content without booking actions. UI/UX, frontend and Code Reviewer/QA perspectives apply. Existing unrelated local changes must be preserved; Git remains human-managed.

- Center branding and introduction use Khamar School in both locales.
- All eight reference services appear with distinct colored icons; assistive technology receives the service list without duplicate diagram content.
- Bangla remains the default; English follows the existing locale switch.
- Verify both locales at 320, 375, 768, 1440 and 1920px, including overflow and long labels.
- Run the styling guard/tests, production build, relevant public-page and localization checks; record evidence in the plan.

Parent contracts: [public site](../../features/web-public-site/spec.md), [localization](../web-localization/spec.md). Rollback consists of removing the component invocation, component and added translation keys.
