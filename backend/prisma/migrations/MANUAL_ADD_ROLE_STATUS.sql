-- PART 1: Add role status field to Role model
-- This migration adds the status field for role lifecycle management
-- Run this manually: psql -d your_database < MANUAL_ADD_ROLE_STATUS.sql

-- Add status column to Role table
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';

-- Update existing roles to ACTIVE if status is null
UPDATE "Role" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

-- Set Admin role to SYSTEM_LOCKED
UPDATE "Role" SET "status" = 'SYSTEM_LOCKED' WHERE "name" = 'Admin';

-- Add index on status for performance
CREATE INDEX IF NOT EXISTS "Role_status_idx" ON "Role"("status");

-- Create RoleLifecycleAuditLog table
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

-- Create indexes for RoleLifecycleAuditLog
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_actorId_idx" ON "RoleLifecycleAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_roleId_idx" ON "RoleLifecycleAuditLog"("roleId");
CREATE INDEX IF NOT EXISTS "RoleLifecycleAuditLog_createdAt_idx" ON "RoleLifecycleAuditLog"("createdAt");

-- Add constraint to ensure status is one of valid values
ALTER TABLE "Role" ADD CONSTRAINT "Role_status_check" 
    CHECK ("status" IN ('ACTIVE', 'DEACTIVATED', 'SYSTEM_LOCKED'));
