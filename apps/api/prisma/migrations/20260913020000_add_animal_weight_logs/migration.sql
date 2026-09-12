-- CreateTable
CREATE TABLE IF NOT EXISTS "animal_weight_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "weight_kg" DECIMAL(6,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "sync_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "animal_weight_logs_farm_id_animal_id_recorded_at_idx" ON "animal_weight_logs"("farm_id", "animal_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "animal_weight_logs_animal_id_recorded_at_idx" ON "animal_weight_logs"("animal_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "animal_weight_logs_farm_id_recorded_at_idx" ON "animal_weight_logs"("farm_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "animal_weight_logs" ADD CONSTRAINT "animal_weight_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal_weight_logs" ADD CONSTRAINT "animal_weight_logs_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "animal_weight_logs" ADD CONSTRAINT "animal_weight_logs_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
