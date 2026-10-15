CREATE TABLE "course_enrollments" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(),
 "user_id" UUID NOT NULL,
 "product_id" UUID NOT NULL,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "course_enrollments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "course_enrollments_user_id_product_id_key" ON "course_enrollments"("user_id", "product_id");
CREATE INDEX "course_enrollments_user_id_id_idx" ON "course_enrollments"("user_id", "id");
