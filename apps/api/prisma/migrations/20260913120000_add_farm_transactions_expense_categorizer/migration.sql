-- AlterEnum
ALTER TYPE "TransactionCategory" ADD VALUE 'UTILITY';

-- AlterTable
ALTER TABLE "farm_transactions" ADD COLUMN "animal_id" UUID,
ADD COLUMN "receipt_url" TEXT,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "sync_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "farm_transactions_farm_id_type_transaction_date_idx" ON "farm_transactions"("farm_id", "type", "transaction_date");

-- CreateIndex
CREATE INDEX "farm_transactions_farm_id_type_category_transaction_date_idx" ON "farm_transactions"("farm_id", "type", "category", "transaction_date");

-- CreateIndex
CREATE INDEX "farm_transactions_farm_id_animal_id_idx" ON "farm_transactions"("farm_id", "animal_id");

-- CreateIndex
CREATE INDEX "farm_transactions_farm_id_deleted_at_idx" ON "farm_transactions"("farm_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "farm_transactions" ADD CONSTRAINT "farm_transactions_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
