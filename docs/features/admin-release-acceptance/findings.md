# ADM-9 findings and release decisions

Date: 2026-10-20. Evidence labels follow the [repository standard](../../../.context/engineering/evidence.md). This is a scoped acceptance review by the implementing agent, not independent certification.

## Application findings

| Finding | Evidence / impact | Disposition |
| --- | --- | --- |
| Duplicate subscription-plan lifecycle instance | Observed on real cold API bootstrap: both concrete and `useClass` providers attempted default-tier inserts; one transaction failed with a tier unique constraint. Confirmed from `subscriptions.module.ts` and runtime log | Changed token binding to `useExisting`. The integrated harness must prove a single cold seed and retention of an edited plan on restart |
| Logout/Back retained cached workspace shell | Existing controlled ADMIN logout/Back assertion failed: private counts were gone but `/admin/dashboard` and its workspace shell remained with a modal. `WorkspaceGate` opened the dialog locally rather than following the public handoff | Use existing validated `protectedEntryUrl` through `router.replace` once identity is confirmed absent. Test existing controlled assertions and real logout/Back; preserve unavailable-session retry and same-account draft behavior |
| Missing configured schema for latest batches | Observed read-only configured database: 27 distinct completed migrations, one additional historical rolled-back entry, no database-only migration names. Communications/platform migrations are pending and editorial/support/platform tables are absent. Anonymous deployed public CMS read returns 400 | Release blocker. Verify actual deployment binding, target backup/restore and deploy the two additive migrations before new code under the [runbook](runbook.md). No configured/live database mutation was performed |

## Dependency advisory gate

Observed `pnpm audit --prod --json` exits 1 for the current unchanged lockfile: **3 critical, 23 high, 24 moderate, 4 low** advisory entries. Counts are registry-reported matches, not 54 demonstrated exploitable application paths. The raw task artifact is `adm9-audit.json` under the OS temporary directory. Review all entries before release; no blanket dependency update or unsupported claim of exploitability is part of this acceptance task.

| Critical registry match | Primary source and conditions | Current assessment / required decision |
| --- | --- | --- |
| `next` 14.2.35: Windows-hosted remote execution, GHSA-p293-qw3h-jr36 | [Next.js maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36): Windows filesystem hosting is a condition; patched releases listed are 15.5.24 / 16.3.3 | Local Windows acceptance binds Next to loopback. Existing production URLs use Vercel, but exact runtime/mitigation was not independently attested. A Next major-version migration needs its own compatibility scope and acceptance; the lockfile match remains open |
| `next` 14.2.35: AVIF image optimization remote execution, GHSA-2xp9-vwfh-vxw4 | [Next.js maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4): vulnerable `libheif` via `sharp` while optimizing AVIF; the patched Next versions disable affected optimization | Local build reports optional `sharp` absent. This limits the local scenario, not the hosted optimizer. Verify deployed optimizer/Sharp handling or update to a patched supported framework before closing the gate |
| `proxy-addr` 2.0.7 via API Express: IP spoofing, GHSA-jqcg-44mw-7w3h | [proxy-addr maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h): particular IPv4-mapped IPv6/zero-leading-prefix trusted subnet configuration is required; 2.0.8 is the stated fix | Source search found no custom `trust proxy` subnet configuration in API/web source. Hosting-injected behavior is unknown; review exact runtime configuration or remediate the dependency. Presence in a lockfile alone does not prove a current IP-based authorization bypass |

These matches require explicit remediation or a supported target-specific disposition, plus regression evidence. They are release findings, not a reason to weaken current authorization, upgrade unrelated libraries without a compatibility plan or run exploit traffic against production.

## Operational acceptance still required

An actual HTTPS release with both roles and real configured persistence, target-specific restore, a durable hosted generation-aware worker, external provider/sandbox acceptance and inbox delivery, media/storage/FFmpeg acceptance for enabled operations, alternate browser/device checks and bounded load/alert ownership remain required. Real local Redis/mock-mail evidence closes only the corresponding local gate. The [execution plan](plan.md) records which tests actually ran and distinguishes failures, reruns and skips.
