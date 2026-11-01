# Live web API routing plan

Spec: [spec.md](spec.md). Perspectives: web/API debugging, security, Code Reviewer and QA.

**Current outcome, 2026-10-15:** the later authorized production repair below is complete. All 27 migrations are applied, existing data is preserved and live/local-web course requests return HTTP 200. Earlier failure/pending statements below are historical observations from before this repair.

- [x] Trace browser BFF, all upstream URLs, middleware, env files and Turbo configuration.
- [x] Verify the supplied live API's real health/auth responses.
- [x] Correct defaults, web configuration and Turbo propagation.
- [x] Review credentials, prefix, environment precedence and explicit test overrides.
- [x] Run relevant existing boundary suites, web type/style checks and destination checks.
- [x] Record results and any independent live backend failures; re-review scope and final diff.

**Observed baseline:** live `/api/v1/health/liveness` returns HTTP 200 with `success: true` and `data.status: up`; `/api/v1/auth/me` without credentials returns the expected HTTP 401. `/` returns 404. `/api/v1/courses`, both with and without a limit query, returns HTTP 400 `DATABASE_ERROR` / `Database query constraint violation.` This is a separate live persistence error; changing the web URL cannot repair it. No real account credentials or data were used.

## Implementation and review

The four existing upstream defaults now select the live URL, including `/api/v1`. The corrected `.env.example` documents how to create an active local file and opt into a local backend. Created ignored `apps/web/.env.local` with only the chosen API URL. Added `API_BASE_URL` to Turbo's strict environment allowlist. Updated the auth specification/current runtime guide; the earlier Prisma startup change and its evidence remain intact.

Explicit environment variables retain precedence, so existing deployment settings must use the selected full API URL. Neither a tracked example nor a local file updates hosted dashboard settings. No client-side direct API URL, permissive CORS workaround, cookie change or access-control bypass was added. No live credentials/accounts/database writes or deployment actions were performed.

## Verification

- From `apps/web`: `node --test scripts/check-auth.mjs scripts/check-workspace.mjs scripts/check-protected-routes.mjs scripts/check-youtube-courses.mjs scripts/check-admin-dashboard.mjs scripts/check-admin-directory.mjs scripts/check-admin-catalog.mjs` passes **87 tests**, zero failures/skips. These use controlled fetches, including synthetic write responses, without live account writes.
- From root: `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` completes with no diagnostics.
- A manual controlled-fetch check invokes all four real handlers with no `API_BASE_URL`, then with an explicit loopback override: all eight destination assertions pass, preserving `/api/v1` and the fixed endpoint/query mapping. Next's own `@next/env` loader confirms the new `.env.local` selects the live URL. Initial inspection assertions omitted existing endpoint/query transformations; correcting the inspection expectations required no application changes. The transitive Next env loader was resolved through Next's own package, without adding a dependency.
- `pnpm exec turbo run dev --filter=@vetralink/web --dry=json` confirms `API_BASE_URL` in the strict global environment configuration.
- `pnpm --filter @vetralink/web check:styles` encounters a pre-existing CRLF issue: the unchanged `globals.css` contains exactly the three permitted Tailwind directives, but the guard compares them against LF text. The same guard passes on an isolated copy after normalizing only that copied stylesheet to LF; no repository stylesheet or policy change was made.
- `python -X utf8 .context/scripts/validate.py` passes 48 Markdown documents / 327 links / 95 source entries. `git diff --check` passes.
- Direct live GETs confirm HTTP 200 health, HTTP 401 unauthenticated identity and HTTP 400 course `DATABASE_ERROR`. The existing local web course handler now returns HTTP 503 for that failed upstream response, consistent with its existing error mapping. The underlying Prisma error code/missing relation is unknown; pending migrations are a hypothesis, not a confirmed diagnosis. Production migration remains a separately authorized action under the database workflow.

**Observed isolated production verification:** Next 14.2.35 production build passes at `G:/projucts/vetralink-live-api-check-df76d1512e334fd59829a3ce277e388a`, including type validation, all 33 generated pages and middleware. The copy excludes real env files and existing node_modules/build outputs, normalizes only copied Tailwind entry line endings and links existing dependencies. An initial C-drive temporary copy failed because Next/webpack converted the G-drive linked Next client entries into invalid `./G:/...` module paths; the successful same-drive retry resolves that test-environment limitation. The running development build is untouched. Existing optional-sharp/cache-size warnings do not fail the build.

Started the isolated production server on loopback port 3520 with `API_BASE_URL` absent and diagnostics enabled. A real GET through `/api/courses?limit=1` logs the selected live `/api/v1/courses` upstream and HTTP 400, then returns the existing BFF HTTP 503 `UNAVAILABLE`. Both destination and status mapping assertions pass. The temporary production server was terminated after the check. This verifies actual forwarding without credentials/account writes; it also reproduces the independent live backend persistence failure.

**Completion and remaining limits:** the requested routing correction is complete locally. Final review confirms all four live defaults, full prefix, effective local env, explicit override support and Turbo propagation. Restart the existing dev session. For hosted web, ensure `API_BASE_URL` is the same full live API URL and deploy the changed source through the human-managed workflow; no hosted settings/deployment changes are claimed here. The live courses database error remains unresolved, and real-account login was not exercised. Standard Windows style checking still needs a separate CRLF-compatible fix; the isolated LF copy passes the guard.

