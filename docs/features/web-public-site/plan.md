# Web Public Site Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan task-by-task in the current session. Follow repository human-managed Git policy; do not stage, commit or push automatically. No delegation is required.

**Status:** Proposed for review. Planning artifacts authored; all application steps below are unstarted.
**Goal:** Deliver a responsive landing page and three useful public routes with a coherent navigation system.
**Architecture:** Next.js App Router with a marketing route-group layout, shared header/footer, static Server Components and an isolated client mobile-menu component. Later account/application URLs are reserved in the specification and are not scaffolded by this plan.
**Tech stack:** Existing Next.js 14, React 18, TypeScript and Lucide; global CSS and CSS Modules. No new production dependency, external font service or API integration.
**Spec:** [Public site and route architecture](spec.md).

## Global constraints

- First build includes `/`, `/farm-management`, `/learning`, `/veterinary-care` and unmatched-route recovery only.
- Initial copy is English. All product claims must follow the specification and actual readiness.
- No dead links, fabricated metrics/testimonials, fake signup/payment forms or unimplemented-route navigation.
- No changes to API, database, mobile, shared contracts or Git history.
- Prefer Server Components; isolate the mobile-menu state. Existing dependencies are sufficient.
- Static pages must render without a running API or external font/image provider.

## Review focus

1. Direct visits/refresh and unknown URLs must resolve correctly; root route must not collide after moving `page.tsx` (Tasks 1/3).
2. Keyboard and touch menu use, Escape, link selection and viewport resize must not trap focus or expose hidden duplicate navigation (Task 1).
3. Narrow screens, 200% zoom and long labels must preserve readable content and usable targets (Tasks 1–3).
4. Every CTA must lead somewhere useful, with unavailable future workflows absent from navigation (Tasks 2/3).
5. API/network unavailability and reduced-motion settings must not break informational pages or reveal fabricated live data (Tasks 2/3).

## File responsibilities

All paths below are relative to `apps/web/` unless noted. This is a planned file map, not an existing-file inventory.

| File | Responsibility |
| --- | --- |
| `src/app/layout.tsx`, `src/app/globals.css` | Root document, base metadata, CSS tokens, reset, typography, focus and reduced-motion rules |
| `src/app/(marketing)/layout.tsx` | Shared public header/footer and skip navigation |
| `src/components/marketing/site-header.tsx` | Brand and desktop navigation |
| `src/components/marketing/mobile-navigation.tsx` | Accessible client menu state |
| `src/components/marketing/site-footer.tsx` | Working public links |
| `src/components/marketing/marketing.module.css` | Shared shell, section and responsive styles |
| `src/lib/public-navigation.ts` | Typed public route labels/destinations shared by header/footer/menu |
| `src/app/(marketing)/page.tsx` | Landing-page composition replacing `src/app/page.tsx` |
| `src/components/marketing/landing-sections.tsx` | Hero, pillars, workflow, learning/vet previews, FAQ and final action |
| `src/app/(marketing)/farm-management/page.tsx` | Farm product overview and metadata |
| `src/app/(marketing)/learning/page.tsx` | Learning product overview and metadata |
| `src/app/(marketing)/veterinary-care/page.tsx` | Veterinary-care overview and metadata |
| `src/components/marketing/product-overview.tsx` | Shared presentation for the three overview pages |
| `src/app/not-found.tsx` | HTTP 404 recovery page with public navigation |

## Task 1 — Public shell and navigation (WEB-1A)

**Interfaces:** `PublicNavItem = { label: string; href: string }`; `PUBLIC_NAV_ITEMS: readonly PublicNavItem[]` holds the three first-build pillar links. `SiteHeader()`, `SiteFooter()` and `MobileNavigation({ items }: { items: readonly PublicNavItem[] })` consume that list. Root document owns global CSS; public layout owns the shell.

- [ ] Inspect current branch/worktree and preserve existing documentation changes; use existing checkout/isolation appropriate to the session. Confirm Node/pnpm versions and installed packages. Install frozen dependencies only if required and permitted.
- [ ] Establish baseline: build shared types, then web with commands in the verification table; record failures before modifying source.
- [ ] Implement CSS tokens, typography, focus and reduced-motion rules; implement shared header/footer and mobile disclosure behavior specified in AC3.
- [ ] Add marketing layout and move the existing home file into its route group, leaving only one `/` owner. Add a skip link targeting the page's `main` ID.
- [ ] Review shell at 360/768/1440 widths and 200% zoom. Verify toggle/Tab/Escape/link-selection/resize behavior, hidden-menu focus exclusion and 44px controls. Use an available browser harness or record reproducible manual evidence; no need to add a test framework solely for static styling.
- [ ] Recheck compilation and fix review findings. Do not mark the milestone complete while temporary pillar links lack their Task 3 destinations; the first release gate covers the entire plan.

