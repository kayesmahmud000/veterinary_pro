-- CreateEnum
CREATE TYPE "HealthEscalationLevel" AS ENUM ('LEVEL_1_STAFF_ALERT', 'LEVEL_2_OWNER_ALERT', 'LEVEL_3_EMERGENCY_INTERVENTION');

-- CreateEnum
CREATE TYPE "HealthEscalationAction" AS ENUM ('NOTIFY_VET_HERDSMAN', 'NOTIFY_FARM_OWNER', 'RECOMMEND_QUARANTINE');

-- AlterTable
ALTER TABLE "health_records" ADD COLUMN "escalation_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_escalated_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "health_incident_escalations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "health_record_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "level" "HealthEscalationLevel" NOT NULL,
    "action_taken" "HealthEscalationAction" NOT NULL,
    "recipient_user_id" UUID,
    "recipient_phone" VARCHAR(50),
    "channel" "ReminderChannel" NOT NULL DEFAULT 'SMS',
    "status" "ReminderStatus" NOT NULL DEFAULT 'SENT',
    "notes" TEXT,
    "hours_unresolved" INTEGER NOT NULL,
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_incident_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_health_incident_escalation_level" ON "health_incident_escalations"("health_record_id", "level", "channel");

-- CreateIndex
CREATE INDEX "health_incident_escalations_farm_id_dispatched_at_idx" ON "health_incident_escalations"("farm_id", "dispatched_at");

-- CreateIndex
CREATE INDEX "health_incident_escalations_health_record_id_idx" ON "health_incident_escalations"("health_record_id");

-- CreateIndex
CREATE INDEX "health_records_farm_id_resolved_at_escalation_level_idx" ON "health_records"("farm_id", "resolved_at", "escalation_level");

-- AddForeignKey
ALTER TABLE "health_incident_escalations" ADD CONSTRAINT "health_incident_escalations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incident_escalations" ADD CONSTRAINT "health_incident_escalations_health_record_id_fkey" FOREIGN KEY ("health_record_id") REFERENCES "health_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incident_escalations" ADD CONSTRAINT "health_incident_escalations_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_incident_escalations" ADD CONSTRAINT "health_incident_escalations_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
