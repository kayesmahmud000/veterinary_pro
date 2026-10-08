# First super admin login plan

Spec: [spec.md](spec.md). Scope: owner administrative access in the configured database.

- [x] Inspect guidance, auth/DTO/hasher, active Prisma schema and bootstrap.
- [x] Read-only database inspection: no existing users or administrators.
- [x] Extend offline bootstrap with validated new-account mode; retain promotion mode.
- [x] Persist requested credentials in an ignored local code file.
- [x] Review credential handling, refusal cases, locking and transaction/audit behavior.
- [x] Run focused regression tests and compile the affected backend.
- [x] Create account; verify real login, identity and super admin authorization.
- [x] Re-review final diff, update runbook/context and prepare credential handoff.

## Verification evidence

Database inspection and operator account creation used `apps/api/.env` without
printing connection credentials, hashes or session tokens. Docker was unavailable;
automated tests used mocks and synthetic credentials. Only the owner-requested
account and ordinary login/session/audit records were written to the configured DB.

| Command/check | Observed result |
| --- | --- |
| API Jest: scripts/bootstrap-super-admin, auth service/controller and bcrypt hasher | 5 suites / 71 tests passed |
| API `tsc --project tsconfig.build.json --noEmit` | Passed |
| `pnpm --filter @vetralink/api build` | Sandbox Prisma spawn EPERM; approved retry passed generate + Nest build |
| Final bootstrap Jest after explicit transaction timeout/type review | 18 tests passed |
| Explicit operator execution of `src/scripts/bootstrap-super-admin.ts` with saved local credentials | Created one ACTIVE SUPER_ADMIN; no existing accounts were changed |
| Real configured-DB verification through AuthModule/AdministrationModule with production validation/guards/interceptor/filter | Login/me/SUPER-only list HTTP 200; wrong password and missing auth 401; public SUPER signup 400 |
| Stored-account checks | bcrypt12 password match, LEARNER fallback, role/session version 1, one bootstrap audit and one role outbox event |
| `git check-ignore -v apps/api/src/scripts/super-admin.credentials.local.cjs` | Explicit credential-file rule matched |
| `python -X utf8 .context/scripts/validate.py` | Passed; Windows default codec failed before UTF-8 retry |
| `pnpm --filter @vetralink/web test:auth` | 12 tests passed after local dependency restoration |
| Real web auth source handler with real API/database upstream | Login HTTP 200, SUPER_ADMIN identity, HttpOnly cookies and authenticated session HTTP 200 |

Web acceptance initially could not load the already declared `libphonenumber-js`
dependency. Offline installation could not find all cached tarballs; approved
`CI=true pnpm install --frozen-lockfile` restored the declared dependencies without
manifest/lockfile changes. A fresh Prisma postinstall left a stub at the module
resolution path: compilation and the probe failed. Repeating the approved API build
regenerated the correct API client and compiled successfully. Final real API/web
handler verification then passed in full. API checks used real modules and database,
without provider/guard/repository mocks; no workers or clinical/commerce modules
were started. Probe refresh sessions were revoked during cleanup.

## Completion and limits

The configured database now has the requested ACTIVE SUPER_ADMIN. Credentials are
retained in the ignored local code file described in the runbook and handed directly
to the owner; tracked documentation contains no password. Re-review confirmed both
bootstrap modes retain eligibility/refusal checks, advisory locking and atomic
audit/outbox/version changes, with no public registration or startup seed added.
Temporary operator/probe files were removed; the credential reference remains.

Observed web evidence runs the real auth handler against real API modules; it is not
a rendered browser or deployed Vercel test. No deployment, real notification delivery,
full application runtime, or independent audit is claimed. Human-managed Git remains
untouched. Suggested commit: `feat(auth): support first super admin account creation`.
