# API development Prisma client synchronization

Status: Verified locally
Date: 2026-10-15. Inspected revision: a21a451.

Restore API development compilation when installed Prisma types predate schema changes, and regenerate the API client before each `pnpm dev` API startup.

**Confirmed from code at investigation:** `apps/api/prisma/schema.prisma` defines Product.contentProvider, Product.courseLessons, CourseLesson, CourseEnrollment and AdminMediaUpload. The installed generated schema lacked these additions. `apps/api/package.json` generated the client during build/postinstall but its development command started Nest directly. Course repositories therefore referenced fields missing from installed Prisma types. Related feature contracts remain in [YouTube courses](../../features/youtube-courses/spec.md).

Use the existing API-local `prisma generate` command before the Nest watch process, with `&&` so generation failure prevents compilation against stale types. Regenerate the installed client through the API package. No API contracts, source queries, schema, migration, database contents or dependencies change. Generation runs at startup; schema edits during an existing session still require generation and a restart.

Acceptance: reproduce the stale-client compiler failure, confirm the regenerated client includes the current models, and pass API compilation. Inspect the startup command and run relevant existing course tests. Preserve the root Prisma tree and human-managed Git policy. Debugging/backend plus Code Reviewer/QA perspectives apply; database deployment and runtime connectivity remain outside this compile fix.
