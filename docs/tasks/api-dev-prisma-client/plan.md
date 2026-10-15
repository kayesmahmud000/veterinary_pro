# API development Prisma client synchronization plan

Spec: [spec.md](spec.md).

- [x] Inspect schema, generated types, course repositories, existing tests and package/Turbo startup commands.
- [x] Reproduce the existing compilation failure before regeneration.
- [x] Generate the API client before Nest watch startup and refresh the installed client.
- [x] Review command ordering, failure behavior, schema selection and scope.
- [x] Verify compilation and relevant existing course tests; re-review the final diff.
- [x] Record actual outcomes and any runtime limits.

## Evidence

**Observed behavior before repair:** the generated schema under the installed Prisma 5.22.0 package lacked Product.contentProvider, Product.courseLessons, CourseLesson, CourseEnrollment and AdminMediaUpload; the active API schema defined them. pnpm is the pinned 10.18.3. Initial Git state was clean at a21a451.

**Observed verification from repository root:**

- `pnpm --filter @vetralink/api exec tsc --noEmit --incremental false -p tsconfig.build.json` reproduced all 47 errors before regeneration and exits successfully with no errors after regeneration.
- `pnpm --filter @vetralink/api db:generate` succeeded against `apps/api/prisma/schema.prisma`; generated schema inspection confirms all previously missing additions. The first sandboxed attempt failed with `spawn EPERM`; rerunning with approved process permissions succeeded.
- `python -X utf8 .context/scripts/validate.py` passes: 48 Markdown documents, 326 local links and 95 source entries. The initial plain `python` invocation failed because Windows used cp1252; UTF-8 mode resolves this without changing the validator.
- `pnpm --filter @vetralink/api test --runInBand --runTestsByPath src/modules/courses/courses.spec.ts src/modules/products/admin-course-curriculum.spec.ts src/modules/products/youtube-course-contracts.spec.ts src/modules/products/entities/product.entity.spec.ts` passes all 4 suites / 41 tests, using existing mocked unit fixtures without a database. ts-jest emits the existing JavaScript/allowJs configuration warning for built shared types; it does not fail the run.
- `git diff --check` passes.

**Review:** `dev` uses the same generation ordering as `build`, within the API package working directory. `&&` prevents Nest startup if generation fails. The added startup cost is one client generation per launch; schema changes during a running watcher require regeneration/restart. No source queries/types were weakened, and no migration/schema/dependency changes were made.

The developer's existing dev session must be restarted to pick up the changed command/client. No database migration or live runtime/provider acceptance was performed, and no Git index/history writes were made.

**Completion:** acceptance criteria are met locally. Final review finds the change limited to the development command and linked instructions/evidence; generation repairs all 47 compilation errors without editing application queries. Suggested human-managed commit: `fix(api): generate Prisma client before dev startup`.
