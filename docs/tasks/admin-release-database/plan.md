# ADM-9 release database readiness plan

Date: 2026-10-21. Status: in progress. [Scope](spec.md).

- [x] Read database/security/release rules and exact committed migration SQL.
- [x] Confirm clean source baseline `120d1cb`; security follow-up is human-committed.
- [x] Inspect production aliases through authenticated Vercel CLI: API deployment
  `dpl_3uWdthh9xnU1Dy25vNgxorDxnx6S`, web deployment
  `dpl_An2MnLKEe2BNcXag6a41fZVdYW2b`, both READY/production.
- [ ] Verify actual deployed connection binding and current database preflight.
- [ ] Capture restricted encrypted consistent backup; verify restore/data/schema.
- [ ] Rehearse exact migration sequence and applicable persistence/query checks.
- [ ] Recheck/apply verified target migrations and independently verify results.
- [ ] Review final evidence, retain recovery artifacts and update owning context.

The restricted task directory is recorded outside Git in OS temp
`adm9-db-root.txt`. Its ACL has inheritance disabled and grants only the current
Windows user and SYSTEM. Secret values, backup rows and raw hosting metadata are
never emitted or committed. The previous migration rehearsals used synthetic data;
they do not replace this target-specific backup and restore.

The SQL adds editorial/support/platform tables and `retry_generation` default 0
with a nonnegative check on the existing delivery table. No old migration is edited
and no clinical/financial record backfill is planned. The running generation-aware
worker and current delivery states must still be inspected before rollout.

## Evidence and review

Pending target-binding and backup verification. No production write has occurred.
