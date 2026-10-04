-- CreateTable if not exists
CREATE TABLE IF NOT EXISTS "vet_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "license_number" VARCHAR(100),
    "specialties" JSONB NOT NULL DEFAULT '[]',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "max_active_cases" INTEGER NOT NULL DEFAULT 5,
    "workingHours" JSONB NOT NULL DEFAULT '[]',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vet_profiles_user_id_key" ON "vet_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "vet_profiles_is_available_idx" ON "vet_profiles"("is_available");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vet_profiles_user_id_fkey'
    ) THEN
        ALTER TABLE "vet_profiles" ADD CONSTRAINT "vet_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable in case table already existed without license_number
ALTER TABLE "vet_profiles" ADD COLUMN IF NOT EXISTS "license_number" VARCHAR(100);