## Task 2 — Landing page (WEB-1B)

**Interfaces:** `LandingSections()` renders the specification's ordered sections within the home page's single `<main id="main-content">`; shared shell consumes `PUBLIC_NAV_ITEMS`. No data fetching, auth state or persistence.

- [ ] Replace placeholder content with the hero, three product pillars, farm workflow, learning and vet-care explanations, FAQ and final action from the spec.
- [ ] Style the page with shared tokens and existing icons; use semantic illustrations rather than invented customer data or unlicensed assets. Keep decorative icons hidden from assistive technology.
- [ ] Set specific landing-page metadata. Confirm one H1, logical heading levels and valid in-page anchors.
- [ ] Review narrow/wide layouts, long copy, reduced motion and API-stopped behavior. Inspect copy against product scope; remove unsupported launch, pricing or clinical claims.
- [ ] Check FAQ keyboard interaction and every CTA against the route inventory; integration link acceptance completes in Task 3.

## Task 3 — Pillar routes and complete public navigation (WEB-1C)

**Interfaces:** `ProductOverview({ title, intro, sections }: { title: string; intro: string; sections: readonly { title: string; body: string }[] })` renders shared overview structure with a single main/H1. Each page provides its own copy and metadata; actions use the public navigation list.

- [ ] Implement farm-management, learning and veterinary-care pages with concrete content and valid cross-links from the page-contract table.
- [ ] Implement root not-found page with public shell, recovery link and semantic main; preserve actual 404 response semantics.
- [ ] Start the production web server after building. Directly request all four URLs and an unknown URL; verify 200 for each public page, 404 for the unknown route, correct titles and meaningful bodies.
- [ ] In a browser, follow all header/footer/CTA links, reload nested routes, use back/forward, and confirm there are no blank or reserved-route destinations.
- [ ] Repeat mobile/keyboard/zoom checks on the overview and 404 pages. Verify API-stopped behavior and absence of auth/payment/provider requests. Fix in-scope issues.

## Task 4 — Acceptance and handoff (WEB-1D)

- [ ] Review AC1–AC7 as a fresh reviewer; record route, interaction, visual and content findings and fix material issues.
- [ ] Run shared-types/web builds after final code changes, documentation validator and `git diff --check`; record actual results below.
- [ ] Update `apps/web/ROADMAP.md` WEB-1A–D only with evidence-backed completion; WEB-1E account access remains unstarted. Update `.context/architecture/clients.md`, `.context/project.md`, client-completeness wording in `.context/known-gaps.md` and `.context/sources.json` for the moved home source. Preserve historical snapshot dates/evidence and qualify new observations.
- [ ] Recheck docs links/anchors and scope. Report any browser/tool limitation; do not convert an untested visual criterion to a pass.
- [ ] Provide the completed first-build summary and suggested commit message. No automatic deployment or continuation into authentication/backend work.

## Verification evidence

Commands run from repository root. Use non-production resources only. The current web manifest has no browser test harness, and its lint script lacks established ESLint configuration; do not claim lint passed or expand scope to unrelated tooling.

| Command/check | Expected | Actual |
| --- | --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Exit 0; shared output built | Not run; planning only |
| `pnpm --filter @vetralink/web build` | Exit 0; four public routes compile | Not run; planning only |
| `pnpm --filter @vetralink/web start` | Production server on port 3000 after build | Not run; planning only |
| HTTP requests to `/`, `/farm-management`, `/learning`, `/veterinary-care`, `/route-that-does-not-exist` | 200/200/200/200/404 respectively | Not run; planning only |
| Browser checks from AC1–AC6 | Route, keyboard, responsive, copy and dependency behavior verified | Not run; planning only |
| `python3 .context/scripts/validate.py` and local Markdown link review | Valid context/source/link targets | Passed 2026-10-05: context validator; 222 documents / 466 local links, zero failures |
| `git diff --check` | No whitespace errors | Passed 2026-10-05 |

Suggested future implementation commit: `feat(web): add public landing pages and navigation`.


Planning review (2026-10-05): AC1–AC7 map to Tasks 1–4; route scope distinguishes public content from later authenticated features; first-build navigation has only planned first-build destinations. No application checks have been run and no application step has been checked off. Plan review remains the next step before implementation.
