-- AlterTable: Add rfid_number to animals table
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "rfid_number" VARCHAR(50);

-- CreateIndex: Tenant-Scoped Partial Unique Index for Active RFID transponders
CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_farm_animal_rfid" 
ON "animals"("farm_id", "rfid_number") 
WHERE "deleted_at" IS NULL AND "rfid_number" IS NOT NULL;

-- CreateIndex: B-Tree lookup index for farm RFID scanning
CREATE INDEX IF NOT EXISTS "animals_farm_id_rfid_number_idx" 
ON "animals"("farm_id", "rfid_number");
