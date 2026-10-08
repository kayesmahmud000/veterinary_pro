# First super admin login

Status: Verified in the configured database and local API/web handlers. Date: 2026-10-08.

## Outcome and current evidence

The owner requests usable administrative credentials for web/API login and asks
to retain the email/password in a local code file for later use. **Confirmed from
code:** no default administrative seed exists; public signup excludes ADMIN and
SUPER_ADMIN. The [offline bootstrap](../../../apps/api/src/scripts/bootstrap-super-admin.ts)
requires an existing active user. **Observed behavior:** read-only inspection of
the database selected by `apps/api/.env` found zero users and zero administrators.

## Required behavior

Extend the explicit operator-only bootstrap to accept either an existing user UUID
or new email/name/password. Create and promote a new account atomically when no
active SUPER_ADMIN exists. Retain advisory locking, eligibility checks, fallback
role, version increments, session revocation, audit and notification outbox.
Reject mixed modes, weak/oversize passwords, reused emails including deleted accounts,
pending applications, inactive accounts and an existing active SUPER_ADMIN.

No HTTP endpoint, public administrative registration, schema migration or startup
seed is introduced. Hash passwords with the existing 12-round hasher and exclude
credentials from tracked source, audit and logs. Persist owner credentials in an
explicitly ignored local code file and hand them back directly as requested.

## Acceptance

- Tests cover both bootstrap modes and safety refusals without live data access.
- Create one owner account in the configured database after scoped verification.
- Verify email/password login, authenticated identity and a SUPER_ADMIN-only route
  with the real backend. Web uses the same credentials and existing session boundary;
  disclose any deployed runtime limits separately from backend verification.
- Preserve human-managed Git policy; report tests and the credential file location.

Backend/API, Security, Database and Code Reviewer/QA perspectives apply. Atomic
failure leaves no account/role/audit/outbox partial write. Later administrative
changes use the existing protected management workflow.
