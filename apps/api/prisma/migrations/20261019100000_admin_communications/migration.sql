-- Additive ADM-7 schema. No existing row or applied migration is rewritten.
ALTER TABLE "role_notification_deliveries" ADD COLUMN "retry_generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "role_notification_deliveries" ADD CONSTRAINT "role_delivery_generation_nonnegative" CHECK ("retry_generation" >= 0);
CREATE TABLE "editorial_documents" (
  "id" UUID PRIMARY KEY, "kind" VARCHAR(10) NOT NULL, "slug" VARCHAR(120) NOT NULL,
  "subject_user_id" UUID UNIQUE REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "draft" JSONB NOT NULL, "published" JSONB, "published_at" TIMESTAMPTZ(6), "published_subject_version" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "editorial_kind" CHECK ("kind" IN ('BLOG','PAGE','FAQ','GUIDE','VET')),
  CONSTRAINT "editorial_version" CHECK ("version" > 0),
  CONSTRAINT "editorial_subject" CHECK (("kind" = 'VET') = ("subject_user_id" IS NOT NULL)),
  CONSTRAINT "editorial_snapshot" CHECK (("published" IS NULL) = ("published_at" IS NULL)),
  CONSTRAINT "editorial_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE UNIQUE INDEX "editorial_documents_kind_slug_key" ON "editorial_documents"("kind","slug");
CREATE INDEX "editorial_documents_kind_published_at_id_idx" ON "editorial_documents"("kind","published_at","id");
CREATE TABLE "editorial_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "document_id" UUID NOT NULL REFERENCES "editorial_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL CHECK ("version" > 0), "draft" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "editorial_revisions_document_id_version_key" ON "editorial_revisions"("document_id","version");
CREATE TABLE "support_tickets" (
  "id" UUID PRIMARY KEY, "requester_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "assignee_id" UUID REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "subject" VARCHAR(160) NOT NULL, "category" VARCHAR(10) NOT NULL CHECK ("category" IN ('ACCOUNT','FARM','ORDER','OTHER')),
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','CLOSED')),
  "farm_id" UUID, "order_id" UUID, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Optional references are immutable opaque support pointers, validated against ownership on creation;
-- deliberately no delete cascades into support history when a domain record is removed.
CREATE INDEX "support_tickets_requester_id_id_idx" ON "support_tickets"("requester_id","id");
CREATE INDEX "support_tickets_status_id_idx" ON "support_tickets"("status","id");
CREATE TABLE "support_messages" (
  "id" UUID PRIMARY KEY, "ticket_id" UUID NOT NULL REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "internal" BOOLEAN NOT NULL DEFAULT false,
  "body" VARCHAR(4000) NOT NULL CHECK (length(trim("body")) > 0), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "support_messages_ticket_id_created_at_id_idx" ON "support_messages"("ticket_id","created_at","id");
