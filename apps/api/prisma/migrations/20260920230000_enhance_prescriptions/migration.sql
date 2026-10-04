-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'SIGNED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MedicationFormulation" AS ENUM ('INJECTABLE', 'ORAL_SUSPENSION', 'BOLUS_TABLET', 'TOPICAL_SPRAY', 'INTRAMAMMARY', 'POWDER', 'EYE_DROPS', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationRoute" AS ENUM ('INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'ORAL', 'TOPICAL', 'INTRAMAMMARY', 'OTHER');

-- AlterTable
ALTER TABLE "prescriptions"
  ADD COLUMN "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "pdf_s3_key" DROP NOT NULL,
  ALTER COLUMN "digital_signature_hash" DROP NOT NULL,
  ALTER COLUMN "signed_at" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "prescriptions_status_idx" ON "prescriptions"("status");
