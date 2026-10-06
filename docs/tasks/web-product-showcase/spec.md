# Public product showcase specification

Status: Verified (local public-site scope)
Started and verified: 2026-10-07

## Outcome

Implement the user's approved landing-page improvements following the Shobar Khamar UI investigation. Make the product tangible near the top of the page, help visitors discover features by animal type, and provide useful learning content they can actually open. Retain Vetralink's forest-green identity and bilingual, responsive public navigation.

## Scope and contracts

- Replace the decorative hero landscape with an original HTML product preview. Existing goal selection changes its content and service destination. Show sample/planned labels and a prominent working demo link; never imply operational records or booking.
- Give all three service cards original lightweight product illustrations; preserve their working destinations.
- Add an accessible animal selector for cattle, goats, buffalo and poultry. Display relevant record categories, including flock/egg records for poultry, and identify these as planned product capabilities.
- Publish three original short, nonclinical guides about animal identity/history, milk recording, and income/expense records. Render article content and metadata on the server in both languages. Unknown article slugs return a localized 404.
- Provide learning topic filters with shareable query URLs, normal browser navigation, and an all-topics fallback for unknown values. Cards link to real articles and state their format/read time. Homepage previews link into the same catalog.
- Provide actual blank CSV templates for milk and expense guides in both languages. Download responses use safe fixed filenames, UTF-8, locale-aware headers and private/no-store caching. No uploaded, saved or invented farm data.
- Keep existing demo, calculator, workflow, FAQ, language preference and service feature explorers working.

## Boundaries and acceptance

No API, database, tenant, clinical, authentication, payment or dependency changes. No copied competitor assets, invented testimonials, coverage map, released-app badges or live-service promises. Keep `.gstack` absent; browser profiles stay in OS temp.

Verify a production build, existing planner/localization checks, new article/CSV HTTP behavior, URL filtering, keyboard selection and mobile reflow in Bangla and English. Inspect rendered desktop, 375px and 320px UI, focus and reduced motion. Update the plan with actual evidence; no deployment or Git mutation. Changes can be reverted without data migration.
