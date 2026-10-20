# ADM-9 dependency remediation

Date: 2026-10-21. Baseline: `7c92823`; clean working tree. Continues the
[ADM-9 advisory gate](../../features/admin-release-acceptance/findings.md).

## Required result

Remove the production lockfile's critical/high advisory matches with compatible,
reproducible dependencies. Inspect remaining matches against actual entry points;
retain any unresolved finding visibly. A registry audit is advisory matching,
not proof of application exploitability or security certification.

## Scope and compatibility

- Move Next 14 to the patched 15.5 maintenance line, migrate request APIs and
  affected server callers, and use compatible React/types/icon peers. Preserve
  Bangla/English, metadata, cookies, auth redirects, private BFF responses,
  authorization and administrative mutations.
- Update SheetJS from its stale npm distribution to the maintainer's versioned
  CDN tarball, with lockfile integrity and actual import/export regression.
- Patch affected API/transitive packages within their existing major versions
  wherever possible. Explain any narrowly scoped override and inspect consumers.
- Repair the notification-stream authorization defect discovered while tracing
  the Nest SSE advisory: only VET/ADMIN/SUPER_ADMIN may enter, and a VET may
  subscribe only to their own stream, matching the existing history contract.
  Verify denial before a stream is allocated. This does not certify ongoing
  authorization revalidation for already-open SSE connections.
- No application database/schema changes, production migrations, deployments,
  real provider sends/charges or Git commits. Existing operational gates remain.

## Acceptance

1. Frozen lockfile install works; production audit has no critical/high matches.
   Every residual match has a source-linked, entry-point-specific disposition.
2. Shared/API builds, API regression including spreadsheet processing and upload
   transport, web boundary/style checks and isolated production web build pass.
3. Production-browser public localization/auth and integrated ADMIN/SUPER_ADMIN
   journeys pass with synthetic local persistence/queues; no private markup leak,
   stale identity, browser exception or request-API compatibility warning.
4. Review final diff; update release findings/roadmaps with actual evidence.
   Preserve the historical ADM-9 manifest rather than relabeling its old hashes.

## Recovery

Dependencies and request-API adaptation must roll back together to the baseline
source/manifests/lockfile, followed by a frozen install and rebuild. Such rollback
restores known advisory matches and is not a safe public release. No data migration
or external side effect is required by this task.

Retain the independent SSE authorization repair during a dependency-only rollback;
reverting it restores the reproduced unauthorized notification-stream access.
