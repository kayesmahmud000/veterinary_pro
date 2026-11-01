-- Keep published YouTube courses free; permit pricing preparation only in drafts.
-- Existing free rows satisfy this stronger publication boundary unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "products" DROP CONSTRAINT "products_youtube_free_video_check";
ALTER TABLE "products" ADD CONSTRAINT "products_youtube_free_video_check" CHECK (
  "content_provider" <> 'YOUTUBE' OR (
    "type" = 'VIDEO_COURSE' AND "content_s3_key" = '' AND
    "price_cents" >= 0 AND
    ("discount_price_cents" IS NULL OR ("discount_price_cents" >= 0 AND "discount_price_cents" < "price_cents")) AND
    (NOT "is_published" OR ("price_cents" = 0 AND "discount_price_cents" IS NULL))
  )
);
COMMIT;
