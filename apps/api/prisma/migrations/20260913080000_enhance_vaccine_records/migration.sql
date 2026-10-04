-- CreateEnum
CREATE TYPE "VaccineRecordType" AS ENUM ('VACCINATION', 'DEWORMING');

-- AlterTable
ALTER TABLE "vaccine_records" ADD COLUMN "record_type" "VaccineRecordType" NOT NULL DEFAULT 'VACCINATION';
ALTER TABLE "vaccine_records" ADD COLUMN "cost" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "vaccine_records" ADD COLUMN "notes" TEXT;
ALTER TABLE "vaccine_records" ADD COLUMN "sync_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "vaccine_records" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vaccine_records_farm_id_record_type_next_due_date_idx" ON "vaccine_records"("farm_id", "record_type", "next_due_date");
CREATE INDEX IF NOT EXISTS "vaccine_records_farm_id_animal_id_record_type_idx" ON "vaccine_records"("farm_id", "animal_id", "record_type");
CREATE INDEX IF NOT EXISTS "vaccine_records_farm_id_administered_at_idx" ON "vaccine_records"("farm_id", "administered_at");
