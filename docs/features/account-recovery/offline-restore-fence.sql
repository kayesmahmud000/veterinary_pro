-- Maintenance/PITR only: auth/recovery traffic and all workers must stay offline.
-- Run with ON_ERROR_STOP and an explicit session setting:
-- SET vetralink.recovery_restore_confirmed = 'yes';
-- ROTATE THE ACCESS-SIGNING SECRET BEFORE REOPENING TRAFFIC. A restored version
-- increment can collide with access claims issued after the restored snapshot.
BEGIN;
DO $$
BEGIN
  IF current_setting('vetralink.recovery_restore_confirmed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Explicit offline recovery-restore confirmation required';
  END IF;
END;
$$;

SELECT pg_advisory_xact_lock(72100473)::text;
SELECT id FROM users ORDER BY id FOR UPDATE;
SELECT id FROM password_reset_credentials ORDER BY id FOR UPDATE;
SELECT id FROM account_recovery_jobs ORDER BY id FOR UPDATE;

UPDATE password_reset_credentials
SET invalidated_at = GREATEST(clock_timestamp(), created_at)
WHERE consumed_at IS NULL AND invalidated_at IS NULL;

UPDATE account_recovery_jobs
SET payload = NULL, lease_id = NULL, lease_until = NULL,
    status = CASE WHEN status = 'PENDING' THEN 'CANCELLED'::"AccountRecoveryJobStatus" ELSE status END,
    completed_at = COALESCE(completed_at, GREATEST(clock_timestamp(), created_at)),
    failure_code = CASE WHEN status = 'PENDING' THEN 'RESTORE_INVALIDATED' ELSE failure_code END;

UPDATE refresh_tokens SET revoked_at = clock_timestamp() WHERE revoked_at IS NULL;
UPDATE users SET authorization_version = authorization_version + 1, updated_at = clock_timestamp();
COMMIT;

-- Restore may also lose completed password changes and their audits. Reconcile
-- affected accounts under the incident runbook before normal sign-in resumes.
