-- CreateEnum
CREATE TYPE "ClinicalNoteCategory" AS ENUM ('SOAP_NOTE', 'DIFFERENTIAL_DIAGNOSIS', 'INTERNAL_OBSERVATION', 'FOLLOW_UP_PLAN', 'GENERAL');

-- CreateTable
CREATE TABLE "consultation_clinical_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "author_vet_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" "ClinicalNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "is_confidential" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_clinical_notes_consultation_id_created_at_idx" ON "consultation_clinical_notes"("consultation_id", "created_at");

-- CreateIndex
CREATE INDEX "consultation_clinical_notes_author_vet_id_idx" ON "consultation_clinical_notes"("author_vet_id");

-- AddForeignKey
ALTER TABLE "consultation_clinical_notes" ADD CONSTRAINT "consultation_clinical_notes_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_clinical_notes" ADD CONSTRAINT "consultation_clinical_notes_author_vet_id_fkey" FOREIGN KEY ("author_vet_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
