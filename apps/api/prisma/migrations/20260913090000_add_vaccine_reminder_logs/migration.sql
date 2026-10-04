-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "ReminderMilestone" AS ENUM ('SEVEN_DAYS', 'THREE_DAYS', 'DUE_TODAY', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "vaccine_reminder_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "vaccine_record_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_phone" VARCHAR(50),
    "channel" "ReminderChannel" NOT NULL DEFAULT 'SMS',
    "milestone" "ReminderMilestone" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SENT',
    "message" TEXT NOT NULL,
    "error_message" TEXT,
    "dispatched_date" VARCHAR(10) NOT NULL,
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccine_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_vaccine_reminder_daily" ON "vaccine_reminder_logs"("vaccine_record_id", "milestone", "channel", "dispatched_date");

-- CreateIndex
CREATE INDEX "vaccine_reminder_logs_farm_id_dispatched_at_idx" ON "vaccine_reminder_logs"("farm_id", "dispatched_at");

-- CreateIndex
CREATE INDEX "vaccine_reminder_logs_farm_id_animal_id_idx" ON "vaccine_reminder_logs"("farm_id", "animal_id");

-- CreateIndex
CREATE INDEX "vaccine_reminder_logs_vaccine_record_id_idx" ON "vaccine_reminder_logs"("vaccine_record_id");

-- AddForeignKey
ALTER TABLE "vaccine_reminder_logs" ADD CONSTRAINT "vaccine_reminder_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_reminder_logs" ADD CONSTRAINT "vaccine_reminder_logs_vaccine_record_id_fkey" FOREIGN KEY ("vaccine_record_id") REFERENCES "vaccine_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_reminder_logs" ADD CONSTRAINT "vaccine_reminder_logs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccine_reminder_logs" ADD CONSTRAINT "vaccine_reminder_logs_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
