BEGIN;
ALTER TABLE role_upgrade_requests DROP CONSTRAINT role_request_rejection_reason;
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_rejection_reason CHECK (status <> 'REJECTED' OR (public_decision_reason IS NOT NULL AND length(btrim(public_decision_reason)) >= 2));
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_vet_verification CHECK (status <> 'APPROVED' OR target_role <> 'VET' OR (qualification_verification_note IS NOT NULL AND length(btrim(qualification_verification_note)) >= 10));
COMMIT;
