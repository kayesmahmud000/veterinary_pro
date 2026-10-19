CREATE TABLE "platform_settings" (
  "id" UUID NOT NULL PRIMARY KEY,
  "organization_bn" VARCHAR(100) NOT NULL,
  "organization_en" VARCHAR(100) NOT NULL,
  "support_email" VARCHAR(254) NOT NULL,
  "report_timezone" VARCHAR(30) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_settings_singleton" CHECK (id = '00000000-0000-4000-8000-000000000008'::uuid),
  CONSTRAINT "platform_settings_version" CHECK (version > 0),
  CONSTRAINT "platform_settings_timezone" CHECK (report_timezone IN ('UTC','Asia/Dhaka'))
);
CREATE TABLE "platform_diagnostic_runs" (
  "id" UUID NOT NULL PRIMARY KEY,
  "actor_id" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_diagnostic_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
