# ADM-9 integrated administration release acceptance

Status: local acceptance verified; production release gates open. Date: 2026-10-22. Inspected revision: `a07d77f` plus ADM-9 working-tree changes. [Evidence](plan.md) · [Release decision](release-gates.md).

## Outcome and scope

Execute the [ADM-9 roadmap](../../../apps/web/ROADMAP.md#admin-and-super-admin-delivery-roadmap) against the selected ADM-1–8 administration features. Produce reproducible integrated evidence, correct acceptance failures within scope, and prepare a concrete rollout/recovery decision. ADMIN and SUPER_ADMIN must complete their permitted journeys in Bangla and English; ordinary roles must remain excluded. Preserve the admin-first priority, existing contracts, financial/clinical history and human-managed Git policy.

This is acceptance of existing subsystems, not a new architecture. Production deployment, live migrations and external message/payment/provider mutations require an identified target and release authorization. Local tests use explicit disposable loopback services and synthetic identities. Missing release evidence remains an open gate, never a successful check.

## Current implementation and approach

**Confirmed from code:** `apps/web/scripts/check-dashboard-browser.mjs` has separate directory/catalog/course/billing/consultation/finance/communications/platform production-browser scenarios. `apps/api/src/modules/administration/` contains guarded directory, billing, consultation, settlement, review, communications and platform implementations, with opt-in database suites for most slices. The standalone `role-notifications.worker.ts` starts the durable email worker; HTTP/serverless hosting alone does not establish that worker's operation.

**Confirmed from documentation:** the individual [ADM-8](../admin-settings-reports/plan.md), [ADM-7](../admin-communications/plan.md), [ADM-6](../admin-settlements-moderation/plan.md), [ADM-5](../admin-consultations/plan.md), [ADM-4](../admin-billing/plan.md), [ADM-3](../admin-product-media/plan.md), [ADM-2](../admin-directory-audit/plan.md) and [ADM-1](../../tasks/web-admin-dashboard/plan.md) plans record different environments and unresolved release limits. Their historical passes do not certify this revision.

Reuse the existing actual API/BFF/browser suites and execute them against the same source snapshot. Add tests only for material uncovered acceptance boundaries or reproduced failures. A replacement end-to-end framework would duplicate substantial coverage; documentation alone would leave the integration untested. Maintain one acceptance matrix and one runbook here, with results distinguished as real persistence, real Redis/worker, controlled HTTP/browser, build/static and unverified external/deployed behavior.

## Acceptance criteria

1. Shared/API/web production builds and relevant API/web boundary/style regressions pass on the selected revision. Capture failures, skipped tests, runtime versions and advisory status accurately.
2. Production Chrome exercises both administrative roles, bn/en, mobile/desktop layouts, permitted navigation and sensitive confirmation flows across ADM-1–8. Verify permission denials, stale/uncertain-write recovery, provider-unavailable presentation and privacy. Record keyboard/label/focus evidence and visual inspection separately from automated layout assertions; alternative engines/devices remain explicit limits.
3. Disposable PostgreSQL verifies available administrative persistence/concurrency/rollback suites and account/session boundaries. Rehearse the additive migration chain against populated synthetic data, restore a backup into a separate target and compare the restored schema with `apps/api/prisma/schema.prisma`.
4. Disposable Redis/BullMQ demonstrates actual queue observations and generation-aware role-notification processing/retry/restart with a controlled mail provider. Controlled mail acceptance must never be called external delivery or proof of durable production hosting.
5. Record source-level/deployed gaps and unresolved provider, hosting, security, load/monitoring and recovery prerequisites in an actionable release gate matrix. A local production build plus controlled upstream browser run is not an integrated deployed API/database journey.
6. Supply ordered migration/API/worker/web rollout, abort criteria, health/auth/role smoke checks and recovery steps preserving managed media, notification generations, append-only audits and authored/support data. Keep ADM-9 incomplete until all required release gates have evidence.

## Contracts, impact and recovery

No new public API, schema, provider operation or mobile contract is planned. Scoped fixes must update this plan with the exact failing scenario and regression. Technical lead, release, database, security, QA/code review and UI review perspectives apply. Builds run in a temporary source copy to preserve active development output; disposable services must never inherit configured credentials or database URLs. Sensitive logs/screenshots must contain synthetic data only.

Production rollback must follow the individual slice restrictions: retain additive tables and all domain/audit data; preserve managed ownership/version enforcement after managed assets exist; stop new notification retry requests and retain a generation-aware dispatcher until work drains. Do not downgrade an API/worker across these compatibility boundaries merely to match an older web release.
