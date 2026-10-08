# dev-backend merge conflict resolution specification

Status: Working-tree content resolved and locally verified; human staging/merge completion pending
Date: 2026-10-08. Current HEAD: main / 693b252. Incoming: dev-backend / 1dce99b.

## Outcome and scope

Resolve the five conflicted working-tree files in the user's already started
merge. Preserve the complete incoming role/onboarding/session/audit backend,
the current Vercel fixes and the prior public-role regression coverage.
Do not restart/abort the merge, stage files, commit or push. Repository Git
policy keeps these operations human-managed; no index writes are authorized.
Real notification worker hosting/mail provider setup remain deferred.

Verification exposed one incoming flaky security test: overwriting a random
ciphertext's first byte with ff occasionally leaves it unchanged. Correct only
that test fixture to guarantee a real byte change; production crypto is unchanged.

## Evidence and decisions

- Observed behavior: Git lists five unmerged files; git diff --check reports
  conflict markers in the Vercel env template and four auth source/test files.
- Confirmed from source: incoming AuthService creates sessions/audits inside
  transactions, locks current users and refresh tokens, and invalidates session
  versions. These newer mechanics must remain intact.
- Keep one shared PUBLIC_REGISTRATION_ROLES import and the incoming role local;
  retain public-role runtime denial before Zod validation and side effects.
- Keep the controller's Learner/default Swagger wording and the existing
  strongly typed negative test fixture. Preserve incoming current-identity mocks.
- Keep prior omitted-role, all-public-role and no-side-effect admin/unknown tests
  alongside incoming locking/version/replay tests and audit mock bindings.
- Combine actual WEB_BASE_URL and bare backend API_BASE_URL with the incoming
  trusted-origin/worker and optional legacy-token deadline comments. Never read
  or change real credentials or copy template defaults into Vercel.

## Acceptance and verification

All working-tree conflict markers are removed from the five files; Git's index
may still show unmerged until the human stages them. Shared/API builds, Prisma
validate, the complete API regression suite and existing Vercel entry tests must
pass against synthetic configuration. The isolated real DB suite is opt-in and
must not use the configured production database. Preserve build cleanup, schema
repair migration/index mappings, role modules, frontend source and deferred mail.