Suggested human-managed commit: `fix(web): route API requests to the live backend`.

## Follow-up: Courses page HTTP 400 diagnosis — 2026-10-15

The user requested console inspection and clarified that errors occur on the Courses page. This follow-up resolves the earlier unknown Prisma cause; it does not change application code or authorize a production migration.

**Observed root cause:** application/client code expects the new product/course schema, while the configured remote PostgreSQL database still has the previous schema. Read-only catalog queries show `products.version`, `products.content_provider`, `course_lessons`, `course_enrollments` and `admin_media_uploads` are absent. Reproducing the public course projection inside a PostgreSQL READ ONLY transaction raises Prisma **P2022 / Product / products.content_provider**. The admin course-list projection raises **P2022 / Product / products.version**. No rows, credentials or clinical/account data were printed.

`pnpm --filter @vetralink/api exec prisma migrate status` finds 27 migration files and these three pending migrations:

1. `20261015090000_admin_product_media`: adds Product.version and managed upload persistence.
2. `20261015120000_youtube_course_curriculum`: adds Product.contentProvider, lesson enums/table/indexes and free-course constraints.
3. `20261015150000_course_enrollment`: adds enrollment table/FKs/uniqueness/index.

The CLI exits nonzero for pending state; the command did execute despite pnpm's misleading trailing executable-not-found line. An independent read-only query of `public._prisma_migrations` confirms exactly the same pending set. The migrations were inspected: they contain the additive product/course structures and reference existing users/products; they are not reset/delete commands.

**Actual runtime console evidence:** installed Vercel CLI 39.1.3 is authenticated. A bounded read-only `vercel logs https://veterinary-api-mocha.vercel.app --json` capture receives a runtime record containing `products.content_provider`; three fresh public GET probes all return HTTP 400 `DATABASE_ERROR`. Only matching column/code metadata was emitted, without raw runtime logs or secrets. The public HTTP failure and database reproduction independently match the missing-column diagnosis. The user's existing browser/terminal console itself was not attached; the API's live runtime log was inspected directly.

**Confirmed from code:** `apps/api/src/common/filters/global-exception.filter.ts` maps otherwise unhandled known Prisma errors, including P2022, to HTTP 400 `DATABASE_ERROR`. This accounts for the misleading Bad Request status. Public and administrative course reads both reference the absent fields, so each such request fails until the schema catches up. `workspaceRequest` retries authentication failures (401), not 400; this investigation did not find a client retry loop for this status.

**Repair prepared:** apply the committed pending migrations to the selected live database with `pnpm --filter @vetralink/api db:deploy`, then recheck migration status, schema metadata and public/admin course requests. `db:generate` refreshes local Prisma client code/types and does not apply database migrations. Production migration execution is a separately authorized release action under `.context/engineering/database.md` and `.context/workflows/database-change.md`; no migration, data write, hosted setting/deployment or Git index/history change was performed in this diagnostic follow-up.

**Scope/review/verification:** diagnosis used the investigate skill's configuration-drift hypothesis and confirmed it with read-only SQL, the actual repository query shape and live API/runtime logs. Its optional gstack helper/freeze executables are unavailable on this machine, so no helper-managed scope state or telemetry was created. Prior local course unit/browser/build evidence remains intact; application tests were not rerun for this read-only diagnosis/documentation update. Diagnosis is confirmed, with production repair pending rather than claimed fixed.

## Authorized production repair - 2026-10-15

The user's subsequent instruction to complete whatever is needed authorizes the diagnosed database repair. Database, Backend, Production/Release and Code Reviewer + QA perspectives apply. The three committed pending migrations add columns/tables/enums/constraints/indexes; no destructive schema change or data backfill is planned. Existing product rows receive compatible INTERNAL/version-zero defaults, while constraints on new empty tables do not require historical row cleanup.

- [x] Recheck the selected API schema, pending state, SQL, database version, table sizes and lock state.
- [x] Create a restricted current logical backup and restore it to a disposable PostgreSQL instance.
- [x] Rehearse the exact pending SQL/migration sequence, data preservation and new course persistence constraints against the restored copy.
- [x] Apply the committed migrations through the API package's `db:deploy` command.
- [x] Verify migration/schema state, existing-data preservation, former failing Prisma projections and live public course responses.
- [x] Re-review evidence, update current context and retain backup/recovery details without secrets or copied data in the repository.

**Observed preflight:** 24 applied migrations, exactly the previously diagnosed three pending and no failed migration records. Live PostgreSQL is 18.6; total database size is approximately 11 MB. Product/user relations are small (approximately 56/120 KiB); no waiting locks were observed. All applied migration checksums match the local SQL exactly or after CRLF/LF normalization; the 23 byte mismatches are explained entirely by Windows checkout line endings. Applied files/history will not be edited.

