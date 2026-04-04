-- ============================================================================
-- MANUAL MIGRATION: Add subsidiaryOptionId to Property table
-- Run this SQL directly on your PostgreSQL database
-- ============================================================================

-- Step 1: Add subsidiaryOptionId column to Property table
-- ============================================================================
DO $$
BEGIN
    -- Add subsidiaryOptionId column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Property' AND column_name = 'subsidiaryOptionId'
    ) THEN
        ALTER TABLE "Property" ADD COLUMN "subsidiaryOptionId" TEXT;
        RAISE NOTICE 'Added subsidiaryOptionId column to Property table';
    ELSE
        RAISE NOTICE 'subsidiaryOptionId column already exists in Property table';
    END IF;
END $$;

-- Step 2: Create index for subsidiaryOptionId
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Property_subsidiaryOptionId_idx" ON "Property"("subsidiaryOptionId");

-- Step 3: Add foreign key constraint
-- ============================================================================
-- Only add foreign key if SubsidiaryOption table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'SubsidiaryOption'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Property_subsidiaryOptionId_fkey'
    ) THEN
        ALTER TABLE "Property" ADD CONSTRAINT "Property_subsidiaryOptionId_fkey" 
        FOREIGN KEY ("subsidiaryOptionId") 
        REFERENCES "SubsidiaryOption"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
        RAISE NOTICE 'Added foreign key constraint Property_subsidiaryOptionId_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint Property_subsidiaryOptionId_fkey already exists or SubsidiaryOption table does not exist';
    END IF;
END $$;

