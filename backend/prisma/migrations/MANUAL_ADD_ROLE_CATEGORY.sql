-- PART 1: Add role category field to Role model
-- This migration adds the category field for role reassignment enforcement
-- Run this manually: psql -d your_database < MANUAL_ADD_ROLE_CATEGORY.sql

-- Add category column to Role table
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Set categories based on role names
-- Admin role = ADMIN
UPDATE "Role" SET "category" = 'ADMIN' WHERE LOWER("name") = 'admin';

-- Dealer variants = DEALER
UPDATE "Role" SET "category" = 'DEALER' WHERE "category" IS NULL AND LOWER("name") LIKE '%dealer%';

-- Tenant variants = TENANT
UPDATE "Role" SET "category" = 'TENANT' WHERE "category" IS NULL AND LOWER("name") LIKE '%tenant%';

-- SYSTEM_LOCKED roles = SYSTEM
UPDATE "Role" SET "category" = 'SYSTEM' WHERE "category" IS NULL AND "status" = 'SYSTEM_LOCKED';

-- Default to STAFF for all other roles
UPDATE "Role" SET "category" = 'STAFF' WHERE "category" IS NULL;

-- Add index on category for performance
CREATE INDEX IF NOT EXISTS "Role_category_idx" ON "Role"("category");

-- Add constraint to ensure category is one of valid values
ALTER TABLE "Role" ADD CONSTRAINT "Role_category_check" 
    CHECK ("category" IN ('ADMIN', 'DEALER', 'STAFF', 'TENANT', 'SYSTEM'));
