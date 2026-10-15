CREATE TYPE "ProductContentProvider" AS ENUM ('INTERNAL', 'YOUTUBE');
CREATE TYPE "CourseLessonAccess" AS ENUM ('PUBLIC_DEMO', 'ENROLLED');
ALTER TABLE "products" ADD COLUMN "content_provider" "ProductContentProvider" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "products" ADD CONSTRAINT "products_youtube_free_video_check" CHECK (
  "content_provider" <> 'YOUTUBE' OR ("type" = 'VIDEO_COURSE' AND "price_cents" = 0 AND "discount_price_cents" IS NULL AND "content_s3_key" = '')
);
CREATE TABLE "course_lessons" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "summary" TEXT NOT NULL,
  "youtube_video_id" VARCHAR(11) NOT NULL,
  "access" "CourseLessonAccess" NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_lessons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "course_lessons_video_id_check" CHECK ("youtube_video_id" ~ '^[A-Za-z0-9_-]{11}$')
);
CREATE INDEX "course_lessons_product_id_deleted_at_position_idx" ON "course_lessons"("product_id", "deleted_at", "position");
CREATE UNIQUE INDEX "course_lessons_active_position_key" ON "course_lessons"("product_id", "position") WHERE "deleted_at" IS NULL;
