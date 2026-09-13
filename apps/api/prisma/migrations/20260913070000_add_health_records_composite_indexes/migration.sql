-- CreateIndex
CREATE INDEX IF NOT EXISTS "health_records_farm_id_animal_id_created_at_idx" ON "health_records"("farm_id", "animal_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "health_records_farm_id_severity_resolved_at_idx" ON "health_records"("farm_id", "severity", "resolved_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "health_records_farm_id_event_type_created_at_idx" ON "health_records"("farm_id", "event_type", "created_at");
