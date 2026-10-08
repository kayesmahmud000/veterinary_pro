BEGIN;
-- CreateEnum
CREATE TYPE "ProfessionalRole" AS ENUM ('FARMER', 'VET', 'BUYER');

-- CreateEnum
CREATE TYPE "RoleRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum


-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authorization_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "farmer_onboarding_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previous_non_administrative_role" "UserRole",
ADD COLUMN     "role_version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "role" SET DEFAULT 'LEARNER';

-- CreateTable
CREATE TABLE "farmer_onboardings" (
    "user_id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "submission_key" UUID NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farmer_onboardings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "role_upgrade_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicant_user_id" UUID NOT NULL,
    "target_role" "ProfessionalRole" NOT NULL,
    "status" "RoleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "questionnaire_version" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'bn',
    "request_version" INTEGER NOT NULL DEFAULT 1,
    "submission_key" UUID NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "reviewer_user_id" UUID,
    "public_decision_reason" VARCHAR(500),
    "private_review_note" VARCHAR(1000),
    "qualification_verification_note" VARCHAR(1000),

    CONSTRAINT "role_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_notification_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_key" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "request_id" UUID,
    "target_user_id" UUID,
    "authorization_version" INTEGER,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'bn',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(100),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "role_notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outbox_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "provider_message_id" VARCHAR(255),
    "error_code" VARCHAR(100),

    CONSTRAINT "role_notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_upgrade_requests_status_submitted_at_id_idx" ON "role_upgrade_requests"("status", "submitted_at", "id");

-- CreateIndex
CREATE INDEX "role_upgrade_requests_applicant_user_id_submitted_at_id_idx" ON "role_upgrade_requests"("applicant_user_id", "submitted_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "role_upgrade_requests_applicant_user_id_submission_key_key" ON "role_upgrade_requests"("applicant_user_id", "submission_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_notification_outbox_event_key_key" ON "role_notification_outbox"("event_key");

-- CreateIndex
CREATE INDEX "role_notification_outbox_completed_at_available_at_idx" ON "role_notification_outbox"("completed_at", "available_at");

-- CreateIndex
CREATE INDEX "role_notification_deliveries_status_next_attempt_at_idx" ON "role_notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "role_notification_deliveries_outbox_id_recipient_user_id_key" ON "role_notification_deliveries"("outbox_id", "recipient_user_id");

-- AddForeignKey
ALTER TABLE "farmer_onboardings" ADD CONSTRAINT "farmer_onboardings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_onboardings" ADD CONSTRAINT "farmer_onboardings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_upgrade_requests" ADD CONSTRAINT "role_upgrade_requests_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_upgrade_requests" ADD CONSTRAINT "role_upgrade_requests_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_notification_deliveries" ADD CONSTRAINT "role_notification_deliveries_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "role_notification_outbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_notification_deliveries" ADD CONSTRAINT "role_notification_deliveries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce business invariants even when requests race or a caller bypasses the API.
CREATE UNIQUE INDEX role_upgrade_requests_one_pending_per_applicant ON role_upgrade_requests(applicant_user_id) WHERE status = 'PENDING';
ALTER TABLE users ADD CONSTRAINT users_role_versions_nonnegative CHECK (role_version >= 0 AND authorization_version >= 0);
ALTER TABLE users ADD CONSTRAINT users_non_administrative_fallback CHECK (previous_non_administrative_role IS NULL OR previous_non_administrative_role IN ('LEARNER', 'FARMER', 'VET', 'BUYER'));
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_version_positive CHECK (request_version > 0 AND questionnaire_version > 0);
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_locale CHECK (locale IN ('bn', 'en'));
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_answers_object CHECK (jsonb_typeof(answers) = 'object' AND octet_length(answers::text) <= 32768);
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_decision_state CHECK ((status = 'PENDING' AND decided_at IS NULL AND reviewer_user_id IS NULL) OR (status <> 'PENDING' AND decided_at IS NOT NULL AND reviewer_user_id IS NOT NULL));
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_rejection_reason CHECK (status <> 'REJECTED' OR length(btrim(public_decision_reason)) >= 2);
ALTER TABLE role_upgrade_requests ADD CONSTRAINT role_request_no_self_review CHECK (reviewer_user_id IS NULL OR reviewer_user_id <> applicant_user_id);
ALTER TABLE role_notification_deliveries ADD CONSTRAINT role_delivery_status CHECK (status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED'));
ALTER TABLE role_notification_outbox ADD CONSTRAINT role_outbox_locale CHECK (locale IN ('bn', 'en'));
COMMIT;
