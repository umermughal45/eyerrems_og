-- Manual script to add isLeaf and isActive columns
-- Run this if migration was marked as applied but columns don't exist

-- Add columns to Location table if they don't exist
DO $$
BEGIN
    -- Check and add isLeaf column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = current_schema() 
        AND table_name = 'Location' 
        AND column_name = 'isLeaf'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "isLeaf" BOOLEAN NOT NULL DEFAULT true;
        CREATE INDEX IF NOT EXISTS "Location_isLeaf_idx" ON "Location"("isLeaf");
        RAISE NOTICE 'Added isLeaf column to Location table';
    ELSE
        RAISE NOTICE 'isLeaf column already exists';
    END IF;

    -- Check and add isActive column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = current_schema() 
        AND table_name = 'Location' 
        AND column_name = 'isActive'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
        CREATE INDEX IF NOT EXISTS "Location_isActive_idx" ON "Location"("isActive");
        RAISE NOTICE 'Added isActive column to Location table';
    ELSE
        RAISE NOTICE 'isActive column already exists';
    END IF;

    -- Update existing locations: set isLeaf based on whether they have children
    UPDATE "Location" 
    SET "isLeaf" = NOT EXISTS (
      SELECT 1 FROM "Location" AS child 
      WHERE child."parentId" = "Location"."id" AND child."isActive" = true
    );

    -- Ensure all existing locations are active
    UPDATE "Location" SET "isActive" = true WHERE "isActive" IS NULL;
END $$;

-- Add isActive to PropertySubsidiary if it doesn't exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'PropertySubsidiary'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = current_schema() 
            AND table_name = 'PropertySubsidiary' 
            AND column_name = 'isActive'
        ) THEN
            ALTER TABLE "PropertySubsidiary" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
            CREATE INDEX IF NOT EXISTS "PropertySubsidiary_isActive_idx" ON "PropertySubsidiary"("isActive");
            UPDATE "PropertySubsidiary" SET "isActive" = true WHERE "isActive" IS NULL;
            RAISE NOTICE 'Added isActive column to PropertySubsidiary table';
        ELSE
            RAISE NOTICE 'isActive column already exists in PropertySubsidiary';
        END IF;
    END IF;
END $$;

