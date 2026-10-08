# Vercel role build compatibility implementation plan

Spec: [spec.md](spec.md).
Scope: Repair the supplied TypeScript build failure without widening signup roles.
Roles: API, Security, Database, Code Reviewer and QA.

## Constraints and review focus

- Work in the existing clean main checkout; do not stage, commit, merge or push.
- Use synthetic DATABASE_URL for all generation/build/test commands; never run
  live database migrations or send mail during this task.
- Preserve shared contracts and existing Vercel entry/schema repair changes.
- Check that every public role persists and reaches token claims unchanged,
  omitted role becomes LEARNER, and admin/unknown inputs cause no side effects.
- This is a build/registration compatibility repair, not integration of all
  dev-backend workflow modules. Document that distinction at handoff.

## Steps

- [x] Reproduce shared/API Vercel build from 6f20fbd.
- [x] Add RegisterDto validation regression tests and service role/default tests;
  observe runtime failures with temporary test-only ts-jest diagnostics disabled
  because the pre-existing compiler failure otherwise prevents assertions.
- [x] Update RegisterDto with IsIn(PUBLIC_REGISTRATION_ROLES) and the shared role
  property type; use the same allowlist and LEARNER default in AuthService.
- [x] Add LEARNER to API Prisma enum and restore the exact original
  20261007090000_add_learner_role migration from dev-backend; add build tsconfig
  to exclude test files and produce dist/serverless.js. Configure Nest's
  deleteOutDir so cached/nested/spec artifacts cannot survive subsequent builds.
- [x] Review production/test boundaries, schema and diff; run API auth/user and
  related regressions, Prisma validate, production build and wrapper tests.
- [x] Re-review, update evidence and validate documentation/whitespace.

## Evidence

- Baseline shared types build passed. Fresh API build reproduced all nine
  supplied TypeScript errors at 6f20fbd.
- RED: `NODE_ENV=test DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test
  pnpm --filter @vetralink/api test --runInBand
  --testPathPattern='register.dto.spec|auth.service.spec'
  --globals='{"ts-jest":{"diagnostics":false}}'`: 4 failed / 26 passed.
  The failures demonstrated the FARMER default, unknown role accepted by the
  service, and ADMIN/SUPER_ADMIN accepted by DTO validation. Diagnostics disabled
  only on this baseline invocation; normal configuration remains unchanged.
- Sandbox Prisma generation exited without regenerating the client, and HTTP
  tests failed with `listen EPERM`. Repeated the affected commands outside the
  sandbox; generation then confirmed LEARNER in the actual client schema.
- `NODE_ENV=test DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test
  pnpm --filter @vetralink/api test --runInBand
  --testPathPattern='modules/auth|modules/users'` with normal diagnostics:
  10 suites / 122 tests passed, including HTTP validation and default/persistence/
  session-claim/side-effect regressions. Uses mocks and a local test HTTP server.
- Exact Vercel shared/API build command passed with a synthetic DATABASE_URL.
  Initial artifact inspection found cached dist/src specs left by the baseline;
  added Nest deleteOutDir and repeated the build successfully. Flat
  dist/serverless.js exists, stale nested output is absent, and zero compiled
  specs remain. No user source files were deleted.
- `pnpm --filter @vetralink/api exec prisma validate` with synthetic URL passed.
  Python byte comparison confirmed the learner migration matches the original
  dev-backend file exactly; no live migration was run.
- `pnpm --filter @vetralink/api test:vercel` outside the sandbox: all five named
  wrapper tests passed. The sandbox runner's single file-level result was not
  counted as evidence for the five assertions.
- Fresh independent read-only review found no material correctness/security
  issue. Fixed its optional Swagger summary finding to include Learner.

- Final `pnpm --filter @vetralink/api build` after the Swagger wording fix passed
  with the synthetic URL; no further application edits followed.
- `git diff --check` passed; `.context/scripts/validate.py` passed (48 Markdown
  documents, 297 local links, 78 source entries). Final re-review confirmed only
  in-scope edits, no secret/env changes, and no Git mutations or live deployment.

## Handoff

All bounded acceptance criteria are met locally. The changes are uncommitted in
main; the supplied Vercel log deploys dev-fontend. The human must place these
changes on the configured deployment branch before pushing/redeploying.
Suggested commit: `fix(api): align registration roles for Vercel builds`.
Full backend role-request/onboarding integration and live deployment remain
separate from this fix. Mail provider and role worker setup remain deferred.
