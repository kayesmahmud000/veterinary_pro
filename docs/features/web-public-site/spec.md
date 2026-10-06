# Web public site and route architecture specification

Status: **Approved by the user and implemented for the first public-site batch (WEB-1A–D)**. See [plan and verification evidence](plan.md). Account/application routes remain proposed.
Date: **2026-10-05**. Sources: current web scaffold and [product baseline](../../../vetralink_platform_specification.pdf) §1–5/§7, [blueprint](../../../vetralink_pro_blueprint.md), [web roadmap](../../../apps/web/ROADMAP.md), [API dependency register](../../../apps/api/ROADMAP.md#api-dependency-register).

## Outcome and boundaries

Help a first-time visitor understand VETRALINK PRO, identify the farm management, educational content or veterinary-care journey relevant to them, and navigate to a useful next page. Establish a consistent route architecture for later account and application features. The requested deliverables are a landing-page design, route plan, implementation plan and ordered web roadmap, followed by implementation from that plan.

**Original implementation baseline (before this feature):** `apps/web/src/app/page.tsx` was a title/description placeholder; `layout.tsx` supplies metadata and the HTML/body wrapper. At that baseline no public feature pages, authentication UI, navigation or API client existed. The first four public routes are now implemented; other routes below remain proposed. Assigning a URL does not mean a feature exists.

First build: four public information pages, shared responsive navigation/footer, visual foundations, page metadata and a useful not-found screen. Subsequent milestones integrate actual accounts, catalog, pricing and role-specific workspaces. Backend contracts, schemas and mobile behavior are unchanged by the first build.

## Positioning and visual direction

Approved working direction: lead with the farmer's daily work, with education and veterinary care as visible supporting pillars. The original first build used English. **Superseded by the user's 2026-10-05 requirement:** the website must support Bangla and English with Bangla as the default. The [localization specification](../../tasks/web-localization/spec.md) owns this contract and its [plan](../../tasks/web-localization/plan.md) records implementation and fresh evidence; retain the original first-build evidence as history.

Use deep forest green, warm off-white surfaces and a restrained amber accent. Use a readable system sans-serif stack, generous but practical spacing, clear section headings and high-contrast controls. Favor a calm agricultural/clinical identity. Use existing Lucide icons and CSS illustrations; no new image, font, animation or component service is required. Any illustrative product preview is labeled “Illustrative preview”; it must not present invented data as a real farm or shipped dashboard.

Alternatives considered: a single long page is quickest but provides weak destinations for the three distinct journeys; a full marketing site plus dashboards introduces unimplemented flows and broadens the first build. Recommended: a focused landing page plus three informative pillar pages, with later route families documented here.

## Landing page at `/`

| Order | Section | Content and action |
| --- | --- | --- |
| 1 | Header | VETRALINK PRO home link, Farm management, Learning, Veterinary care; primary action “Explore farm tools” → `/farm-management`. |
| 2 | Hero | Proposed heading: “A clearer picture of your farm. Better care for every animal.” Supporting copy explains connected records, learning and veterinary care. Primary action → `/farm-management`; secondary “Explore learning” → `/learning`. |
| 3 | Product pillars | Three short, specific descriptions linking to the three pillar pages. Explain what each area is intended to help with; avoid claiming unavailable workflows are live. |
| 4 | Daily farm workflow | Animal records → production and health records → financial overview → consultation context. Explain the journey without displaying fabricated metrics. |
| 5 | Learning and digital resources | Explain courses, guides and tools from the product baseline; link to `/learning`. No fake course catalog, prices or ratings. |
| 6 | Veterinary care | Explain consultation intake, animal history and prescriptions; link to `/veterinary-care`. Avoid invented clinical advice or promises of immediate availability. |
| 7 | FAQ | Concise answers about intended users, supported product areas and browser/mobile direction. Use native disclosure controls. Describe offline capability as planned until its acceptance criteria pass. |
| 8 | Final action and footer | Repeat relevant working pillar links and brand navigation. No placeholder contact details, social links, legal pages, testimonials, customer counts or certifications. |

Do not advertise sign-in, registration, purchases, subscription signup or booking as working until those routes and flows pass their own milestone. No empty `href="#"` links or navigation to reserved routes. Pricing figures come from the future plan API integration, not marketing constants.

## First-build page contracts

| URL | Purpose / page content | Valid next actions | API dependency |
| --- | --- | --- | --- |
| `/` | Landing page described above | Three pillar pages and in-page FAQ | None |
| `/farm-management` | Explain animal records, milk/health tracking, financial overview and their connected workflow | Home, learning and veterinary-care pages | None; no operational forms |
| `/learning` | Explain intended courses, eBooks and tools, purchase-to-library journey | Home and other pillar pages | None; actual catalog is a later route |
| `/veterinary-care` | Explain intake, EHR, consultation and prescription journey | Home and other pillar pages | None; no appointment/payment form |
| Unmatched URL | Branded “Page not found”, working home link and public navigation | `/` | None; must retain HTTP 404 |

All four pages have distinct titles/descriptions and one main heading. Static public content must render without a running API or external font/image provider.

## Route inventory and delivery ownership

These are proposed canonical URLs, not instructions to scaffold empty pages. Create each only in its owning milestone; do not expose reserved destinations in navigation. `[farmId]`, `[animalId]`, `[id]` and `[slug]` denote dynamic route segments, not literal links.

| Family / proposed URLs | Audience and purpose | Owning web milestone / API dependency |
| --- | --- | --- |
| `/`, `/farm-management`, `/learning`, `/veterinary-care` | Public discovery and product explanation | WEB-1A–D; no API |
| `/catalog`, `/catalog/[slug]` | Public course/eBook/tool discovery and detail | WEB-5; API-STORE |
| `/pricing` | Public live plan comparison | WEB-6; API-BILLING |
| `/login`, `/register` | Account entry, with safe internal return navigation | WEB-1E; API-AUTH |
| `/account`, `/account/orders`, `/account/orders/[id]`, `/account/library` | Authenticated account summary, own purchases and entitlements | WEB-1E / WEB-5; API-AUTH / API-STORE |
| `/checkout/[id]` | Authenticated product checkout using the backend product identifier; server determines price and payment state | WEB-5; API-STORE; detailed payment route/session contract required |
| `/app`, `/app/farms/new` | Authorized farm selection and self-service onboarding | WEB-2; API-FARM; blocked by API-B1 |
| `/app/farms/[farmId]`, `/app/farms/[farmId]/members` | Selected-farm overview and supported membership actions | WEB-2; API-FARM / API-BILLING |
| `/app/farms/[farmId]/animals`, `/app/farms/[farmId]/animals/new`, `/app/farms/[farmId]/animals/[animalId]` | Registry, registration, detail, pedigree and weights | WEB-3; API-ANIMAL |
| `/app/farms/[farmId]/milk`, `/app/farms/[farmId]/health`, `/app/farms/[farmId]/vaccinations`, `/app/farms/[farmId]/finances`, `/app/farms/[farmId]/reports` | Farm records, schedules and reporting | WEB-4; API-MILK / API-HEALTH / API-FINANCE |
| `/app/farms/[farmId]/billing` | Farm subscription, quota, access status and billing portal | WEB-6; API-BILLING |
| `/app/farms/[farmId]/consultations`, `/app/farms/[farmId]/consultations/new` | Farmer consultation history and intake | WEB-7; API-TRIAGE |
| `/consultations/[id]` | Shared authenticated room/EHR/chat/video shell; role-specific actions based on server permissions | WEB-8; API-ROOM |
| `/consultations/[id]/prescription` | Attending-vet editor or authorized signed-prescription view | WEB-9; API-RX |
| `/vet`, `/vet/availability`, `/vet/settlements` | Vet case entry, availability and ledger | WEB-7 / WEB-10; API-TRIAGE / API-SETTLEMENT |
| `/admin/triage`, `/admin/metrics`, `/admin/reviews` | Authorized triage/assignment, metrics and review moderation | WEB-7 / WEB-10; API-TRIAGE / API-BILLING / API-SETTLEMENT |
| `/verify/prescription/[id]` | Public verification page, distinct from `/api/v1/verify/prescription/:id` | WEB-9; API-RX |

Authentication and role names must follow [shared enums](../../../packages/shared-types/src/enums/index.ts) and controller authorization, not inferred personas. A `/vet` or `/admin` pathname is not an authorization boundary. Backend checks remain mandatory. Private pages must not cache another user's or farm's data. Future API failures need retry/error/empty states without losing user input. Authentication/session storage and return-URL validation require their own WEB-1E spec before implementation; this plan does not choose an insecure placeholder mechanism.

## Next.js structure and interactions

Keep `src/app/layout.tsx` as the shared root document and import `src/app/globals.css`. Move the placeholder home to `src/app/(marketing)/page.tsx` when replacing it; do not leave two routes owning `/`. A `(marketing)/layout.tsx` supplies public header/footer without wrapping future private workspaces. Next.js route groups do not appear in URLs.

Implement the three public overview routes beneath `(marketing)`. Future `(auth)` and `(workspace)` groups can supply distinct shells when their implementation begins. The root `not-found.tsx` uses the public shell explicitly because unknown paths are not guaranteed to render inside the marketing layout.

Default to Server Components. Locale is resolved per request with a persistent language-selection form as specified in the localization task; the current public URLs remain unchanged. Limit client state to a mobile-menu component: toggle button with accessible name, `aria-expanded` and `aria-controls`; closed items leave the focus order; Escape closes and returns focus to the toggle; selecting a link closes the menu. Use a non-modal disclosure menu, native anchors/Next Link and native `<details>` for FAQs. A desktop breakpoint must not leave duplicate focusable navigation exposed.

## Acceptance criteria

- **AC1:** all four specified public URLs render meaningful, distinct content; direct visit, refresh and browser back/forward work. Unknown paths return 404 with recovery navigation.
- **AC2:** every visible navigation/CTA target exists or points to an existing section; no reserved-route, fake form or dead-link actions.
- **AC3:** keyboard users can reach the skip link, navigation, mobile toggle and FAQ controls; menu focus/expanded state behaves as specified.
- **AC4:** no horizontal overflow at 360, 768 or 1440 CSS pixels or at 200% zoom; headings, controls and long labels remain readable; touch targets are at least 44×44 CSS pixels. Meet WCAG AA text contrast (4.5:1 normal text, 3:1 large text); visible focus and reduced-motion support.
- **AC5:** the first build works with the API stopped, contains no private data/secrets, invented testimonials/results or false feature-readiness claims, and does not make auth/payment/provider calls.
- **AC6:** unique metadata, semantic landmarks and a single H1 per page; decorative icons hidden from assistive technology. Canonical host is deferred until a real deployment domain is known.
- **AC7:** shared-types/web builds pass and rendered browser checks are recorded. A missing browser/tool must be reported as a verification limitation, not a visual pass.

## Review and rollout

Web/UI/UX and architecture perspectives define this design; QA, code and UI review validate the rendered result. Main risks are dead navigation, misleading launch copy, keyboard/mobile regressions and accidental collision at `/`. No migrations or API rollout are required. Rollback restores the previous web page/layout and removes the newly introduced public assets/routes, preserving unrelated changes. Update current client context and roadmap status only after verification.
