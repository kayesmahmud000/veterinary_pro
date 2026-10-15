ALTER TABLE "products" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "admin_media_uploads" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "content_type" VARCHAR(150) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "part_size_bytes" INTEGER NOT NULL DEFAULT 10485760,
  "key" TEXT NOT NULL,
  "upload_id" TEXT,
  "state" VARCHAR(20) NOT NULL DEFAULT 'INITIALIZING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_media_uploads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_media_uploads_size_check" CHECK ("file_size_bytes" > 0 AND "file_size_bytes" <= 10737418240 AND "part_size_bytes" >= 5242880),
  CONSTRAINT "admin_media_uploads_state_check" CHECK ("state" IN ('INITIALIZING','UPLOADING','UPLOADED','FAILED','ABORTED')),
  CONSTRAINT "admin_media_uploads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admin_media_uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_media_uploads_key_key" ON "admin_media_uploads"("key");
CREATE INDEX "admin_media_uploads_product_id_id_idx" ON "admin_media_uploads"("product_id","id");
CREATE INDEX "admin_media_uploads_owner_id_id_idx" ON "admin_media_uploads"("owner_id","id");
