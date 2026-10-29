# Cloudinary Course Thumbnail Upload Implementation Plan

> **Execution status — 2026-10-29:** Implementation authorized after the user configured Cloudinary credentials. Use sequential executing-plans implementation; no Git staging/commit/merge/push or deployment is requested. Keep the historical `course-thumbnail-r2` directory for existing references. Credentials are configured privately in the ignored API env; source examples and a setup guide support a second PC.

**Goal:** Replace the administrative course thumbnail URL input with image selection/drag-and-drop, preview and secure Cloudinary upload while preserving existing course data and public artwork.

**Architecture:** Send a bounded multipart image through a dedicated same-origin Next.js BFF route to an authenticated NestJS upload endpoint. The API validates and normalizes the image, uploads it through an isolated Cloudinary adapter using server-side signed authentication, and returns the acknowledged versioned public HTTPS URL. Existing product create/edit requests save that URL in the current thumbnail field; uploading alone never changes a course.

**Tech stack:** Existing Next.js 14/React 18/Tailwind 3, NestJS 10, shared Zod contracts and Redis workflow limiter. Proposed new API dependencies: the official `cloudinary` Node SDK for authenticated uploads, and `sharp` for actual image decoding, pixel bounds, orientation and metadata-free re-encoding. Select and review maintained compatible versions at implementation time; existing AWS media dependencies remain unchanged.

**Requirements source:** The user's course thumbnail request, captured below, extending the [administrative course specification](../admin-course-management/spec.md) and [existing implementation/evidence](../admin-course-management/plan.md). Implementation requirements are now recorded in the sibling [specification](spec.md), which adopts the detailed acceptance contract below.

## Confirmed baseline and remaining unknowns

**Confirmed from code during this investigation:**

- `apps/web/src/components/workspace/admin-course-wizard.tsx` implements both creation/editing and contains the current `course-thumbnailUrl` URL input. Its state already preserves product versions, submitted-slug recovery, saved information and unsaved changes.
- `apps/api/src/modules/products/admin-products.repository.ts` and `admin-products.service.ts` persist `thumbnailUrl` as `Product.metadata.courseThumbnailUrl`, preserving unrelated metadata on edits.
- `packages/shared-types/src/validation/youtube-courses.ts` validates public HTTPS artwork and reads existing thumbnail metadata. Public course projections and `apps/web/src/components/courses/course-artwork.tsx` already use it, with broken/missing-image fallback.
- `apps/web/src/lib/workspace/server.ts` allows fixed upstream routes, checks current identity and same-origin writes, and currently accepts JSON writes only. `workspaceRequest` serializes JSON and cannot transfer multipart files unchanged.
- The API already depends on `@aws-sdk/client-s3`; the existing `S3StorageService` is shared by other media operations. Keep its existing AWS/bucket settings unchanged; Cloudinary thumbnails use a separate adapter.
- API configuration uses `NestConfigModule.forRoot`; `apps/api/.env` and `apps/web/.env.local` are ignored by Git. The original 2026-10-26 investigation recorded no R2/storage configuration. This revision does not inspect or print secret values; local and hosted Cloudinary configuration remains unverified.

**Unknown before implementation:** Cloudinary access and public delivery were initially unverified. The local configured-provider test below now establishes one upload/public GET; account quotas, deployed backend configuration and production delivery remain unverified. The original pre-implementation API manifest/schema had no Cloudinary integration; see the execution record below for current evidence.

## Prerequisites: configuration before implementation

- [x] User configured the Cloudinary product environment and requested implementation. Course thumbnails are public artwork; private videos, ebooks, deliveries and attachments retain their existing storage.
- [ ] Find the Cloud Name on the Cloudinary Dashboard and manage the API Key/API Secret under **Settings → API Keys**. Keep the secret out of chat, Git, frontend files, screenshots and logs.
- [ ] Set the proposed variables below in `apps/api/.env` for local API execution. When deployment is separately requested, configure the same values in the backend host's environment settings. Task 1 implements these names in the API configuration schema.

| Variable | Required value/source |
| --- | --- |
| `CLOUDINARY_THUMBNAILS_ENABLED` | Explicit boolean; `false` by default. Set `true` only with complete configuration. |
| `CLOUDINARY_CLOUD_NAME` | Cloud Name of the selected product environment. |
| `CLOUDINARY_API_KEY` | API Key for that same product environment. |
| `CLOUDINARY_API_SECRET` | Matching API Secret; backend-only secret. |
| `CLOUDINARY_THUMBNAILS_FOLDER` | Optional server-owned public-ID prefix; default `course-thumbnails`. No manual folder creation is required. In dynamic-folder environments this prefix is not a promise about Media Library display folders. |

