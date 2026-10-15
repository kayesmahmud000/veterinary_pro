# Web milk production — recording, history, analytics and export

Status: Deferred by user direction on 2026-10-13; proposed design remains unapproved. No application implementation started.
Date and inspected revision: 2026-10-13 / `d0385ec`.

## Outcome and scope

Original selection: **C1 — Milk logs/analytics**, the first later domain handoff in the [workspace implementation plan](../web-workspace-design/plan.md), under WEB-4 / API-MILK. **Superseded priority, 2026-10-13:** the user requested the Admin/Super Admin dashboard and its full administrative roadmap first. Follow the [admin delivery roadmap](../../../apps/web/ROADMAP.md#admin-and-super-admin-delivery-roadmap); retain this milk proposal for later planning. Advanced WEB-3 pedigree/weights/import/tags remain separate follow-ups.

Deliver an authorized farm milk workspace where members can record individual-animal milk or a bulk tank collection, browse filtered history, inspect seven-day yields and download the existing backend CSV/Excel exports. Reuse the shared full-width workspace, mandatory Farmer setup, farm membership, session and locale boundaries. Bangla is the default and English is complete.

This slice includes creation, read history, analytics and exports. Milk editing/deletion, anomaly management, notifications, offline persistence, billing changes and other farm domains require their own acceptance slices. No new database columns, migrations, provider integration or product dependencies are proposed.

## Current implementation and evidence

**Confirmed from documentation:** workspace Tasks 1–6 are implemented locally; C1 requires individual/bulk recording semantics, dates/units, duplicate/retry handling, authorized export and a seven-day chart with a text alternative. Live API/database acceptance for the latest workspace is still pending.

**Confirmed from code:**

- [MilkLogsController](../../../apps/api/src/modules/milk-logs/milk-logs.controller.ts) provides POST `milk-logs`, POST `milk-logs/bulk`, GET `milk-logs`, GET `milk-logs/analytics` and binary GET `milk-logs/export`. These operations require JWT, tenant membership and OWNER/MANAGER/HERDSMAN/VET_STAFF farm roles. Primary account role alone does not grant access.
- [MilkLogService](../../../apps/api/src/modules/milk-logs/services/milk-log.service.ts) checks individual animal membership, female dairy species and allowed status, detects duplicate animal/date/session or bulk farm/date/session records and commits creation with its audit record. Bulk contributor count, temperature and notes are written into the audit record; they are absent from the [public log response](../../../packages/shared-types/src/dto/milk-logs/milk-log-response.dto.ts).
- [Analytics](../../../apps/api/src/modules/milk-logs/utils/milk-yield-analytics.util.ts) adds the returned records. `entryType=ALL` combines individual and bulk logs, which can describe overlapping milk. Analytics has no session filter. It supplies UTC daily buckets, totalRecords and movingAverage7Day.
- [MilkExportService](../../../apps/api/src/modules/milk-logs/services/milk-export.service.ts) returns CSV or EXCEL, caps exports at 10,000 records and uses English column names. CSV text escaping quotes delimiters but does not neutralize formula prefixes; this must be corrected and tested before exposing CSV download through the new UI.
- [Workspace server](../../../apps/web/src/lib/workspace/server.ts) already validates the selected farm and fixed JSON endpoints, checks membership/access for sensitive writes and rejects cross-farm response identifiers. It currently parses every successful upstream response as JSON. Binary export therefore needs an explicit fixed response mode.
- Existing [farm schemas](../../../apps/web/src/lib/workspace/farm-contracts.ts) expose only the milk overview summary. [FarmPage](../../../apps/web/src/components/workspace/farm-page.tsx) and [farm navigation](../../../apps/web/src/lib/workspace/farm-navigation.ts) have no operational milk destination.

**Unknown:** real deployed endpoint behavior, production server timezone, current isolated service availability and alternate-browser acceptance. No test/build/runtime claim is made by this specification.

## Design and alternatives

Recommended: extend the existing farm workspace and allowlisted cookie BFF with focused milk components and schemas. This preserves identity, tenant, draft and styling conventions while delivering a usable domain slice.

A recording-only form would leave C1 analytics/export acceptance incomplete. A separate standalone dashboard would duplicate the working farm/session boundaries. Neither alternative improves the existing implementation sequence.

Proposed routes:

- `/app/farms/:farmId/milk`: history, filters, analytics and export controls.
- `/app/farms/:farmId/milk/new`: individual/bulk creation form; a validated `type=bulk` query may select the initial mode.

Add Milk production to authorized farm navigation when its route works. Offer its overview action where the existing farm overview presents milk. Direct routes remain membership-gated even where a non-dairy farm overview hides its milk card. Animal eligibility is determined from animal records, not assumed from farm type.

Keep page composition, data contracts, form validation, messages and chart rendering in focused files. Proposed additions are `lib/workspace/milk-contracts.ts`, `milk-data.ts`, `lib/i18n/milk.ts`, `components/workspace/milk-workspace.tsx`, `milk-form.tsx`, `milk-chart.tsx` and route files. Extend existing farm composition/navigation rather than creating another authentication provider or farm context.

## Contracts and persistence

Proposed fixed web BFF paths are relative to `/api/workspace/`:

| Web path | Method | Existing upstream | Output |
| --- | --- | --- | --- |
| `farms/:farmId/milk/logs` | GET | `milk-logs` | Validated paginated log items/meta |
| `farms/:farmId/milk/logs` | POST | `milk-logs` | Validated created log |
| `farms/:farmId/milk/bulk` | POST | `milk-logs/bulk` | Validated created bulk log |
| `farms/:farmId/milk/analytics` | GET | `milk-logs/analytics` | Existing overview-compatible summary plus chart fields |
| `farms/:farmId/milk/export` | GET | `milk-logs/export` | Bounded CSV/XLSX attachment |

All routes use strict UUID farm paths, cookie authorization, server-owned `x-farm-id`, fixed upstream destinations, no redirect forwarding, bounded request timeouts and private/no-store responses. Reject unknown or repeated query/body keys, injected farm/actor/metadata fields and unsupported methods. Check each returned log's farmId; individual creation also checks returned animalId against the submitted animal. Bulk creation requires animalId=null. Analytics must match the requested farm, animal and reporting period.

Keep the existing analytics overview call backward compatible. Add optional animalId and validate the needed daily/summary fields without requiring irrelevant fields from existing overview projections. Domain consumers require chart data before rendering analytics; malformed or missing chart fields produce a recoverable error rather than fabricated values.

Creation must use the existing membership and `canRead`/`canWrite` access-status preflight, including rejection on missing/malformed/unavailable subscription state. Milk writes do not consume the ANIMALS registration quota. The API remains the final authority for tenant/role, duplicate constraints, audit and transaction behavior. Existing backend milk routes do not wire SubscriptionReadOnlyGuard; web preflight does not establish equivalent protection for direct API clients.

### Recording

Individual required fields: animalId, session, loggedDate and yieldLiters. Yield is 0.001–100 liters with at most three decimal places. Optional fatPercent and snfPercent are 0–20 with at most two decimal places. Eligible animals are female COW/BUFFALO/GOAT/SHEEP/CAMEL, excluding SOLD/DECEASED/CULLED, matching current service rules. Provide searchable/paginated farm animal selection; never present one fetched page as the complete herd.

Bulk required fields: session, loggedDate and yieldLiters (0.1–100,000 liters, up to three decimal places). Bulk is one tank collection per farm/date/session, not a batch of individual-animal writes. Include only the persisted common fields and optional fat/SNF in this first UI; exclude contributor count, temperature and notes until readable persistence is designed.

Sessions are MORNING/AFTERNOON/EVENING with translated labels. Numeric input accepts Bangla and ASCII digits, rejects invalid/exponent/infinite values and sends canonical numbers. Optional empty values are omitted; do not silently round excess precision. Date input is a real YYYY-MM-DD calendar date, no later than the current UTC business date. Show the UTC recording/reporting date and the Asia/Dhaka local date explicitly when they differ. Existing service creation checks use the server's local end-of-day; record this mismatch and verify the deployed timezone before integrated acceptance.

Disable duplicate submissions with an immediate ref guard and pending controls. Preserve inputs after validation, conflict, denied access, timeout or transport failure. Announce success only after a validated server response, then return to the corresponding date/source history. Preserve dirty drafts during same-account revalidation; confirm discard on farm/route/mode changes; remove them on actual identity/farm changes. No browser storage persistence.

On 409 show a localized existing-record explanation and link to matching history. On an uncertain timeout ask the user to inspect history before resubmitting. Do not automatically replay a write on timeout. Existing session restoration may retry an explicit 401 through its serialized refresh boundary.

### History and analytics

History defaults to the last seven UTC dates inclusive, INDIVIDUAL source, page 1, limit 20 and loggedDate descending. Use URL-backed date, source, animal and session filters; preserve query and Back behavior, and reset pagination on filter changes. Query schemas mirror the inspected [list DTO](../../../apps/api/src/modules/milk-logs/dto/milk-log-query.dto.ts); bound dates to the last permissible business date and periods to 730 days. Use server pagination metadata.

Show date, source (individual/bulk), animal tag/name or Bulk collection, session, liters and optional fat/SNF; omit recorder email from ordinary history rendering. Use actual null fallbacks and locale formatting, retaining three decimal places where needed for recorded volumes.

Analytics defaults to INDIVIDUAL and the same date/animal/source filters. Changing source to BULK switches the measurement view. ALL is explicitly labeled as the combined sum of both recording sources, with a localized explanation that overlapping records can count the same milk twice. Do not imply deduplication or inventory reconciliation. Clear animal filtering when selecting BULK. Session filtering applies only to history/export; label analytics as all sessions.

Render daily yield and the API-provided seven-day moving average with native SVG geometry/presentation attributes, Tailwind classes and an adjacent accessible table. Default chart window is seven days; wider requested periods remain bounded by the query contract. Do not derive farm totals from the current history page. Distinguish totalRecords=0 (no entries) from a legitimate zero bucket within a recorded period. Expose loading, empty, denied, malformed and retryable error states independently for history and analytics. Hide stale results immediately on account/farm/query changes.

### Export

Export uses the current history date/animal/source/session filters with format CSV or EXCEL and explicit limit=10000. Explain that an export contains at most 10,000 records and may require narrower dates; do not claim it is complete based on paginated history count. Downloads retain existing backend column language, with localized UI disclosure that file headers are English.

Implement an explicit attachment response mode within the fixed workspace boundary. Successful CSV/XLSX responses bypass JSON parsing, validate expected MIME types, enforce a 32 MiB streamed byte limit even without Content-Length, cancel failed/oversized streams and set a server-generated safe filename. Preserve existing JSON error mapping on failure, same-origin credentials, refresh serialization and private/no-store headers. No browser-supplied upstream URL/header or arbitrary attachment proxy.

Before enabling CSV, add a focused backend correction for formula-leading user-controlled text cells, including leading whitespace/control characters, while retaining RFC quoting and UTF-8 BOM. Numeric volumes must remain numeric. Verify XLSX text cells remain string cells and do not acquire formula metadata. This narrow export correction is part of the download path; no unrelated export redesign is proposed.

## Roles, risk and rollout

Use Frontend/Web + UI/UX for the flow, API/Security for the scoped cookie/binary boundary and export correction, and Code Reviewer + QA/UI Reviewer for acceptance. Preserve the six primary roles, required setup, professional memberships, existing animal/member actions and public localization.

Main risks are mixing individual/bulk totals, accepting another farm's data, replaying an uncertain write, losing a draft, treating API failure as zero, and handling binary downloads as JSON. Tests must exercise those boundaries. No migrations, worker/provider configuration or deployment are needed for local implementation. Recovery is to remove the new milk navigation and routes or revert the scoped application changes; already persisted milk logs remain governed by the existing API.

## Acceptance criteria

1. Contract tests fail before implementation for the new mappings and pass afterward: fixed routes/methods, strict payload/query/date/precision validation, cookie/tenant forwarding, membership/read-only denial, cross-farm/wrong-animal responses, malformed analytics, pagination and 401 refresh behavior.
2. Download tests exercise actual CSV/XLSX bytes, appropriate MIME/filename/cache headers, JSON upstream errors, unauthorized/timeout handling, misleading/missing Content-Length and enforced byte limits. Backend regression tests verify CSV formula neutralization and XLSX text versus numeric cells.
3. Controlled-upstream browser acceptance covers both languages, individual and bulk creation, eligible-animal search/pagination, pending submit, conflict/timeout input retention, dirty navigation, source/animal/session/date filtering, chart/table agreement, empty/error distinction, farm-switch response isolation, read-only denial and actual downloaded files.
4. Responsive/keyboard review covers 320/375/768/1024/1440px, long Bangla/tag labels, focus/error announcements, sidebar/drawer behavior and no horizontal overflow. Native SVG uses no inline styles or handwritten CSS.
5. Existing auth/workspace/navigation/farm checks, protected-route checks, Tailwind policy/style suites and an isolated production build pass. Use a separate build directory to preserve the developer's active `.next`.
6. Attempt real isolated API/PostgreSQL/Redis acceptance through the [existing runbook](../../features/role-request-approval/operations.md). Exercise individual/bulk create/read/duplicate and cross-farm denial without production data. Record unavailable infrastructure and provider/runtime limits accurately; controlled fixtures do not replace this evidence.
7. Update WEB-4 and workspace evidence with the exact implemented slice and commands/results. Keep editing/deletion/anomaly features and integrated production acceptance pending. Respect human-managed Git: no staging, commit, merge or push.

## Design review record

2026-10-13: inspected current controller, DTOs, service/entity rules, analytics aggregation, export bytes and existing web JSON/session/farm boundaries. Self-review identified combined-source overlap, audit-only bulk metadata, UTC/local date differences and missing binary response handling; the design specifies their UI/contracts and evidence limits. CSV formula-prefix handling is included as a focused prerequisite for the new download path. This is a proposed specification, not implementation or release evidence. An implementation plan follows review of this document.