**Recovery approach:** restore the current logical backup into a separate local container before production changes. Rehearse the additive forward migration there; retain the restricted backup for restoration into an isolated replacement database if recovery becomes necessary. Do not automatically drop production objects or overwrite the live database. Inspect any failed migration before choosing forward recovery. No hosted source deployment or real account/content mutation is included.

**Observed backup/recovery rehearsal:** a current PostgreSQL 18 custom-format logical archive (156,135 bytes, SHA-256 recorded in its adjacent manifest) was captured using a shared exported READ ONLY transaction snapshot. It is retained outside the repository at `C:/Users/asus/AppData/Local/Temp/vetralink-course-repair-17bb8d71ffb3442e9874bc415a9d98a7/before.dump`; directory ACL inspection confirms access only for the current Windows user and SYSTEM. No row contents or connection credentials were emitted. PostgreSQL 18 container restore succeeds, with all 34 original table counts/content fingerprints and the 24-migration history matching the backup snapshot.

Added one synthetic legacy product only to the disposable restored `adm3_test` database before rehearsal. The API's exact committed `prisma migrate deploy` sequence succeeds there: 27 applied, zero pending/failed; every original row plus the legacy fixture is preserved. Public/admin course projections and enrollment/media queries succeed. Existing `courses.database.spec.ts` and `admin-course-curriculum.database.spec.ts` pass **10 tests in two suites, zero failures/skips**, using explicitly loopback disposable URLs. They verify legacy INTERNAL defaults, course creation/curriculum/publication/reordering, concurrent version/enrollment behavior, access isolation and audit rollback. No production test accounts/courses were created. A fresh pre-deployment live request still returns HTTP 400 for Courses and HTTP 200 for liveness; the running local web BFF on port 3000 reproduces HTTP 503.

**Observed production repair:** `pnpm --filter @vetralink/api db:deploy` completed successfully against the same configured live database, explicitly passing the preflight-verified API connection through the child process environment. All three pending migrations were applied in committed order. Subsequent independent catalog/history checks report **27 applied, zero pending, zero failed**, with all five formerly absent product columns/course/media tables present. All 34 original table counts/content fingerprints still match the pre-deployment snapshot, ignoring only the newly added product fields. No existing rows were altered or removed by the repair. Read-only public/admin course, enrollment and upload projections now succeed. Prisma `migrate status` reports up to date; `migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` exits zero with no difference.

**Observed request recovery:** fresh live GETs for `/api/v1/courses`, `?limit=20` and `?limit=20&search=vet` all return **HTTP 200 / success:true**. The catalog is currently empty, which is a successful empty response. The existing running web's `http://localhost:3000/api/courses?limit=20` now returns **HTTP 200** instead of the pre-repair 503. Liveness remains HTTP 200, and unauthenticated `/api/v1/auth/me` remains the expected HTTP 401. No app redeployment or restart was required for the schema correction.

**Review and recovery handoff:** the additive sequence was tested against both restored production data and a synthetic pre-migration product before live execution. Backup integrity, restoration, data preservation, migration state and original failing requests are verified. The specifically identified disposable container was stopped and removed; its database lived on tmpfs. The restricted backup, manifest and redacted-result artifacts remain at the path above. Applied SQL/history and application source were not changed in this repair turn. Real authenticated admin saves and team-owned YouTube playback remain separate acceptance limits; they are not claimed from read-only production probes or disposable tests. Earlier local browser/build checks remain applicable because source did not change. Git index/history remain human-managed.

Suggested human-managed documentation commit: `docs(courses): record verified live database repair`.

**Final documentation verification:** `python -X utf8 .context/scripts/validate.py` passes 48 Markdown documents / 331 local links / 95 source entries; `git diff --check` passes. Final review confirms no migration file changes, no remaining task-created database container and retention of the restricted backup. The existing `.gitignore` line-ending warning is unchanged.

## Local login routing restoration — 2026-10-30

The user reported `POST http://localhost:3000/api/auth/login` returning HTTP 503 `{user:null,code:unavailable}` and explicitly selected the existing live backend again. **Observed cause:** ignored `apps/web/.env.local` overrode the shipped live default with `http://localhost:3001/api/v1`; nothing listened on port 3001. A diagnostic local API startup also failed because its configured Upstash service had exceeded its request quota; that process exited. No Redis service, account, database migration or deployment was changed.

**Correction:** restored only the active web `API_BASE_URL` to `https://veterinary-api-mocha.vercel.app/api/v1`, preserving other local settings. The running Next development process reloaded the configuration without a manual restart.

**Observed verification:** direct live liveness returned HTTP 200. A synthetic invalid account login through the existing localhost web handler returned HTTP 401 `invalid_credentials`, replacing the prior 503; the same direct live API probe returned HTTP 401. These probes verify transport and authentication rejection, not successful authentication with a real user's credentials. No real credentials were supplied or account created. Existing auth regression suite and context/diff checks are recorded below. No application code or cookie/security behavior changed.

`pnpm --filter @vetralink/web test:auth` passed (12 tests, zero failures). `python3 .context/scripts/validate.py` and `git diff --check` passed. Final review confirmed only the ignored web upstream configuration and this evidence record changed. Suggested documentation commit: `docs: record local login upstream restoration`.
