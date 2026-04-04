-- Create new tables for Reminder & Notifications module (no existing tables modified)

CREATE TABLE IF NOT EXISTS "reminders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "module_name" VARCHAR(50) NOT NULL,
  "record_id" VARCHAR(100) NOT NULL,
  "assigned_to_user" UUID NOT NULL,
  "reminder_date" DATE NOT NULL,
  "reminder_time" TIME NOT NULL,
  "priority" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "channel" VARCHAR(20) NOT NULL,
  "module_name" VARCHAR(50) NOT NULL,
  "template_text" TEXT NOT NULL,
  "variables" JSONB,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "channel" VARCHAR(20) NOT NULL,
  "delivery_status" VARCHAR(20) NOT NULL,
  "retry_count" INT NOT NULL DEFAULT 0,
  "provider_response" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_reminder_module" ON "reminders"("module_name");
CREATE INDEX IF NOT EXISTS "idx_reminder_date" ON "reminders"("reminder_date");
CREATE INDEX IF NOT EXISTS "idx_notification_logs_notification_id" ON "notification_logs"("notification_id");

