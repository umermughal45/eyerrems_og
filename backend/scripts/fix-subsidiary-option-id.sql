-- Quick fix: Add subsidiaryOptionId column to Property table
-- Run this if you get: "Database column subsidiaryOptionId not found in table Property"

DO $$ 
BEGIN
  -- Add subsidiaryOptionId column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = current_schema()
      AND table_name = 'Property' 
      AND column_name = 'subsidiaryOptionId'
  ) THEN
    ALTER TABLE "Property" ADD COLUMN "subsidiaryOptionId" TEXT;
    RAISE NOTICE 'Added subsidiaryOptionId column to Property table';
  ELSE
    RAISE NOTICE 'subsidiaryOptionId column already exists in Property table';
  END IF;
END $$;

-- Create index for subsidiaryOptionId if it doesn't exist
CREATE INDEX IF NOT EXISTS "Property_subsidiaryOptionId_idx" ON "Property"("subsidiaryOptionId");

-- Add foreign key constraint for subsidiaryOptionId if SubsidiaryOption table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = current_schema()
      AND table_name = 'SubsidiaryOption'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = current_schema()
        AND table_name = 'Property'
        AND constraint_name = 'Property_subsidiaryOptionId_fkey'
    ) THEN
      ALTER TABLE "Property" ADD CONSTRAINT "Property_subsidiaryOptionId_fkey" 
      FOREIGN KEY ("subsidiaryOptionId") 
      REFERENCES "SubsidiaryOption"("id") 
      ON DELETE SET NULL 
      ON UPDATE CASCADE;
      RAISE NOTICE 'Added foreign key constraint Property_subsidiaryOptionId_fkey';
    ELSE
      RAISE NOTICE 'Foreign key constraint Property_subsidiaryOptionId_fkey already exists';
    END IF;
  ELSE
    RAISE NOTICE 'SubsidiaryOption table does not exist. Skipping foreign key constraint.';
  END IF;
END $$;

