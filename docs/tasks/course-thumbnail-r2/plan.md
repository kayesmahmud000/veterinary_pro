# Cloudflare R2 Course Thumbnail Upload Implementation Plan

> **Execution status — 2026-10-26:** Planning only. The user requested this single plan file and will provide/configure R2 later. Do not install dependencies, change application code, upload images, or deploy while this task is paused for configuration. Resume implementation only after the user supplies the configuration and asks to proceed. Use the executing-plans skill for sequential implementation; this plan does not authorize subagents or Git writes.

**Goal:** Replace the administrative course thumbnail URL input with image selection/drag-and-drop, preview and secure R2 upload while preserving existing course data and public artwork.

**Architecture:** Send a bounded multipart image through a dedicated same-origin Next.js BFF route to an authenticated NestJS upload endpoint. The API validates and normalizes the image, stores it through an isolated R2 adapter, and returns a public HTTPS URL. Existing product create/edit requests save that URL in the current thumbnail field; uploading alone never changes a course.

**Tech stack:** Existing Next.js 14/React 18/Tailwind 3, NestJS 10, shared Zod contracts, AWS SDK v3 and Redis workflow limiter. Proposed new API dependency: `sharp`, for actual image decoding, pixel bounds, orientation and metadata-free re-encoding; select and check a maintained version at implementation time.

**Requirements source:** The user's course thumbnail request, captured below, extending the [administrative course specification](../admin-course-management/spec.md) and [existing implementation/evidence](../admin-course-management/plan.md). No separate specification is being created because the current instruction is to make only a plan file.

## Confirmed baseline and remaining unknowns

**Confirmed from code during this investigation:**

- `apps/web/src/components/workspace/admin-course-wizard.tsx` implements both creation/editing and contains the current `course-thumbnailUrl` URL input. Its state already preserves product versions, submitted-slug recovery, saved information and unsaved changes.
- `apps/api/src/modules/products/admin-products.repository.ts` and `admin-products.service.ts` persist `thumbnailUrl` as `Product.metadata.courseThumbnailUrl`, preserving unrelated metadata on edits.
- `packages/shared-types/src/validation/youtube-courses.ts` validates public HTTPS artwork and reads existing thumbnail metadata. Public course projections and `apps/web/src/components/courses/course-artwork.tsx` already use it, with broken/missing-image fallback.
- `apps/web/src/lib/workspace/server.ts` allows fixed upstream routes, checks current identity and same-origin writes, and currently accepts JSON writes only. `workspaceRequest` serializes JSON and cannot transfer multipart files unchanged.
- The API already depends on `@aws-sdk/client-s3`; the existing `S3StorageService` is shared by other media operations. Do not redirect its global AWS/bucket settings to a public thumbnail bucket.
- API configuration uses `NestConfigModule.forRoot`; `apps/api/.env` and `apps/web/.env.local` are ignored by Git. No R2/storage variables were present in the inspected local `.env` files or execution environment. Values were not printed.

**Unknown:** Actual Cloudflare account/bucket/token/domain, bucket jurisdiction, deployed backend environment, storage permissions and public delivery. Local inspection does not establish hosted settings or working R2 access. No live upload or delivery test has run.

## Prerequisites: configuration before implementation

- [ ] User confirms configuration is ready and requests implementation.
- [ ] Create a dedicated bucket for public thumbnails using R2 **Standard** storage. Keep private videos, ebooks, deliveries and attachments in their existing buckets.
- [ ] Create an R2 S3 API token with **Object Read & Write**, scoped to this bucket only; store credentials privately.
- [ ] Configure the following proposed variables in `apps/api/.env` for local API execution and in the deployed API host's environment settings when deployment is separately requested. These names still need implementation in the API configuration schema.

