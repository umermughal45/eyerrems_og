-- AlterTable
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';

-- Update existing roles to ACTIVE if status is null
UPDATE "Role" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

-- Set Admin role to SYSTEM_LOCKED
UPDATE "Role" SET "status" = 'SYSTEM_LOCKED' WHERE "name" = 'Admin';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Role_status_idx" ON "Role"("status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoleLifecycleAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorUsername" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "affectedUsers" JSONB NOT NULL,
    "reassignmentMap" JSONB,
    "reason" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_actorId_idx" ON "RoleLifecycleAuditLog"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_roleId_idx" ON "RoleLifecycleAuditLog"("roleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_createdAt_idx" ON "RoleLifecycleAuditLog"("createdAt");
