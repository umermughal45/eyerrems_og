-- Add variance tracking fields to Deal table
-- These fields track the difference between deal amount and listing price
-- Only execute if Deal table exists

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = current_schema() 
        AND table_name = 'Deal'
    ) THEN
        -- Add columns
        ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "listingPriceSnapshot" DOUBLE PRECISION;
        ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "varianceAmount" DOUBLE PRECISION;
        ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "varianceType" TEXT;

        -- Add index for variance queries
        CREATE INDEX IF NOT EXISTS "Deal_varianceType_idx" ON "Deal"("varianceType");

        -- Add comments explaining variance fields (PostgreSQL 9.5+)
        COMMENT ON COLUMN "Deal"."listingPriceSnapshot" IS 'Snapshot of property sale price at deal creation time';
        COMMENT ON COLUMN "Deal"."varianceAmount" IS 'Difference: dealAmount - listingPriceSnapshot';
        COMMENT ON COLUMN "Deal"."varianceType" IS 'Type of variance: GAIN (deal > listing), LOSS (deal < listing), DISCOUNT (no listing price), or null (exact match)';
    END IF;
END $$;