| Variable | Required value/source |
| --- | --- |
| `R2_THUMBNAILS_ENABLED` | Explicit boolean; `false` by default, `true` only with complete configuration. |
| `R2_ACCOUNT_ID` | Cloudflare Account ID from R2 Overview. |
| `R2_ACCESS_KEY_ID` | Access Key ID shown when creating the R2 S3 API token. |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key shown at token creation; never put in chat, frontend files or Git. |
| `R2_BUCKET_NAME` | Exact dedicated thumbnail bucket name. |
| `R2_PUBLIC_BASE_URL` | Bucket's active HTTPS custom domain; an enabled public `r2.dev` URL is allowed only for development/testing. |
| `R2_ENDPOINT` | Optional explicit R2 S3 endpoint, needed for jurisdiction-specific buckets; otherwise derive `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. |

- [ ] Confirm the public domain serves only intended public artwork. Use R2's S3 endpoint for API writes and the public domain for returned image URLs; these serve different purposes. SDK region is `auto`.
- [ ] Confirm Redis is available for the existing API workflow limiter and that the target runtime can load `sharp`.
- [ ] Recheck current Cloudflare documentation when executing: [S3 credentials/setup](https://developers.cloudflare.com/r2/get-started/s3/), [public domains](https://developers.cloudflare.com/r2/buckets/public-buckets/), [pricing/free usage](https://developers.cloudflare.com/r2/pricing/). Standard currently includes monthly free usage; it is not an unlimited free service. Production must use a custom domain rather than the development `r2.dev` endpoint.

Do not change `apps/web/.env.local` for R2 credentials or introduce `NEXT_PUBLIC_R2_*` secrets. Document names and empty/example values only in `apps/api/.env.example` and `.env.vercel.example`. No account provisioning, DNS change or hosting deployment is performed by this plan.

## Acceptance contract and global constraints

1. ADMIN and SUPER_ADMIN can choose one `.jpg`, `.jpeg`, `.png` or `.webp` image through a native file input or drag-and-drop. Other roles, inactive users and stale/revoked identities cannot upload at either BFF or API boundary.
2. Proposed initial file ceiling: **3 MiB (3,145,728 bytes)**, shared by frontend and API. Enforce a multipart request ceiling of file maximum plus **64 KiB** at the BFF/API ingress and recheck actual bytes when length headers are absent or false. Confirm the resulting payload fits actual deployment limits before release.
3. Validate extension and declared MIME type on both sides and actual decoded format at the API. Reject empty, corrupt, unsupported, disguised and animated images. Bound input to **40,000,000 pixels** and one frame before full decode. These are proposed defaults, not existing behavior.
4. Normalize accepted images with orientation correction, metadata removal and WebP output, quality **85**, resized inside **1920 × 1080** without enlarging. Enforce the 3 MiB output ceiling too. Generate `course-thumbnails/<UUID>.webp`; no client-supplied key, bucket, URL or filesystem path controls storage.
5. Show local preview immediately, honest transfer progress, separate server-processing state, success and localized actionable errors. Upload progress reaching 100% is not storage success; accept the new URL only after API acknowledgement.
6. Existing images remain visible on edit. Canceling or failing a replacement keeps the previous accepted URL and all other form fields. Selecting a file does not clear saved artwork. Explicit removal sets the form thumbnail to null only when the course information is saved.
7. Disable saving/advancing/publishing while a file is being validated/uploaded. A selected file whose upload failed must be retried or explicitly discarded before saving. Preserve wizard dirty-state/navigation protection for pending files as well as URL changes.
8. No database/schema change is planned. Preserve existing valid external thumbnail URLs, null/missing metadata, other product metadata, course curriculum, pricing, enrollment and version-conflict behavior.
9. Use a separate injectable storage interface and R2 client. Credentials remain server-side. Use unique immutable keys with `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`.
10. No automatic object deletion on replace, remove, canceled upload or failed course save. Abandoned uploads may remain; record that tradeoff. Future cleanup requires separate reference tracking/review, never deletion inferred from an arbitrary URL.
11. Keep Bangla-default and English UI, accessible controls, responsive layout and Tailwind-only styling. Preserve the existing course table/wizard width conventions and shared UI foundations.
12. Follow Implement → Review → Test → Re-review → Finalize. Keep changes scoped; do not modify roadmaps, unrelated features or existing AWS storage behavior. No Git staging/commit/merge/push, production writes or deployment without explicit user authorization.

## Review focus

- An old upload finishes after a newer selection, removal, reload or account switch: it must not replace current form state. Task 4 owns cancellation/generation tests.
- Storage accepts an image but its response is lost, or the later course save fails: keep the prior course data and a recoverable form; never delete existing objects. Tasks 2 and 4 cover the failure boundary.
- A file lies about MIME, extension, length, dimensions or frames: reject before storage and bound resource use. Tasks 1–3 cover actual bytes and limits.
- Logout, role revocation or actor change happens during a slow upload: recheck current identity, reject changed actor requests and ignore stale client results. Tasks 2–4 own those tests.
- Existing non-R2 URLs, null metadata or failed public image delivery appear after rollout: retain compatible projections and the current fallback; prove R2 delivery separately. Tasks 5–6 cover compatibility and real delivery.

## Task 1: Define configuration and shared upload contract

**Modify:** `apps/api/src/config/env.schema.ts`, `env.service.ts`, `env.schema.spec.ts`, `env.service.spec.ts`; `apps/api/.env.example`, `.env.vercel.example`; `packages/shared-types/src/validation/index.ts`.

**Create:** `packages/shared-types/src/validation/course-thumbnails.ts`; API configuration-specific tests may remain in the adjacent existing config suites.

**Interfaces:** Export `COURSE_THUMBNAIL_MAX_BYTES`, `COURSE_THUMBNAIL_MAX_REQUEST_BYTES`, allowed extension/MIME constants, `courseThumbnailUploadResultSchema` and its inferred `CourseThumbnailUploadResult` type. Result is `{ url: string }`, validated as public HTTPS; do not return SDK responses, secrets or presigned write URLs. Add typed `EnvService` getters for the variables above.

- [ ] Write failing config/contract tests for enabled-but-incomplete configuration, explicit `false` parsing, invalid HTTPS base URLs, embedded credentials/query/fragment, invalid endpoint hosts and production `r2.dev` rejection. Disabled uploads must allow existing course reads/edits without R2 credentials.
- [ ] Run the focused tests and confirm the intended failures before implementation.
- [ ] Add conditional configuration validation, including a 32-hex Account ID and an endpoint restricted to that account's Cloudflare R2 host (including documented jurisdiction variants). Run these checks before the existing Vercel production-integration bypass. Avoid `z.coerce.boolean()` for environment strings.
- [ ] Export constants/result contract and update examples without real credentials. Keep existing thumbnail URL validation compatible with legacy hosts.
- [ ] Build shared types, rerun focused tests, and review that neither configuration validation nor errors print secret values.

## Task 2: Implement the isolated backend upload boundary

**Create under `apps/api/src/modules/course-thumbnails/`:** `course-thumbnails.module.ts`, `course-thumbnails.controller.ts`, `course-thumbnails.service.ts`, `image-validator.ts`, `thumbnail-storage.interface.ts`, `r2-thumbnail-storage.service.ts`, and adjacent `.spec.ts` suites including `course-thumbnails.controller.int.spec.ts`.

**Modify:** `apps/api/src/app.module.ts` to import the module; `apps/api/package.json` and `pnpm-lock.yaml` only for the justified decoder dependency.

**Interfaces:** `ThumbnailStorage.put(key: string, body: Buffer, contentType: "image/webp"): Promise<void>`; `normalizeCourseThumbnail(input: Buffer): Promise<Buffer>`; `CourseThumbnailsService.upload(actor: JwtPayload, file: Express.Multer.File): Promise<CourseThumbnailUploadResult>`.

**HTTP:** `POST /api/v1/admin/courses/thumbnails`, one multipart field named `file`, bearer authentication, ADMIN/SUPER_ADMIN. Return the standard API envelope with `data: { url }`. Reject extra fields/files. Use 401/403 for authentication/authorization, 413 for size, 415 for unsupported type, 422 for corrupt/invalid image, 429 for rate limit, and 503 for unavailable configuration/provider; use existing exception/envelope conventions and stable redacted error codes.

- [ ] Write failing tests using real synthetic JPEG/PNG/WebP bytes plus corrupt, spoofed, oversized, animated and excessive-dimension fixtures. Assert storage is never called for rejected inputs.
- [ ] Write HTTP tests that exercise actual guards/interceptor/validation: missing token, ordinary role, suspended/revoked identity, extra fields/files and actual byte limits. Assert active ADMIN and SUPER_ADMIN succeed.
- [ ] Add the maintained image decoder using pnpm and validate its target-runtime/native-binary packaging. Implement bounded decoding/normalization; do not trust filenames or MIME alone.
- [ ] Bind the new R2 adapter to its own interface using the existing AWS SDK, region `auto`, bucket-scoped credentials and request timeout. Build URLs from configured public base plus generated key only. Never alter the existing media module's S3 client or expose an upload/delete key selector.
- [ ] Apply JWT/role guards and a current-primary identity/version check before accepting file data, then recheck before the storage write. Use the existing `WorkflowRateLimitModule`/`WorkflowRateLimiter.hit("course-thumbnail-upload", actor.sub, 10, 60)` in a pre-body guard; fail closed when the limiter is unavailable. Enforce multipart limits without broadening global JSON parser limits in either bootstrap.
- [ ] Cover R2 timeout/error and ambiguous acknowledgement: do not mutate products, emit false success or attempt deletion. Use bounded redacted logs; return success only after storage acknowledgement. Abort storage requests on timeout where supported.
- [ ] Run focused config/upload suites and API build; review security, resource limits, provider binding and compatibility before proceeding.

## Task 3: Add a dedicated multipart BFF route and browser transport

**Create:** `apps/web/src/app/api/workspace/admin/course-thumbnails/route.ts`, `apps/web/src/lib/workspace/thumbnail-upload-server.ts`, `thumbnail-upload.ts`, and `apps/web/scripts/check-course-thumbnails.mjs`.

**Reference:** `apps/web/src/lib/workspace/server.ts` for identity/actor/error conventions, `apps/web/src/lib/auth/client.ts` for session serialization/refresh, and `apps/web/src/lib/api-diagnostics.ts` for sanitized upstream diagnostics. Keep the existing general JSON proxy contract unchanged.

**Interfaces:** `handleThumbnailUpload(request: NextRequest): Promise<NextResponse>`; `uploadCourseThumbnail(file: File, options: { expectedActor: string; signal: AbortSignal; onProgress: (percent: number) => void }): Promise<CourseThumbnailUploadResult>`. Browser path: `POST /api/workspace/admin/course-thumbnails`; fixed upstream: Task 2's endpoint.

- [ ] Add failing Node BFF tests for missing cookie, cross-origin/absent origin, cross-site fetch metadata, nonmultipart data, actor mismatch, inactive/nonadmin identity, oversized bodies without trustworthy length, extra multipart fields/files and malformed upstream success responses. Denial must prevent the upstream upload.
- [ ] Bound incoming bytes before multipart parsing; authenticate and check same origin/current ADMIN or SUPER_ADMIN/required `X-Workspace-Actor` before reading the upload body. Forward only one validated file to the fixed backend route, with the cookie-derived bearer token. Do not forward caller Authorization, arbitrary destination headers or URLs. Disable redirects and response caching.
- [ ] Return only a schema-validated HTTPS URL and safe error codes. The API constructs that URL from its configured public origin/path prefix; the BFF enforces the shared HTTPS result schema and never accepts a client-supplied destination. Propagate expected 401/403/413/415/422/429/503 outcomes without raw provider errors. Keep R2 configuration in the API; no extra web configuration or configuration endpoint is needed.
- [ ] Implement XHR plus FormData for actual transfer progress, abort and timeout. Run through `withSessionLock`; allow at most one retry after explicit 401/session refresh with the same expected actor. Do not automatically retry timeout/ambiguous successful writes. Never set multipart Content-Type manually.
- [ ] Separate transfer completion from waiting for backend validation/storage. Ignore results after abort or actor change, including when a queued operation has not started yet. Emit existing session-update events on auth changes.
- [ ] Run new BFF/transport tests plus existing workspace, admin catalog and YouTube course Node tests; confirm the catch-all JSON route still rejects multipart writes outside this dedicated route.

## Task 4: Build the reusable uploader and integrate the wizard

**Create:** `apps/web/src/components/workspace/image-upload.tsx`, `apps/web/src/lib/i18n/image-upload.ts`.

**Modify:** `apps/web/src/components/workspace/admin-course-wizard.tsx`, `apps/web/src/lib/i18n/admin-courses.ts`, `apps/web/scripts/admin-course-management-browser-cases.mjs`, `admin-course-workspace-browser-cases.mjs`, and existing fixtures that currently fill the URL input.

**Interfaces:** Controlled `ImageUpload` props: `value: string | null`, `onChange(url: string | null): void`, `upload(file: File, options: { signal: AbortSignal; onProgress: (percent: number) => void }): Promise<CourseThumbnailUploadResult>`, `onStateChange(state: { busy: boolean; dirty: boolean; blocked: boolean }): void`, `disabled?: boolean`, plus localized labels/errors. Inject the course upload function; the reusable UI does not know R2 credentials or course persistence routes.

- [ ] Add failing browser cases for file chooser/drop, valid formats/size boundaries, empty/multiple/invalid files, immediate preview, progress/processing, replace/cancel/remove, failure/retry and existing edit artwork. Include keyboard access and both locales.
- [ ] Implement a labeled native input, keyboard-operable selection button/drop region, image preview, accessible progress/status and linked errors. Validate extension/MIME/size before transport and revoke object URLs on replacement/unmount.
- [ ] Preserve the previous accepted `value` until the current upload succeeds. Use an AbortController and generation token so a late response cannot override a later selection/removal or a changed actor. Discarding a failed/pending replacement restores that previous value; explicit removal calls `onChange(null)`.
- [ ] Wire `value` into `values.thumbnailUrl` and the existing null-on-save mapping. Include pending file dirty state in `useUnsavedChanges`. Disable conflicting save/step/lifecycle actions while busy and prevent save after a failed replacement until retry/discard. Reset/cancel uploader state on reload/discard/account change without losing other valid fields during recoverable errors.
- [ ] Add race/failure regressions: old upload completes last, pending selection removed, account changes during upload/queue wait, lost response, later course-save conflict/failure, double selection and navigation during upload. Assert original persisted thumbnail and other course fields survive failures.
- [ ] Run styles and targeted browser checks; inspect mobile/desktop screenshots, focus, long translated messages and a slow upload before accepting the UI.

## Task 5: Verify persistence compatibility and real public delivery

**Modify tests as needed:** `apps/api/src/modules/products/admin-products.spec.ts`, `admin-course-curriculum.database.spec.ts`, `apps/api/src/modules/courses/courses.spec.ts`, `courses.database.spec.ts`, `apps/web/scripts/check-youtube-courses.mjs`, `course-browser-cases.mjs`.

- [ ] Extend tests proving successful create/edit saves only the returned URL in existing metadata, preserves unrelated metadata and version checks, supports explicit null removal, and retains valid legacy external URLs and missing/null artwork fallbacks.
- [ ] Verify published catalog/detail, administrative edit/review and learner library continue using their existing thumbnail projections. Avoid changing the public image component unless a demonstrated R2 compatibility issue requires it.
- [ ] Run database tests only against an explicitly selected disposable task-owned database, using existing `YT_TEST_DATABASE_URL`, `YTL_TEST_DATABASE_URL` and applicable `ADM3_TEST_DATABASE_URL` opt-ins. Never fall back to the real project database or apply an unsolicited migration.
- [ ] After configuration is ready, upload a synthetic test image to the user-approved bucket through the actual authenticated flow. Fetch its returned URL without cookies/Authorization; verify HTTPS, 200, image bytes, WebP Content-Type, cache headers and rendering on the public course page. Use a disposable local course for persistence/public-page verification; do not publish or edit live content merely to test.
- [ ] Confirm custom-domain delivery in the intended production environment before claiming production delivery works. Development `r2.dev`, mock storage and local builds do not establish this.
- [ ] Record test object keys without credentials or signed URLs. Leave objects untouched unless deletion of exact task-owned artifacts is separately authorized; there is no automatic cleanup feature in this scope.

## Task 6: Review, run checks and record the implementation handoff

- [ ] Review the final diff as Code Reviewer + QA, adding Security, UI Reviewer and Tech Lead perspectives. Check real decoder behavior, guard order, credential redaction, resource ceilings, stale actor/results, prior-thumbnail preservation and absence of unsafe deletion.
- [ ] Fix new in-scope findings, rerun affected checks, then re-review. Record pre-existing failures separately rather than changing unrelated features.
- [ ] Execute the relevant commands below after the future implementation; capture actual results and skipped/blocked checks. All application checks are **not run for this plan-only task**.

| Command/check (repository root unless noted) | Required evidence at implementation time |
| --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Contracts compile before dependent checks. |
| `pnpm --filter @vetralink/api exec jest --runInBand course-thumbnails env.schema.spec env.service.spec admin-products.spec courses.spec` | Focused API/config/security/compatibility suites pass, including all new suites within the `course-thumbnails` directory. |
| Opt-in product/course database suites with explicitly supplied disposable database URLs | Actual persistence, metadata preservation and existing course compatibility; skipped suites remain reported as skipped. |
| `pnpm --filter @vetralink/api build` | Prisma generation/Nest compilation and decoder packaging pass. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-course-thumbnails.mjs scripts/check-workspace.mjs scripts/check-admin-catalog.mjs scripts/check-youtube-courses.mjs` | Multipart BFF, transport and existing JSON/course contracts pass. |
| `pnpm --filter @vetralink/web check:styles` and `pnpm --filter @vetralink/web test:styles` | Tailwind policy and styling regressions pass. |
| `pnpm --filter @vetralink/api lint` and `pnpm --filter @vetralink/web lint` | Record passes or concrete baseline/configuration failures; avoid interactive lint initialization or unrelated lint cleanup. |
| `pnpm --filter @vetralink/web build` | Production compilation passes, using the existing isolated-build procedure if needed to protect local build state. |
| `WORKSPACE_BROWSER_FOCUS=admin-courses pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | Administration cases pass for ADMIN/SUPER_ADMIN, bn/en, 320/768/1440px. Use documented isolated `WEB_TEST_BUILD_DIR` setup where required. |
| `WORKSPACE_BROWSER_FOCUS=courses pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | Public/learner course regression cases pass. Browser harnesses run serially because they own shared ports. |
| Real configured R2 upload + unauthenticated public GET + browser display | Actual provider/delivery evidence, separately labeled from controlled fixtures. |
| `python3 .context/scripts/validate.py` and `git diff --check` | Documentation structure and whitespace pass. Inspect untracked new files as well as the tracked diff for secrets and accidental edits. |

