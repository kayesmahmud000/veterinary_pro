# ADM-9 integrated administration release acceptance

Status: Local acceptance verified; production release gates open. Dates/revision: 2026-10-20–21 / `a07d77f` plus this task's changes. See the [candidate manifest](release-manifest.json) and [release decision](plan.md#release-decision).

## Outcome and scope

Establish evidence for the delivered ADM-1–8 workflows across the production-built web, BFF, real Nest authentication/authorization, PostgreSQL and Redis. The [web roadmap](../../../apps/web/ROADMAP.md#admin-and-super-admin-delivery-roadmap) owns delivery status. This implements the user's selected administration-first sequence from the [documentation guide](../../README.md); individual batch specifications retain their contracts. Actual training content and Farmer milk work stay deferred.

Local acceptance and deployed acceptance are separate gates. A controlled upstream browser pass cannot prove persistence, provider delivery or deployment. No administrative role gains farm membership, clinical signing, provider payment or another account's entitlements.

## Required acceptance

1. Build the shared contracts, API and web from the current lockfile. Run the existing boundary/regression tests and all applicable opt-in administrative database suites against explicitly disposable loopback databases. Record skipped tests separately.
2. Exercise real login and current-primary role/session validation for ADMIN and SUPER_ADMIN through the built web/BFF/API, in Bangla and English at mobile/desktop widths. Visit all delivered administration modules; require valid loaded data, no private cache and no browser runtime exceptions. Verify ordinary roles, anonymous/forged sessions and ADMIN on Super-only routes are denied.
3. Persist representative confirmed operations through real BFF/API/repositories: account/session support, product/course drafts, content publication/removal, private support, versioned platform settings and bounded reports/audit exports. Reload/read back from PostgreSQL. Verify wrong password, stale/concurrent writes, private support/draft boundaries and demotion/revocation without trusting sidebar visibility. Financial/clinical correctness also retains each batch's real-database race/rollback checks.
4. Observe real Redis/BullMQ queues and the separate generation-aware role worker. Preserve a pending notification across worker shutdown/restart, process it through the configured local mock mail adapter, and verify explicit retries use a newer generation without replaying a retained failed job. Mock acceptance is never external delivery.
5. Rehearse the pending additive migrations over populated pre-ADM-7 data, restore a backup into a separate disposable target, verify migration/schema parity and preserve original account/order/outbox/delivery data. Never reset an unknown database or edit applied migration history.
6. Review dependency advisories, runtime entry paths, provider fallback/failure behavior and operational hosting. Write a concrete release runbook with migration/deploy order, owners, probes, abort criteria, worker recovery, rollback and reconciliation. Record blockers rather than implying a build supplies durable hosting.
7. Inspect the existing deployed endpoints read-only, recording current behavior separately from the proposed artifact. Actual rollout, production migrations and provider sends require a concrete release target and appropriate authorization; do all local/reversible preparation first. Full ADM-9 completion requires integrated deployed acceptance plus required provider/operational evidence. Keep the roadmap incomplete while material gates remain open.

## Implementation and recovery boundaries

Reuse existing scripts, guards, contracts and module boundaries. Add a repeatable isolated acceptance harness rather than test-only production endpoints or authorization bypasses. Test data uses `example.test` identities. Never import the project's real environment into a test process or print credentials/tokens/private records. Restrict database writes, queue cleanup and subprocesses to task-owned disposable resources. Preserve human-managed Git.

No new schema is proposed. Any discovered application defect gets a narrow fix, meaningful regression check and updated evidence. Reverting the harness/docs requires no data migration; release rollback preserves additive ADM-7/8 tables and generation-aware worker compatibility.

Observed cold-bootstrap defect: `SubscriptionsModule` registered `SubscriptionPlanService` twice, as a concrete provider and a separate `useClass` token. Both lifecycle hooks raced to seed the same default tiers, producing a real unique-constraint failure on the isolated empty database. Reuse the concrete instance through `useExisting`; cold bootstrap must seed once and later restarts must retain edited plans. No pricing or public contract change is intended.

Observed browser regression: after logout on public Home, Back restored a cached administrative workspace. Its gate removed private data but opened the modal inside the old workspace rather than using the required public Home handoff. Confirmed signed-out gates must navigate through the existing validated `protectedEntryUrl`, retaining the destination and existing unavailable-session recovery. The existing administrative logout/Back browser assertion is the reproduction; verify both controlled and real-session paths after the fix.

## Evidence sources

Confirmed from documentation: [ADM-7](../admin-communications/plan.md) and [ADM-8](../admin-settings-reports/plan.md) have local evidence but retain deployment/provider gaps. Confirmed from code: `AdministrationModule` wires their controllers/services/repositories, and `role-notifications.worker.ts` is a separate process. New observed behavior and unresolved findings belong in the [execution plan](plan.md).
