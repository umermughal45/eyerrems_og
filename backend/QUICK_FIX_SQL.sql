-- Quick Fix: Add missing locationId and subsidiaryOptionId columns to Deal table
-- Run this directly in Railway database console to fix the P2022 error immediately

-- Add locationId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Deal' AND column_name = 'locationId'
    ) THEN
        ALTER TABLE "Deal" ADD COLUMN "locationId" TEXT;
        RAISE NOTICE 'Added locationId column to Deal table';
    ELSE
        RAISE NOTICE 'locationId column already exists';
    END IF;
END $$;

-- Add subsidiaryOptionId column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Deal' AND column_name = 'subsidiaryOptionId'
    ) THEN
        ALTER TABLE "Deal" ADD COLUMN "subsidiaryOptionId" TEXT;
        RAISE NOTICE 'Added subsidiaryOptionId column to Deal table';
    ELSE
        RAISE NOTICE 'subsidiaryOptionId column already exists';
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "Deal_locationId_idx" ON "Deal"("locationId");
CREATE INDEX IF NOT EXISTS "Deal_subsidiaryOptionId_idx" ON "Deal"("subsidiaryOptionId");

-- Add foreign key constraint for locationId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Deal_locationId_fkey'
    ) THEN
        ALTER TABLE "Deal" ADD CONSTRAINT "Deal_locationId_fkey" 
        FOREIGN KEY ("locationId") 
        REFERENCES "Location"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'Added foreign key constraint Deal_locationId_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint Deal_locationId_fkey already exists';
    END IF;
END $$;

-- Add foreign key constraint for subsidiaryOptionId (if SubsidiaryOption table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'SubsidiaryOption'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Deal_subsidiaryOptionId_fkey'
    ) THEN
        ALTER TABLE "Deal" ADD CONSTRAINT "Deal_subsidiaryOptionId_fkey" 
        FOREIGN KEY ("subsidiaryOptionId") 
        REFERENCES "SubsidiaryOption"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'Added foreign key constraint Deal_subsidiaryOptionId_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists or SubsidiaryOption table does not exist';
    END IF;
END $$;

