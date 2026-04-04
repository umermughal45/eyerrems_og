-- AlterTable: Add locationId and subsidiaryOptionId to Deal
-- Only execute if Deal table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'Deal'
    ) THEN
        -- Add columns
        ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
        ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "subsidiaryOptionId" TEXT;

        -- Create indexes
        CREATE INDEX IF NOT EXISTS "Deal_locationId_idx" ON "Deal"("locationId");
        CREATE INDEX IF NOT EXISTS "Deal_subsidiaryOptionId_idx" ON "Deal"("subsidiaryOptionId");

        -- AddForeignKey: Deal.locationId -> Location.id (only if Location exists)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = current_schema() 
            AND table_name = 'Location'
        ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'Deal_locationId_fkey'
        ) THEN
            ALTER TABLE "Deal" ADD CONSTRAINT "Deal_locationId_fkey" 
            FOREIGN KEY ("locationId") 
            REFERENCES "Location"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;

        -- AddForeignKey: Deal.subsidiaryOptionId -> SubsidiaryOption.id (only if table exists)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = current_schema() 
            AND table_name = 'SubsidiaryOption'
        ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'Deal_subsidiaryOptionId_fkey'
        ) THEN
            ALTER TABLE "Deal" ADD CONSTRAINT "Deal_subsidiaryOptionId_fkey" 
            FOREIGN KEY ("subsidiaryOptionId") 
            REFERENCES "SubsidiaryOption"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
