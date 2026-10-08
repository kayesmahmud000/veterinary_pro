-- Restore schema declared by the API but missing from earlier migration history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

-- CreateEnum
CREATE TYPE "ConsultationPaymentStatus" AS ENUM ('UNPAID', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsultationNotificationChannel" AS ENUM ('PUSH', 'SMS', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "ConsultationNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'HELD', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED');

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "assigned_at" TIMESTAMPTZ(6),
ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
ADD COLUMN     "payment_captured_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_held_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_intent_id" VARCHAR(255),
ADD COLUMN     "payment_released_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_status" "ConsultationPaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "scheduled_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "consultation_notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "vet_id" UUID NOT NULL,
    "channel" "ConsultationNotificationChannel" NOT NULL,
    "status" "ConsultationNotificationStatus" NOT NULL DEFAULT 'SENT',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_payout_ledgers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "vet_id" UUID NOT NULL,
    "total_fee_cents" INTEGER NOT NULL,
    "platform_fee_rate" DECIMAL(5,4) NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL,
    "vet_payout_cents" INTEGER NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payout_batch_id" VARCHAR(100),
    "payout_reference" VARCHAR(255),
    "processed_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_payout_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "farmer_id" UUID NOT NULL,
    "vet_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "moderation_status" "ReviewModerationStatus" NOT NULL DEFAULT 'APPROVED',
    "moderated_by_id" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "moderation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_notification_logs_vet_id_dispatched_at_idx" ON "consultation_notification_logs"("vet_id", "dispatched_at" DESC);

-- CreateIndex
CREATE INDEX "consultation_notification_logs_consultation_id_idx" ON "consultation_notification_logs"("consultation_id");

-- CreateIndex
CREATE INDEX "consultation_notification_logs_vet_id_read_at_idx" ON "consultation_notification_logs"("vet_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_payout_ledgers_consultation_id_key" ON "consultation_payout_ledgers"("consultation_id");

-- CreateIndex
CREATE INDEX "consultation_payout_ledgers_vet_id_status_idx" ON "consultation_payout_ledgers"("vet_id", "status");

-- CreateIndex
CREATE INDEX "consultation_payout_ledgers_status_created_at_idx" ON "consultation_payout_ledgers"("status", "created_at");

-- CreateIndex
CREATE INDEX "consultation_payout_ledgers_payout_batch_id_idx" ON "consultation_payout_ledgers"("payout_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_reviews_consultation_id_key" ON "consultation_reviews"("consultation_id");

-- CreateIndex
CREATE INDEX "consultation_reviews_vet_id_moderation_status_is_public_idx" ON "consultation_reviews"("vet_id", "moderation_status", "is_public");

-- CreateIndex
CREATE INDEX "consultation_reviews_farmer_id_idx" ON "consultation_reviews"("farmer_id");

-- CreateIndex
CREATE INDEX "consultation_reviews_moderation_status_created_at_idx" ON "consultation_reviews"("moderation_status", "created_at");

-- CreateIndex
CREATE INDEX "animals_farm_id_tag_number_idx" ON "animals"("farm_id", "tag_number");

-- CreateIndex
CREATE INDEX "consultations_vet_id_scheduled_at_idx" ON "consultations"("vet_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "consultations_payment_status_idx" ON "consultations"("payment_status");

-- CreateIndex
CREATE INDEX "consultations_payment_intent_id_idx" ON "consultations"("payment_intent_id");

-- CreateIndex
CREATE INDEX "users_phone_hash_idx" ON "users"("phone_hash");

-- AddForeignKey
ALTER TABLE "consultation_notification_logs" ADD CONSTRAINT "consultation_notification_logs_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_notification_logs" ADD CONSTRAINT "consultation_notification_logs_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_payout_ledgers" ADD CONSTRAINT "consultation_payout_ledgers_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_payout_ledgers" ADD CONSTRAINT "consultation_payout_ledgers_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The historical vet-profile migration checks constraint names across all schemas.
-- Scope this repair to the current table so isolated or previously drifted schemas
-- get their own foreign key without changing the historical migration.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'vet_profiles_user_id_fkey'
          AND conrelid = 'vet_profiles'::regclass
    ) THEN
        ALTER TABLE "vet_profiles" ADD CONSTRAINT "vet_profiles_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
COMMIT;
