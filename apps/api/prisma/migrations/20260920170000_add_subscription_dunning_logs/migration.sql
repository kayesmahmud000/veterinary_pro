-- CreateEnum
CREATE TYPE "DunningStage" AS ENUM ('DAY_1', 'DAY_3', 'DAY_7');

-- CreateEnum
CREATE TYPE "DunningChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "DunningStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "subscription_dunning_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "farm_id" UUID,
    "stage" "DunningStage" NOT NULL,
    "channel" "DunningChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "DunningStatus" NOT NULL DEFAULT 'SENT',
    "recipient_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "gateway_invoice_id" VARCHAR(255),
    "dispatched_date" VARCHAR(10) NOT NULL,
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_dunning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_subscription_dunning_daily" ON "subscription_dunning_logs"("subscription_id", "stage", "channel", "dispatched_date");

-- CreateIndex
CREATE INDEX "subscription_dunning_logs_subscription_id_stage_idx" ON "subscription_dunning_logs"("subscription_id", "stage");

-- CreateIndex
CREATE INDEX "subscription_dunning_logs_user_id_dispatched_at_idx" ON "subscription_dunning_logs"("user_id", "dispatched_at");

-- CreateIndex
CREATE INDEX "subscription_dunning_logs_farm_id_dispatched_at_idx" ON "subscription_dunning_logs"("farm_id", "dispatched_at");

-- AddForeignKey
ALTER TABLE "subscription_dunning_logs" ADD CONSTRAINT "subscription_dunning_logs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_dunning_logs" ADD CONSTRAINT "subscription_dunning_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_dunning_logs" ADD CONSTRAINT "subscription_dunning_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
