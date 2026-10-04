-- CreateEnum
CREATE TYPE "HealthAttachmentStatus" AS ENUM ('PENDING_UPLOAD', 'CONFIRMED');

-- CreateTable
CREATE TABLE "health_record_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "farm_id" UUID NOT NULL,
    "health_record_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "s3_key" TEXT NOT NULL,
    "status" "HealthAttachmentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "caption" TEXT,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_record_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_record_attachments_farm_id_health_record_id_idx" ON "health_record_attachments"("farm_id", "health_record_id");

-- CreateIndex
CREATE INDEX "health_record_attachments_farm_id_status_idx" ON "health_record_attachments"("farm_id", "status");

-- CreateIndex
CREATE INDEX "health_record_attachments_health_record_id_created_at_idx" ON "health_record_attachments"("health_record_id", "created_at");

-- AddForeignKey
ALTER TABLE "health_record_attachments" ADD CONSTRAINT "health_record_attachments_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_record_attachments" ADD CONSTRAINT "health_record_attachments_health_record_id_fkey" FOREIGN KEY ("health_record_id") REFERENCES "health_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_record_attachments" ADD CONSTRAINT "health_record_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
