-- CreateEnum
CREATE TYPE "AccountRecoveryJobKind" AS ENUM ('RESET_REQUEST', 'PASSWORD_CHANGED');

-- CreateEnum
CREATE TYPE "AccountRecoveryJobStatus" AS ENUM ('PENDING', 'ACCEPTED', 'TEST_ACCEPTED', 'SKIPPED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "password_reset_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "email_hmac" VARCHAR(64) NOT NULL,
    "authorization_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_reset_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_recovery_jobs" (
    "id" UUID NOT NULL,
    "kind" "AccountRecoveryJobKind" NOT NULL,
    "status" "AccountRecoveryJobStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" UUID,
    "credential_id" UUID,
    "authorization_version" INTEGER,
    "locale" VARCHAR(2) NOT NULL,
    "email_hmac" VARCHAR(64) NOT NULL,
    "payload" TEXT,
    "template_version" INTEGER NOT NULL DEFAULT 1,
    "origin_version" VARCHAR(64) NOT NULL,
    "provider_payload_hmac" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),
    "lease_id" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(40),

    CONSTRAINT "account_recovery_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_credentials_token_hash_key" ON "password_reset_credentials"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_credentials_user_id_expires_at_idx" ON "password_reset_credentials"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_recovery_jobs_credential_id_key" ON "account_recovery_jobs"("credential_id");

-- CreateIndex
CREATE INDEX "account_recovery_jobs_status_available_at_lease_until_idx" ON "account_recovery_jobs"("status", "available_at", "lease_until");

-- CreateIndex
CREATE INDEX "account_recovery_jobs_kind_status_created_at_idx" ON "account_recovery_jobs"("kind", "status", "created_at");

-- CreateIndex
CREATE INDEX "account_recovery_jobs_user_id_created_at_idx" ON "account_recovery_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "account_recovery_jobs_email_hmac_kind_status_idx" ON "account_recovery_jobs"("email_hmac", "kind", "status");

-- AddForeignKey
ALTER TABLE "password_reset_credentials" ADD CONSTRAINT "password_reset_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_recovery_jobs" ADD CONSTRAINT "account_recovery_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_recovery_jobs" ADD CONSTRAINT "account_recovery_jobs_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "password_reset_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_reset_credentials"
  ADD CONSTRAINT "reset_credential_hashes" CHECK (token_hash ~ '^[0-9a-f]{64}$' AND email_hmac ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "reset_credential_version" CHECK (authorization_version >= 0),
  ADD CONSTRAINT "reset_credential_lifetime" CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes'),
  ADD CONSTRAINT "reset_credential_terminal" CHECK (
    NOT (consumed_at IS NOT NULL AND invalidated_at IS NOT NULL)
    AND (consumed_at IS NULL OR consumed_at >= created_at)
    AND (invalidated_at IS NULL OR invalidated_at >= created_at)
  );

ALTER TABLE "account_recovery_jobs"
  ADD CONSTRAINT "recovery_job_hashes" CHECK (
    email_hmac ~ '^[0-9a-f]{64}$' AND origin_version ~ '^[0-9a-f]{64}$'
    AND (provider_payload_hmac IS NULL OR provider_payload_hmac ~ '^[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT "recovery_job_locale" CHECK (locale IN ('bn','en')),
  ADD CONSTRAINT "recovery_job_versions" CHECK (template_version >= 1 AND (authorization_version IS NULL OR authorization_version >= 0)),
  ADD CONSTRAINT "recovery_job_attempts" CHECK (attempts BETWEEN 0 AND 5),
  ADD CONSTRAINT "recovery_job_lease" CHECK ((lease_id IS NULL) = (lease_until IS NULL)),
  ADD CONSTRAINT "recovery_job_context" CHECK (
    (kind = 'PASSWORD_CHANGED' AND user_id IS NOT NULL AND credential_id IS NULL AND authorization_version IS NOT NULL)
    OR (kind = 'RESET_REQUEST' AND ((user_id IS NULL AND credential_id IS NULL AND authorization_version IS NULL)
      OR (user_id IS NOT NULL AND credential_id IS NOT NULL AND authorization_version IS NOT NULL)))
  ),
  ADD CONSTRAINT "recovery_job_deadline" CHECK (
    deadline_at > created_at AND (
      (kind = 'PASSWORD_CHANGED' AND deadline_at <= created_at + interval '24 hours')
      OR (kind = 'RESET_REQUEST' AND credential_id IS NULL AND deadline_at <= created_at + interval '10 minutes')
      OR (kind = 'RESET_REQUEST' AND credential_id IS NOT NULL AND deadline_at <= created_at + interval '40 minutes')
    )
  ),
  ADD CONSTRAINT "recovery_job_terminal_erasure" CHECK (
    (status = 'PENDING' AND payload IS NOT NULL AND completed_at IS NULL)
    OR (status <> 'PENDING' AND payload IS NULL AND completed_at IS NOT NULL AND lease_id IS NULL AND lease_until IS NULL)
  ),
  ADD CONSTRAINT "recovery_job_accepted_payload" CHECK (status NOT IN ('ACCEPTED','TEST_ACCEPTED') OR provider_payload_hmac IS NOT NULL),
  ADD CONSTRAINT "recovery_job_failure_code" CHECK (failure_code IS NULL OR failure_code ~ '^[A-Z][A-Z0-9_]{0,39}$');

-- Recovery invariants supplement Prisma's portable model declarations.
-- Applied only after the additive table definitions below.
