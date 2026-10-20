# ADM-9 dependency remediation plan

Date: 2026-10-21. Status: locally complete; full ADM-9 release remains NO_GO. [Acceptance contract](spec.md).

- [x] Inspect current manifests, uploaded spreadsheet parser/export, Next request
  APIs, existing regression harnesses and primary maintainer guidance.
- [x] Refresh production audit: 3 critical / 23 high / 24 moderate / 4 low.
  Raw artifact: OS temporary directory `adm9-dependencies-before.json`.
- [x] Select/pin compatible fixes and inspect narrowly scoped overrides.
- [x] Migrate async Next request APIs and callers without unsafe casts.
- [x] Reproduce SSE cross-user/ordinary-role access through real Nest transport;
  add role/owner checks matching existing history access.
- [x] Review, build, run relevant boundary/API/runtime/browser checks; fix findings.
- [x] Repeat audit/frozen install, re-review and record evidence/current gates.

## Investigation and decisions

Confirmed from code: animal imports parse uploaded CSV/XLS/XLSX using SheetJS;
milk exports write XLSX. Next request parameters/cookies/localization are currently
synchronous. Nest platform-express pins old Express/body-parser/multer versions.

Primary references (accessed 2026-10-21):

- [Next 15 upgrade and async APIs](https://nextjs.org/docs/app/guides/upgrading/version-15).
- [Windows RCE patch](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
  and [AVIF patch](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
- [SheetJS official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
- [Multer field-name DoS](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm).
- [proxy-addr trust fix](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
- [Nest SSE advisory](https://github.com/nestjs/nest/security/advisories/GHSA-36xv-jgw5-4q75)
  and [file-type ZIP advisory](https://github.com/sindresorhus/file-type/security/advisories/GHSA-j47w-4g3g-c36v)
  require entry-point review; upgrades cross framework/library majors.

## Review and verification

Next 15.5.28, React/DOM 19.3.1 and React types 19.3.0 are pinned. The official
Next 15 migration converts cookies, metadata/localization callers, dynamic page
parameters and all three BFF wrappers to awaited request values. The official
codemod missed an aliased workspace handler and left unsafe cookie/comment
fallbacks: these were repaired manually. Explicit undefined ref initialization
preserves prior behavior under React 19 types. Existing icon/Radix peers accept
the selected React version; installation reports no incompatible peers.

SheetJS 0.20.3 uses the official CDN URL. A separately downloaded 2,409,319-byte
tarball has verified package name/version and SHA-512 integrity explicitly in
the lockfile (pnpm initially omitted integrity for this URL). This pins fetched
bytes; it is not a publisher signature or an independent source-code audit.

Nest 10 pins three outdated transport packages, so parent-scoped overrides use
Express 4.22.3, body-parser 1.20.6 and multer 2.4.0. Bounded same-major overrides
cover proxy-addr 2.0.8, qs 6.16.0, lodash 4.18.1, js-yaml 4.3.2, PostCSS 8.5.31
and source-map-js 1.2.2. Express's own body-parser resolves to 1.20.8. Do not
retain these overrides blindly when their parent frameworks move to new majors.

### Residual moderate matches

The updated production audit reports 0 critical / 0 high / 3 moderate / 0 low,
and still exits 1. No advisory ignore list or lowered severity filter is used.

| Registry match | Code assessment and follow-up |
| --- | --- |
| file-type 20.4.1: GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v | Nest common's optional file-type validator is the dependency path. Source search finds no FileTypeValidator, file-type import or magic-number detection call in application source. Uploads use Multer and the separate SheetJS parser. The affected detector is unused in the current application; this is a scoped non-exposure assessment. A future detector/validator use must adopt a patched compatible release and malformed-input coverage. No unsupported major override is applied. |
| Nest core 10.4.22: GHSA-36xv-jgw5-4q75 | The only @Sse producer is consultation notifications. emitToStream uses the literal consultation_assigned and a generated notification UUID (entity/repository), with no caller-controlled type/id mapping. The injection precondition is absent in this current producer; data remains JSON encoded. Reassess any new event mapping and move to a patched supported Nest major as a separately tested framework migration. |

### Additional review finding

Real local Nest HTTP/SSE reproduction against controlled authentication showed
LEARNER/FARMER/BUYER and a foreign VET all received HTTP 200/events (four failing
negative cases). The stream handler lacked both @Roles and the owner check
already present on history/mark-read. The repair adds the existing three-role
allowlist and rejects foreign VET access before getNotificationStream. Tests
preserve real SSE event delivery for own VET and both administrators. This is a
separate application authorization defect, not proof of the SSE dependency
injection advisory. Already-open SSE session revalidation remains outside this
repair; it is not certified by initial-request guards.

Builds, 198 web boundary/style checks and the post-integrity frozen install pass.
No production mutation or release approval is implied.

The first real browser run passed cold bootstrap/restart but failed Next readiness:
Next 15 constructed invalid Windows manifest paths when built/launched from
different directories. Its evidence remains in `vet-adm9-acceptance-2cxVji` under
OS temp. Rebuild from inside the isolated app and start with cwd there / `start .`;
all four existing Next-launching browser harnesses use this convention. API and
worker processes retain their empty temporary cwd and explicit synthetic env.
No framework security patch or authorization assertion is bypassed.

### Observed verification (2026-10-21)

Environment: Windows, Node 24.9.0, pnpm 10.18.3, Chrome 156.0.8078.35;
task-owned loopback PostgreSQL 16 / Redis 7 retained from ADM-9. No application
schema/migration changed and no configured/production database was written.

| Check | Actual result / evidence |
| --- | --- |
| Install and advisory review | `pnpm install --frozen-lockfile` passes after the explicit SheetJS integrity pin. `pnpm audit --prod --json` exits 1 for the three documented moderate matches; no critical/high/low matches. Raw before/after and install files use the `adm9-dependencies-` prefix in OS temp |
| Shared/API builds | Shared CJS/ESM/declarations and API Prisma/Nest build pass. API rebuild after the SSE repair passes; `adm9-dependencies-api-build.log` |
| Full dependency regression | Same all-opt-in disposable databases as the ADM-9 runbook: **242 suites / 2,261 tests passed, zero skips**, 245.408s. Includes actual spreadsheet import/export, multipart transport and real PostgreSQL races/rollback/privacy. `adm9-dependencies-api.log` |
| SSE repair | New real HTTP/SSE test fails four denial cases before repair (HTTP 200), then passes all eight. Final `--testPathPattern=consultation-notification` passes **3 suites / 28 tests**, including existing controller/service regression. A missing status in the old direct-call fixture initially caused a type failure; the fixture now supplies ACTIVE without a cast. `adm9-dependencies-sse-before.log` and `adm9-dependencies-sse-final.log` |
| Serverless wrapper | Existing `pnpm --filter @vetralink/api test:vercel`: **5 tests passed** |
| Web boundary/style/types | Existing combined Node command from ADM-9: **198 passed**, no skips. Tailwind guard passes; TypeScript no-emit passes after explicit undefined ref initialization. `adm9-dependencies-web.log`, `adm9-dependencies-types.log` |
| Isolated web production build | Next **15.5.28**, React/DOM **19.3.1**, successful production build from inside the isolated copied app. Build ID **7mLxnRvdshUX2CUpXmgdI**. All 224 copied web source files hash-identical to current source. `adm9-dependencies-build.log` |
| Real full stack | **21 groups / 192 role-locale-width route visits passed**, both admin roles, bn/en, 320/1440px. Persisted settings/publication/products/curriculum/support, privacy/denial/concurrency/revocation/logout and real Redis worker five-failure/generation/restart/mock acceptance pass. No browser exceptions or Next async-request warnings. `adm9-dependencies-integrated-final.log`, `vet-adm9-acceptance-YWtzne/results.json` under OS temp |
| Detailed controlled browser | Full aggregate rerun passes **1,312 checks**, all eight batches, no browser exceptions. Finance retains 199 currency/reconciliation/moderation checks; communications 99 and platform 123. `adm9-dependencies-controlled-final.log`, `khamar-workspace-qa-KgEfJS` under OS temp |
| Auth/public localization browser | Pass: bn/en at desktop/tablet/375/320px, modal focus/Escape/overflow, exact signup/login payloads, cookies/reload, cross-tab rotation/logout, expiry/failure/retry. Public regression: 80 localized GETs, 60 native locale submissions, 5 unsafe return URLs, 12 catalog filters, 4 CSV downloads, 2 missing templates. `adm9-dependencies-auth-browser.log`, `vetralink-auth-qa-zst9z9` under OS temp |

Visual review: inspected actual ADMIN Bangla 320px and SUPER_ADMIN English
1440px screenshots. Native controls, wrapped headings, responsive navigation,
readable account rows and containment remain intact. Synthetic account records
are retained in the disposable database; they are not real customer information.

The full run's results.json still contains the harness's old hardcoded revision
label (`a07d77f plus ADM9 changes`); its build ID identifies the actual new build.
Do not treat that label as source provenance. The harness now reads Git HEAD and
dirty state dynamically, and the adjacent evidence manifest binds current source
hashes, baseline 7c92823 and build ID without rewriting the raw run or the earlier
ADM-9 historical manifest. The metadata-only repair does not change assertions.

The initial detailed controlled run passed overview/directory/catalog/billing/
consultations, then failed a finance currency assertion. Source review found that
the test waited only for the summary container, which also renders during its
separate async load. This is a likely readiness race; the failed run did not retain
the exact summary text. The test now polls the same USD-and-EUR condition within
the existing bounded timeout before continuing; no currency expectation, product
logic or timeout was weakened. The full controlled rerun passes all 1,312 checks. Initial
output: `adm9-dependencies-controlled.log`, screenshots `khamar-workspace-qa-usH6LR`.


### Final re-review and release boundary

Observed: builds, final advisory scan, boundary/transport checks and both real and
controlled browser acceptance pass for this local slice. Reviewed request-API
callers, role/owner checks before SSE allocation, same-major override consumers,
explicit SheetJS integrity, final diff, source parity and linked documentation.
No unsafe request casts, advisory suppression, auth bypass, increased test timeout,
schema change, unrelated feature, real provider send/charge or Git write is part
of the result. This is implementing-agent self-review, not independent certification.

The [candidate/evidence manifest](evidence-manifest.json) records exact source,
lockfile, local build and raw evidence hashes. The historical ADM-9 manifest is
unchanged. The source is an uncommitted candidate based on 7c92823; human-managed
Git policy remains in effect.

The two target migrations, verified deployment binding/backup/restore, durable
hosted worker/provider acceptance, actual HTTPS both-role journeys, alternate
browsers/devices and bounded load/alert ownership remain release gates. Schema/migrations are unchanged, so their prior rehearsal is retained. The
standalone workspace-browser scenario was not rerun; integrated admin/auth runs
cover the changed entry/session paths. Earlier evidence is not relabeled as a new
run. Initial SSE guards do not certify revalidation of an already-open stream.
Residual moderate dependency assessments must be reconsidered when their entry
points or framework versions change. Full release status remains **NO_GO**.

Disposable task PostgreSQL/Redis containers are stopped after verification; their
synthetic data, copied production build and screenshots remain for review.
Suggested commit: `fix(security): remediate dependencies and notification stream access`.

Final documentation verification: 48 context documents / 364 local links / 100
source anchors pass; changed Markdown links and diff whitespace also pass.
