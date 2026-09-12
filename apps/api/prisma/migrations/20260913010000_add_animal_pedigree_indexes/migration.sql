-- AlterTable: Add composite indexes for sire and dam pedigree traversal per farm
CREATE INDEX IF NOT EXISTS "animals_farm_id_sire_id_idx" ON "animals"("farm_id", "sire_id");
CREATE INDEX IF NOT EXISTS "animals_farm_id_dam_id_idx" ON "animals"("farm_id", "dam_id");
