-- CreateIndex for composite catalog filtering
CREATE INDEX IF NOT EXISTS "products_is_published_type_created_at_idx" ON "products"("is_published", "type", "created_at" DESC);

-- CreateIndex for PostgreSQL full-text search with GIN index
CREATE INDEX IF NOT EXISTS "idx_products_search_gin" ON "products" USING gin(to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", '')));
