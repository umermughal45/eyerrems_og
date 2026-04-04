-- Add isLeaf and isActive fields to Location table (only if table exists)
DO $$
BEGIN
    -- Add columns to Location table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'Location'
    ) THEN
        ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "isLeaf" BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS "Location_isLeaf_idx" ON "Location"("isLeaf");
        CREATE INDEX IF NOT EXISTS "Location_isActive_idx" ON "Location"("isActive");

        -- Update existing locations: set isLeaf based on whether they have children
        UPDATE "Location" 
        SET "isLeaf" = NOT EXISTS (
          SELECT 1 FROM "Location" AS child 
          WHERE child."parentId" = "Location"."id" AND child."isActive" = true
        );

        -- Ensure all existing locations are active
        UPDATE "Location" SET "isActive" = true WHERE "isActive" IS NULL;
    END IF;

    -- Add isActive field to PropertySubsidiary table if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'PropertySubsidiary'
    ) THEN
        ALTER TABLE "PropertySubsidiary" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
        CREATE INDEX IF NOT EXISTS "PropertySubsidiary_isActive_idx" ON "PropertySubsidiary"("isActive");
        
        -- Ensure all existing subsidiaries are active
        UPDATE "PropertySubsidiary" SET "isActive" = true WHERE "isActive" IS NULL;
    END IF;
END $$;

