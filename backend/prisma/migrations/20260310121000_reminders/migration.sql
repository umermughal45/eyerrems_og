/*
  Warnings:

  - The primary key for the `notification_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `notification_templates` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `reminders` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "notification_id" SET DATA TYPE TEXT,
ALTER COLUMN "channel" SET DATA TYPE TEXT,
ALTER COLUMN "delivery_status" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "notification_templates" DROP CONSTRAINT "notification_templates_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "channel" SET DATA TYPE TEXT,
ALTER COLUMN "module_name" SET DATA TYPE TEXT,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_pkey",
ADD COLUMN     "trigger_time" TIMESTAMP(3),
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "module_name" SET DATA TYPE TEXT,
ALTER COLUMN "record_id" SET DATA TYPE TEXT,
ALTER COLUMN "assigned_to_user" SET DATA TYPE TEXT,
ALTER COLUMN "priority" SET DATA TYPE TEXT,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "created_by" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "reminder_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "delay_minutes" INTEGER NOT NULL,
    "template_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_reminder_id_idx" ON "notifications"("reminder_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "notifications"("recipient_id");

-- CreateIndex
CREATE INDEX "automation_rules_event_name_module_name_idx" ON "automation_rules"("event_name", "module_name");

-- RenameIndex
ALTER INDEX "idx_notification_logs_notification_id" RENAME TO "notification_logs_notification_id_idx";
