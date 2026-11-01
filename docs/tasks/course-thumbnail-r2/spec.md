# Cloudinary course thumbnails

Updated 2026-10-29. The user authorized implementation after configuring Cloudinary credentials. This specification adopts the acceptance contract in [the existing plan](plan.md#acceptance-contract-and-global-constraints), which remains the detailed source for limits, failure cases and the six tasks.

Replace the admin course thumbnail URL input with reusable file selection/drop, local preview, progress/processing, retry/cancel and explicit removal. Active ADMIN/SUPER_ADMIN upload through a same-origin authenticated Next.js multipart BFF and a NestJS endpoint to Cloudinary. Validate MIME/extension, actual decoded single-frame JPEG/PNG/WebP, 3 MiB file and bounded request/pixel limits. Normalize privately to metadata-free WebP before uploading. Preserve existing external URLs and course metadata/version behavior; uploading alone must never save/publish a course. Failed/pending replacement blocks saving until retried/discarded and cannot erase existing artwork. Abort and ignore stale uploads on replacement, unmount or actor change.

Cloudinary credentials belong to the API environment. Source examples/setup instructions support a second PC; real credentials do not need to be embedded in application code or this specification. Keep existing private S3 media, database and unrelated roadmap work unchanged. No migration, Git staging/commit/push or deployment is authorized by this implementation task. Use synthetic files for configured-provider testing; do not mutate live courses or delete artwork automatically.

Acceptance requires focused API/BFF/transport tests, existing product/course regressions, TypeScript/build and Tailwind checks, and actual browser checks in both locales/mobile/desktop. Report real Cloudinary upload/public retrieval separately from controlled fixtures and deployment acceptance.

## Thumbnail controls follow-up — 2026-10-29

When a thumbnail or selected image is present, show a localized Change image button and a red, icon-only trash button with an accessible removal label/title. Keep Choose image for the empty state. The trash button also applies to a pending/failed selection: cancel and discard local upload state, then clear the form thumbnail; persist removal only through the existing course save.