- [ ] Confirm the product environment permits authenticated image uploads and public `image/upload` delivery via Cloudinary's standard HTTPS CDN. Check current account usage/upload limits; do not assume unlimited free storage, bandwidth or transformations.
- [ ] Confirm Redis is available for the existing API workflow limiter and that the target runtime can load `sharp`. Recheck the 3 MiB file limit plus multipart overhead against the actual web/API hosting request limits before release.
- [ ] Use backend-authenticated uploads. This design needs no unsigned upload preset, frontend Cloudinary SDK, R2 bucket/token, custom image domain or browser upload signature endpoint.

**User handoff:** Supply the Cloud Name and confirm that the matching API Key/API Secret are configured privately in `apps/api/.env` (and, later, the deployed API environment). The default prefix can be used unless another is requested. Then ask to implement. Never paste the API Secret into chat. Task 1 now implements these configuration names. Restart the local API after environment changes.

Do not add Cloudinary credentials to `apps/web/.env.local` or introduce `NEXT_PUBLIC_CLOUDINARY_API_SECRET`. Document names and empty/example values only in `apps/api/.env.example` and `.env.vercel.example`. No account provisioning, DNS change or hosting deployment is performed by this plan.

**Confirmed from official documentation (checked 2026-10-29):** [credentials and secret handling](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials), [authenticated Node stream uploads](https://cloudinary.com/documentation/node_image_and_video_upload), [upload parameters and overwrite behavior](https://cloudinary.com/documentation/image_upload_api_reference), and [versioned delivery URLs](https://cloudinary.com/documentation/image_transformations#asset_versions). These references establish provider behavior, not working credentials or delivery for this project.

## Acceptance contract and global constraints

1. ADMIN and SUPER_ADMIN can choose one `.jpg`, `.jpeg`, `.png` or `.webp` image through a native file input or drag-and-drop. Other roles, inactive users and stale/revoked identities cannot upload at either BFF or API boundary.
2. Proposed initial file ceiling: **3 MiB (3,145,728 bytes)**, shared by frontend and API. Enforce a multipart request ceiling of file maximum plus **64 KiB** at the BFF/API ingress and recheck actual bytes when length headers are absent or false. Confirm the resulting payload fits actual deployment limits before release.
3. Validate extension and declared MIME type on both sides and actual decoded format at the API. Reject empty, corrupt, unsupported, disguised and animated images. Bound input to **40,000,000 pixels** and one frame before full decode. These are proposed defaults, not existing behavior.
4. Normalize accepted images with orientation correction, metadata removal and WebP output, quality **85**, resized inside **1920 × 1080** without enlarging. Enforce the 3 MiB output ceiling too. Generate the Cloudinary public ID `<CLOUDINARY_THUMBNAILS_FOLDER>/<UUID>` without a file extension; WebP is the uploaded format. No client-supplied public ID, cloud name, folder, URL or filesystem path controls storage.
5. Show local preview immediately, honest transfer progress, separate server-processing state, success and localized actionable errors. Upload progress reaching 100% is not storage success; accept the new URL only after API acknowledgement.
6. Existing images remain visible on edit. Canceling or failing a replacement keeps the previous accepted URL and all other form fields. Selecting a file does not clear saved artwork. Explicit removal sets the form thumbnail to null only when the course information is saved.
7. Disable saving/advancing/publishing while a file is being validated/uploaded. A selected file whose upload failed must be retried or explicitly discarded before saving. Preserve wizard dirty-state/navigation protection for pending files as well as URL changes.
8. No database/schema change is planned. Preserve existing valid external thumbnail URLs, null/missing metadata, other product metadata, course curriculum, pricing, enrollment and version-conflict behavior.
9. Use a separate injectable storage interface and Cloudinary adapter. Credentials remain server-side. Upload normalized WebP bytes with `resource_type: "image"`, `type: "upload"`, a generated public ID and `overwrite: false`. Return the validated versioned `secure_url` from the provider response. CDN cache policy is Cloudinary-managed; do not promise an R2-style application-controlled Cache-Control header.
10. No automatic object deletion on replace, remove, canceled upload or failed course save. Abandoned uploads may remain; record that tradeoff. Future cleanup requires separate reference tracking/review, never deletion inferred from an arbitrary URL.
11. Keep Bangla-default and English UI, accessible controls, responsive layout and Tailwind-only styling. Preserve the existing course table/wizard width conventions and shared UI foundations.
12. Follow Implement → Review → Test → Re-review → Finalize. Keep changes scoped; do not modify roadmaps, unrelated features or existing AWS storage behavior. No Git staging/commit/merge/push, production writes or deployment without explicit user authorization.

## Review focus

- An old upload finishes after a newer selection, removal, reload or account switch: it must not replace current form state. Task 4 owns cancellation/generation tests.
- Storage accepts an image but its response is lost, or the later course save fails: keep the prior course data and a recoverable form; never delete existing objects. Tasks 2 and 4 cover the failure boundary.
- A file lies about MIME, extension, length, dimensions or frames: reject before storage and bound resource use. Tasks 1–3 cover actual bytes and limits.
- Logout, role revocation or actor change happens during a slow upload: recheck current identity, reject changed actor requests and ignore stale client results. Tasks 2–4 own those tests.
- Existing external URLs, null metadata or failed public image delivery appear after rollout: retain compatible projections and the current fallback; prove Cloudinary delivery separately. Tasks 5–6 cover compatibility and real delivery.

## Task 1: Define configuration and shared upload contract

**Modify:** `apps/api/src/config/env.schema.ts`, `env.service.ts`, `env.schema.spec.ts`, `env.service.spec.ts`; `apps/api/.env.example`, `.env.vercel.example`; `packages/shared-types/src/validation/index.ts`.

**Create:** `packages/shared-types/src/validation/course-thumbnails.ts`; API configuration-specific tests may remain in the adjacent existing config suites.

**Interfaces:** Export `COURSE_THUMBNAIL_MAX_BYTES`, `COURSE_THUMBNAIL_MAX_REQUEST_BYTES`, allowed extension/MIME constants, `courseThumbnailUploadResultSchema` and its inferred `CourseThumbnailUploadResult` type. Result is `{ url: string }`, validated as public HTTPS; do not return SDK responses, secrets or presigned write URLs. Add typed `EnvService` getters for the variables above.

- [x] Write failing config/contract tests for enabled-but-incomplete configuration, explicit `false` parsing, missing/blank cloud name, API key or secret, invalid cloud-name characters, and folder values containing empty/dot/traversal segments or URL syntax. Disabled uploads must allow existing course reads/edits without Cloudinary credentials.
- [x] Run the focused tests and confirm the intended failures before implementation.
- [x] Add conditional configuration validation, requiring cloud name/key/secret only when enabled and a server-owned safe public-ID prefix. Run these checks before the existing Vercel production-integration bypass. Avoid `z.coerce.boolean()` for environment strings.
- [x] Export constants/result contract and update examples without real credentials. Keep existing thumbnail URL validation compatible with legacy hosts.
- [x] Build shared types, rerun focused tests, and review that neither configuration validation nor errors print secret values.

## Task 2: Implement the isolated backend upload boundary

**Create under `apps/api/src/modules/course-thumbnails/`:** `course-thumbnails.module.ts`, `course-thumbnails.controller.ts`, `course-thumbnails.service.ts`, `image-validator.ts`, `thumbnail-storage.interface.ts`, `cloudinary-thumbnail-storage.service.ts`, and adjacent `.spec.ts` suites including `course-thumbnails.controller.int.spec.ts`.

**Modify:** `apps/api/src/app.module.ts` to import the module; `apps/api/package.json` and `pnpm-lock.yaml` only for the justified Cloudinary SDK and decoder dependencies; root `package.json` only if its pnpm native-build allowlist needs an entry for the reviewed sharp installation.

**Interfaces:** `ThumbnailStorage.put(publicId: string, body: Buffer, contentType: "image/webp"): Promise<CourseThumbnailUploadResult>`; `normalizeCourseThumbnail(input: Buffer): Promise<Buffer>`; `CourseThumbnailsService.upload(actor: JwtPayload, file: Express.Multer.File): Promise<CourseThumbnailUploadResult>`.

**HTTP:** `POST /api/v1/admin/courses/thumbnails`, one multipart field named `file`, bearer authentication, ADMIN/SUPER_ADMIN. Return the standard API envelope with `data: { url }`. Reject extra fields/files. Use 401/403 for authentication/authorization, 413 for size, 415 for unsupported type, 422 for corrupt/invalid image, 429 for rate limit, and 503 for unavailable configuration/provider; use existing exception/envelope conventions and stable redacted error codes.

- [x] Write failing tests using real synthetic JPEG/PNG/WebP bytes plus corrupt, spoofed, oversized, animated and excessive-dimension fixtures. Assert storage is never called for rejected inputs.
- [x] Write HTTP tests that exercise actual guards/interceptor/validation: missing token, ordinary role, suspended/revoked identity, extra fields/files and actual byte limits. Assert active ADMIN and SUPER_ADMIN succeed.
- [x] Add the maintained Cloudinary SDK and image decoder using pnpm and validate native-binary packaging locally; target-host packaging remains a deployment check. Implement bounded decoding/normalization; do not trust filenames or MIME alone.
- [x] Bind the Cloudinary adapter to its own interface. Use signed `uploader.upload_stream` with API-side credentials supplied per call or through isolated SDK configuration; avoid mutating process-global SDK configuration. Stream only normalized bytes, with the generated public ID, `resource_type: "image"`, `type: "upload"` and `overwrite: false`. Use a bounded provider timeout and reject provider collisions reported as an existing asset. Validate the acknowledged `public_id`, positive version, WebP format and versioned `secure_url` against `https://res.cloudinary.com/<configured-cloud-name>/image/upload/`, with no embedded credentials, query or fragment; reject malformed or mismatched success results. Return only `{ url }`. Do not derive delivery URLs from folder display names or user input. Never alter the existing S3 client or expose upload/delete selectors.
- [x] Apply JWT/role guards and a current-primary identity/version check before accepting file data, then recheck before the storage write. Use the existing `WorkflowRateLimitModule`/`WorkflowRateLimiter.hit("course-thumbnail-upload", actor.sub, 10, 60)` in a pre-body guard; fail closed when the limiter is unavailable. Enforce multipart limits without broadening global JSON parser limits in either bootstrap.
- [x] Cover Cloudinary timeout, invalid credentials, quota/provider error, malformed success response and public-ID mismatch and ambiguous acknowledgement: do not mutate products, emit false success or attempt deletion. Use bounded redacted logs; return success only after storage acknowledgement. Abort/destroy the upload stream on timeout where supported. Add adapter tests for authenticated SDK options, collision rejection and versioned URL validation; never automatically retry an ambiguous provider write.
- [x] Run focused config/upload suites and API build; review security, resource limits, provider binding and compatibility before proceeding.

## Task 3: Add a dedicated multipart BFF route and browser transport

**Create:** `apps/web/src/app/api/workspace/admin/course-thumbnails/route.ts`, `apps/web/src/lib/workspace/thumbnail-upload-server.ts`, `thumbnail-upload.ts`, and `apps/web/scripts/check-course-thumbnails.mjs`.

**Reference:** `apps/web/src/lib/workspace/server.ts` for identity/actor/error conventions, `apps/web/src/lib/auth/client.ts` for session serialization/refresh, and `apps/web/src/lib/api-diagnostics.ts` for sanitized upstream diagnostics. Keep the existing general JSON proxy contract unchanged.

**Interfaces:** `handleThumbnailUpload(request: NextRequest): Promise<NextResponse>`; `uploadCourseThumbnail(file: File, options: { expectedActor: string; signal: AbortSignal; onProgress: (percent: number) => void }): Promise<CourseThumbnailUploadResult>`. Browser path: `POST /api/workspace/admin/course-thumbnails`; fixed upstream: Task 2's endpoint.

- [x] Add failing Node BFF tests for missing cookie, cross-origin/absent origin, cross-site fetch metadata, nonmultipart data, actor mismatch, inactive/nonadmin identity, oversized bodies without trustworthy length, extra multipart fields/files and malformed upstream success responses. Denial must prevent the upstream upload.
- [x] Bound incoming bytes before multipart parsing; authenticate and check same origin/current ADMIN or SUPER_ADMIN/required `X-Workspace-Actor` before reading the upload body. Forward only one validated file to the fixed backend route, with the cookie-derived bearer token. Do not forward caller Authorization, arbitrary destination headers or URLs. Disable redirects and response caching.
- [x] Return only a schema-validated HTTPS URL and safe error codes. The API validates that URL against its configured Cloudinary cloud name, generated public ID and acknowledged version; the BFF enforces the shared HTTPS result schema and never accepts a client-supplied destination. Propagate expected 401/403/413/415/422/429/503 outcomes without raw provider errors. Keep Cloudinary configuration in the API; no extra web configuration or configuration endpoint is needed.
- [x] Implement XHR plus FormData for actual transfer progress, abort and timeout. Run through `withSessionLock`; allow at most one retry after explicit 401/session refresh with the same expected actor. Do not automatically retry timeout/ambiguous successful writes. Never set multipart Content-Type manually.
- [x] Separate transfer completion from waiting for backend validation/storage. Ignore results after abort or actor change, including when a queued operation has not started yet. Emit existing session-update events on auth changes.
- [x] Run new BFF/transport tests plus existing workspace, admin catalog and YouTube course Node tests; confirm the catch-all JSON route still rejects multipart writes outside this dedicated route.

## Task 4: Build the reusable uploader and integrate the wizard

**Create:** `apps/web/src/components/workspace/image-upload.tsx`, `apps/web/src/lib/i18n/image-upload.ts`.

**Modify:** `apps/web/src/components/workspace/admin-course-wizard.tsx`, `apps/web/src/lib/i18n/admin-courses.ts`, `apps/web/scripts/admin-course-management-browser-cases.mjs`, `admin-course-workspace-browser-cases.mjs`, and existing fixtures that currently fill the URL input.

**Interfaces:** Controlled `ImageUpload` props: `value: string | null`, `onChange(url: string | null): void`, `upload(file: File, options: { signal: AbortSignal; onProgress: (percent: number) => void }): Promise<CourseThumbnailUploadResult>`, `onStateChange(state: { busy: boolean; dirty: boolean; blocked: boolean }): void`, `disabled?: boolean`, plus localized labels/errors. Inject the course upload function; the reusable UI does not know Cloudinary credentials or course persistence routes.

- [x] Add failing browser cases for file chooser/drop, valid formats/size boundaries, empty/multiple/invalid files, immediate preview, progress/processing, replace/cancel/remove, failure/retry and existing edit artwork. Include keyboard access and both locales.
- [x] Implement a labeled native input, keyboard-operable selection button/drop region, image preview, accessible progress/status and linked errors. Validate extension/MIME/size before transport and revoke object URLs on replacement/unmount.
- [x] Preserve the previous accepted `value` until the current upload succeeds. Use an AbortController and generation token so a late response cannot override a later selection/removal or a changed actor. Discarding a failed/pending replacement restores that previous value; explicit removal calls `onChange(null)`.
- [x] Wire `value` into `values.thumbnailUrl` and the existing null-on-save mapping. Include pending file dirty state in `useUnsavedChanges`. Disable conflicting save/step/lifecycle actions while busy and prevent save after a failed replacement until retry/discard. Reset/cancel uploader state on reload/discard/account change without losing other valid fields during recoverable errors.
- [x] Add browser/transport regressions for cancel/retry/drop, empty drops, queued/active abort, actor change after refresh, ambiguous responses and existing wizard save conflicts/recovery. Review generation-based protection for late responses/account changes; existing product data is never mutated by the upload endpoint. Actual database persistence is separately gated in Task 5.
- [x] Run styles and targeted browser checks; inspect mobile/desktop screenshots, focus, long translated messages and a slow upload before accepting the UI.

## Task 5: Verify persistence compatibility and real public delivery

**Modify tests as needed:** `apps/api/src/modules/products/admin-products.spec.ts`, `admin-course-curriculum.database.spec.ts`, `apps/api/src/modules/courses/courses.spec.ts`, `courses.database.spec.ts`, `apps/web/scripts/check-youtube-courses.mjs`, `course-browser-cases.mjs`.

- [x] Extend tests proving successful create/edit saves only the returned URL in existing metadata, preserves unrelated metadata and version checks, supports explicit null removal, and retains valid legacy external URLs and missing/null artwork fallbacks.
- [x] Verify published catalog/detail, administrative edit/review and learner library continue using their existing thumbnail projections. Avoid changing the public image component unless a demonstrated Cloudinary compatibility issue requires it.
- [ ] Run database tests only against an explicitly selected disposable task-owned database, using existing `YT_TEST_DATABASE_URL`, `YTL_TEST_DATABASE_URL` and applicable `ADM3_TEST_DATABASE_URL` opt-ins. Never fall back to the real project database or apply an unsolicited migration.
- [ ] After configuration is ready, upload a synthetic test image to the user-approved Cloudinary product environment through the actual authenticated flow. Fetch its returned URL without cookies/Authorization; verify HTTPS, 200, image bytes, WebP Content-Type, returned CDN cache headers and rendering on the public course page. Use a disposable local course for persistence/public-page verification; do not publish or edit live content merely to test.
- [ ] Confirm standard Cloudinary CDN delivery for the configured product environment in the intended deployment before claiming production delivery works. Mock storage, a successful SDK callback and local builds do not establish unauthenticated public delivery. Record observed caching headers without requiring an application-defined TTL.
- [x] Record only task-owned test public IDs and redacted delivery evidence, without credentials or upload signatures. Leave objects untouched unless deletion of exact task-owned artifacts is separately authorized; there is no automatic cleanup feature in this scope.

## Task 6: Review, run checks and record the implementation handoff

- [x] Review the final diff as Code Reviewer + QA, adding Security, UI Reviewer and Tech Lead perspectives. Check real decoder behavior, guard order, credential redaction, resource ceilings, stale actor/results, prior-thumbnail preservation and absence of unsafe deletion.
- [x] Fix new in-scope findings, rerun affected checks, then re-review. Record pre-existing failures separately rather than changing unrelated features.
- [x] Execute the relevant commands below after the future implementation; capture actual results and skipped/blocked checks. Record actual implementation results below; the historical plan-only revision did not run application checks.

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
| Real configured Cloudinary upload + unauthenticated public GET + browser display | Actual provider/delivery evidence, separately labeled from controlled fixtures. |
| `python3 .context/scripts/validate.py` and `git diff --check` | Documentation structure and whitespace pass. Inspect untracked new files as well as the tracked diff for secrets and accidental edits. |

- [x] Update this plan with dated evidence, actual changed files, new dependency/version review, any accepted deviations and unresolved target-environment limits. Update scoped context only if implemented contracts change; preserve unrelated paused roadmap work.
- [x] Confirm credentials never entered frontend bundles, committed examples, screenshots or logs. Leave changes uncommitted; suggest `feat(courses): upload thumbnails securely to Cloudinary`.

## Rollout and recovery

No migration is expected. Deploy compatible shared/API/web artifacts together only when separately requested, with API-side Cloudinary configuration set first. Keep upload disabled until ready; existing thumbnail reads and course edits must remain usable when it is disabled. Verify one synthetic upload/public GET before enabling general admin usage.

If uploads fail, disable the upload feature and preserve the current database URLs and Cloudinary assets. A web/API rollback must not clear thumbnail metadata or remove images: earlier public code can already render HTTPS URLs. Course persistence happens only through the existing versioned save, so a Cloudinary failure cannot overwrite a saved thumbnail. An acknowledged upload followed by abandoned/failed course save can leave an unreferenced public image; safe automated cleanup is explicitly deferred.

## Historical planning-only record (superseded by implementation below)

**2026-10-29 provider revision:** Updated this existing plan from the unimplemented R2 proposal to Cloudinary, preserving the admin uploader, multipart BFF, image normalization, authorization, race handling and existing thumbnail metadata contract. The legacy directory name is retained intentionally; there is no R2 adapter to migrate. Application source, dependencies, environment files, database and roadmaps are unchanged.

At the planning-only revision, application changes and provider testing were pending. The user subsequently configured credentials and authorized implementation; the execution record below supersedes that status. No R2 setup is needed.


### Plan revision validation — 2026-10-29

- **Observed behavior:** `python3 .context/scripts/validate.py` passed: 48 Markdown documents, 373 local links and 95 source entries; all context documents reachable. This checks the context graph, not Cloudinary behavior or every task document.
- **Observed behavior:** `git diff --check` passed. Scoped inspection confirmed that only this plan changed and that active configuration/adapter tasks use Cloudinary rather than R2. Both relative task-document links resolve.
- **Review and re-review:** checked configuration, adapter return types, versioned delivery, dependency/native-build requirements, existing metadata compatibility and planning-only scope. Removed the R2 endpoint/bucket/domain/cache-header assumptions. No unresolved material inconsistency was found in the revised provider plan; actual runtime and provider acceptance remain pending.
- No application build, lint, browser test, dependency install, environment mutation or live upload was run for this documentation-only revision.
- Suggested documentation commit: `docs(courses): switch thumbnail upload plan to Cloudinary`.


## Implementation and verification — 2026-10-29

**Observed implementation:** All six tasks' application/documentation work is present locally. Shared contracts and conditional configuration, an isolated Nest upload module/Cloudinary adapter, the bounded Next multipart BFF, XHR transport, bilingual reusable uploader and wizard integration are implemented. Existing metadata, versioned saves, legacy public URLs and private S3 media remain compatible. The code is uncommitted and undeployed.

**Configuration:** Moved the five configured Cloudinary variables from `apps/web/.env.local` into ignored `apps/api/.env`, preserving the existing root/API settings and not printing credential values. The local API environment validates successfully. The web previously pointed to the deployed API; its ignored development env now points to the local API so the new endpoint is available after restarting/running both services. Real credentials are absent from changed source/docs/examples. [Second-PC setup](setup.md) explains installation, copying/configuring the ignored API env, Redis/database dependencies, local API routing and later host configuration. The Node engine minimum is now **20.9.0**, matching sharp 0.35.5; the tested runtime was Node 22.22.1. Cloudinary 2.11.0 is isolated to the API; both dependencies are locked in pnpm.

| Check actually run | Observed result and scope |
| --- | --- |
| `pnpm --filter @vetralink/shared-types build` | Passed CJS, ESM and declaration builds. |
| `pnpm --filter @vetralink/api exec jest --runInBand course-thumbnails env.schema.spec env.service.spec admin-products.spec courses.spec` | **8 suites / 63 tests passed** after fixes. Real sharp JPEG/PNG/WebP decoding, APNG/WebP animation rejection, pixel/size bounds, metadata removal, MIME deception, real Nest/Supertest guard/interceptor/envelope behavior, a chunked request without Content-Length, simulated current-identity/limiter/provider failures, adapter timeout/redaction/ack validation and metadata compatibility. JWT verification/user lookup/limiter/storage are controlled dependencies in HTTP tests; no live database is implied. |
| `pnpm --filter @vetralink/api build` | Passed Prisma client generation and Nest compilation; no migration ran. |
| `pnpm --filter @vetralink/web exec node --test scripts/check-course-thumbnails.mjs scripts/check-workspace.mjs scripts/check-admin-catalog.mjs scripts/check-youtube-courses.mjs` | **72 tests passed.** BFF origin/cookie/actor/role checks, actual bounded multipart bytes, safe response projection; XHR FormData/progress, queued and active abort, same-actor refresh/retry and no ambiguous-write retries; existing workspace/catalog/course regressions. |
| `pnpm --filter @vetralink/web check:styles` / `test:styles` | Policy passed; **14 style tests passed**. |
| `pnpm --filter @vetralink/web exec tsc --noEmit --incremental false` | Passed. |
| `API_BASE_URL=http://localhost:3411/api/v1 pnpm --filter @vetralink/web exec next build /tmp/vetralink-cloudinary/web` | Passed production build in an isolated copy without env/credential files. Rebuilt after the empty-drop fix. |
| `WORKSPACE_BROWSER_FOCUS=admin-courses WEB_TEST_BUILD_DIR=/tmp/vetralink-cloudinary/web CHROME_NO_SANDBOX=1 pnpm --filter @vetralink/web exec node scripts/check-dashboard-browser.mjs` | **457 connected admin-course browser checks passed**, ADMIN/SUPER_ADMIN, bn/en, 320/768/1440px. New file/drop preview, blocking, cancel/restore, failure/retry, removal and empty-drop regression; existing wizard persistence/recovery/lifecycle cases use controlled HTTP fixtures. Screenshots in `/tmp/khamar-workspace-qa-zNi6rY`; thumbnail English desktop and Bangla mobile captures were visually inspected. |
| Same browser harness with `WORKSPACE_BROWSER_FOCUS=courses` | **192 learner-course browser checks passed**, controlled API/player fixtures. Screenshots in `/tmp/khamar-workspace-qa-8YVRXq`. |
| Configured Cloudinary adapter upload + unauthenticated HTTPS GET + actual WebP decode | **Passed** using one synthetic 64×36 image, real privately configured credentials and the adapter. GET 200, `image/webp`, decoded 64×36. Observed CDN header: `public, no-transform, immutable, max-age=2592000`. This is provider evidence separate from controlled HTTP/browser flows; it does not establish deployed application auth or a live course save. |
| `pnpm --filter @vetralink/api lint` | Blocked by existing tooling: system ESLint 6.4.0 found no repository ESLint config. No config was generated. |
| `CI=1 pnpm --filter @vetralink/web lint` | Blocked by existing tooling: Next requests ESLint initialization. No interactive setup/configuration change was made. |
| Disposable PostgreSQL suites | Not run: no task-owned database/PostgreSQL tooling was available. Existing product metadata save behavior is tested with controlled repositories; actual DB/provider-integrated course saves and target deployment remain unverified. |
| `python3 .context/scripts/validate.py`, `git diff --check`, local task-document links, secret/source scan | Passed; final pass covers the completed documentation and untracked implementation files. |

### Review, fixes and decisions

A separate read-only reviewer inspected the whole working tree against the acceptance contract. No Critical issue was found. The two actionable findings were reproduced and fixed:

1. **APNG (Important):** libvips/sharp can omit `pages` for animated PNG. A real two-frame APNG fixture first resolved unexpectedly (RED). The decoder now walks bounded PNG chunk records and rejects APNG control/frame chunks before decoding; the fixture rejects (GREEN), while static PNG metadata merely containing `acTL` text remains accepted.
2. **Empty drop (regraded Important for stuck upload/save state):** dropping text/links during transfer aborted the request but left the UI uploading indefinitely. The real browser regression timed out before the fix (RED). Empty selections are now ignored before cancellation/generation changes; the upload completes (GREEN). The final admin browser suite passed with this case.

Earlier implementation checks also caught MIME/decoded-format mismatch and synchronous SDK error/timer cleanup; focused failing tests were added before correcting these. The final API suite covers the corrections. Re-review found no remaining material in-scope issue; the reviewer did not audit real credentials, deployment or live persistence, and its findings are not a production sign-off.

**Rulings:** Keep work in the user-selected checkout without Git writes; keep real credentials in ignored API env and supply reproducible source examples/setup instructions for the second PC; validate native packaging locally and retain target-host acceptance as a deployment gate. No new database schema or persisted Cloudinary asset-ID model was needed. Abandoned public uploads are retained rather than unsafely deleted.

**Limits:** Local backend database/Redis connectivity and a real administrative course save were not exercised. The browser fixtures verify the actual web/BFF code with controlled upstreams; the configured provider check verifies real Cloudinary separately. No production API/web deployment, live course mutation, migration, staging, commit, merge or push occurred. Target-host request limits/native packaging, actual deployed authorization/delivery and existing lint tooling remain follow-ups.

**Test asset retained:** `course-thumbnails/qa-86360217-5409-42e2-8c53-55d6a3e9e260`. Only this synthetic provider-check asset was created; no deletion was attempted. Provider evidence is in `/tmp/vetralink-cloudinary/provider-evidence.json` without credentials. Full local command logs are under `/tmp/vetralink-cloudinary/`.

Suggested commit: `feat(courses): upload course thumbnails through Cloudinary`.

## Thumbnail controls follow-up — 2026-10-29

The requested small UI refinement updates `image-upload.tsx` and its bilingual messages: an existing/local preview switches the picker label to **Change image** / **ছবি পরিবর্তন করুন**; an added/selected file has an icon-only red Trash2 removal control with a localized accessible label/title and 44px target. Removing also works during upload or after a failed selection through the existing abort/discard/clear handler. The empty state retains Choose image. No API, upload transport or dependency changes were needed.

Validation: TypeScript (`tsc --noEmit --incremental false`), Tailwind styling policy, isolated production Next build and the existing **457 connected admin-course browser checks passed**. Inspected English desktop and Bangla 320px screenshots from `/tmp/khamar-workspace-qa-MUSR99`; labels/icons render and controls wrap within the mobile layout. No new tests were added for this small UI refinement; existing file/drop/cancel/remove and wizard cases were reused. Source/accessibility self-review found no new in-scope issue. Existing deployment/database/lint limits above remain unchanged. Suggested commit: `feat(web): refine course thumbnail image controls`.

## 503 investigation — 2026-10-29

**Observed behavior:** the user supplied a web terminal entry for `POST /api/workspace/admin/course-thumbnails`: HTTP 503 after 1,813 ms. The existing web/API processes run in separate terminal sessions; historical terminal output was not available through the execution tool, so the supplied entry was used alongside bounded dependency probes.

- Local API health returned 200 with database/Redis up. Config presence checks confirmed API-side Cloudinary enablement/credentials and the web's local API origin without printing secrets.
- A fresh real Cloudinary adapter upload of a synthetic 64×36 WebP and unauthenticated public GET/decode passed (HTTP 200, image/webp). Evidence: `/tmp/vetralink-thumbnail-503/provider.log` and `provider-evidence.json`. No course metadata was changed or artwork deleted.
- The actual configured `WorkflowRateLimiter` returned `RATE_LIMIT_UNAVAILABLE`, including with its Redis connection ready. Direct `PING` succeeded, but the same `EVAL` command was repeatedly rejected with `ERR max requests limit exceeded. Limit: 500000, Usage: 500002`. This identifies exhausted Upstash request capacity in the mandatory pre-upload limiter; Cloudinary is operational. Initial connection closures were also observed; an SNI A/B probe did not establish SNI as the cause, so no speculative TLS/source change was made.
- [Upstash's official diagnosis](https://upstash.com/docs/redis/troubleshooting/max_requests_limit) identifies this error as exceeding the monthly request count and documents plan/usage remedies. Updated [setup troubleshooting](setup.md#upload-returns-503).

**Resolution still required:** restore Upstash quota/capacity or supply a deliberately chosen replacement Redis configuration, then rerun a real authenticated upload. No Upstash account-management connection or replacement configuration is available in this workspace. No billing/account changes, automatic service substitution, limiter bypass, source changes, environment changes or deployment were performed. The 503 is not claimed fixed. Documentation/self-review and context/link/whitespace validation are appropriate here; no application suites were rerun for this documentation-only diagnosis.

Suggested diagnostic documentation commit: `docs(courses): explain Redis quota upload failures`.
