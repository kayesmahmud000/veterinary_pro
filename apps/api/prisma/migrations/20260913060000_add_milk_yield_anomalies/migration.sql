-- CreateEnum
CREATE TYPE "MilkAnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MilkAnomalyStatus" AS ENUM ('DETECTED', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "milk_yield_anomalies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "logged_date" DATE NOT NULL,
    "current_yield_liters" DECIMAL(8,3) NOT NULL,
    "baseline_yield_liters" DECIMAL(8,3) NOT NULL,
    "drop_percentage" DECIMAL(5,2) NOT NULL,
    "severity" "MilkAnomalySeverity" NOT NULL DEFAULT 'LOW',
    "status" "MilkAnomalyStatus" NOT NULL DEFAULT 'DETECTED',
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "clinical_notes" TEXT,
    "resolution_notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milk_yield_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milk_yield_anomalies_farm_id_animal_id_logged_date_key" ON "milk_yield_anomalies"("farm_id", "animal_id", "logged_date");

-- CreateIndex
CREATE INDEX "milk_yield_anomalies_farm_id_status_logged_date_idx" ON "milk_yield_anomalies"("farm_id", "status", "logged_date");

-- CreateIndex
CREATE INDEX "milk_yield_anomalies_animal_id_logged_date_idx" ON "milk_yield_anomalies"("animal_id", "logged_date");

-- AddForeignKey
ALTER TABLE "milk_yield_anomalies" ADD CONSTRAINT "milk_yield_anomalies_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_yield_anomalies" ADD CONSTRAINT "milk_yield_anomalies_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_yield_anomalies" ADD CONSTRAINT "milk_yield_anomalies_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