- [ ] Update this plan with dated evidence, actual changed files, new dependency/version review, any accepted deviations and unresolved target-environment limits. Update scoped context only if implemented contracts change; preserve unrelated paused roadmap work.
- [ ] Confirm credentials never entered frontend bundles, committed examples, screenshots or logs. Leave changes uncommitted; suggest `feat(courses): upload thumbnails securely to Cloudflare R2`.

## Rollout and recovery

No migration is expected. Deploy compatible shared/API/web artifacts together only when separately requested, with API-side R2 configuration set first. Keep upload disabled until ready; existing thumbnail reads and course edits must remain usable when it is disabled. Verify one synthetic upload/public GET before enabling general admin usage.

If uploads fail, disable the upload feature and preserve the current database URLs and R2 objects. A web/API rollback must not clear thumbnail metadata or remove images: earlier public code can already render HTTPS URLs. Course persistence happens only through the existing versioned save, so an R2 failure cannot overwrite a saved thumbnail. An acknowledged upload followed by abandoned/failed course save can leave an unreferenced public image; safe automated cleanup is explicitly deferred.

## Current completion record

Only this implementation plan is being produced. All configuration, application changes, dependency additions, upload/provider tests, database tests, builds, linting and deployment remain pending. The next prerequisite is user-provided/configured R2 settings and a request to resume implementation.
