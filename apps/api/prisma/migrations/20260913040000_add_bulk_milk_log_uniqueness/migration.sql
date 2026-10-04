-- Create partial unique index on milk_logs for bulk tank entries (where animal_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_farm_bulk_milk_session" 
ON "milk_logs"("farm_id", "logged_date", "session") 
WHERE "animal_id" IS NULL;
