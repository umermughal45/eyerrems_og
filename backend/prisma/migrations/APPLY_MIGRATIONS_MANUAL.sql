-- ============================================================================
-- MANUAL MIGRATION SCRIPT
-- Run this SQL directly on your PostgreSQL database
-- ============================================================================

-- Step 1: Create PropertySubsidiary and SubsidiaryOption tables
-- ============================================================================

-- CreateTable: PropertySubsidiary
CREATE TABLE IF NOT EXISTS "PropertySubsidiary" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertySubsidiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubsidiaryOption
CREATE TABLE IF NOT EXISTS "SubsidiaryOption" (
    "id" TEXT NOT NULL,
    "propertySubsidiaryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubsidiaryOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: PropertySubsidiary
CREATE UNIQUE INDEX IF NOT EXISTS "PropertySubsidiary_locationId_name_key" ON "PropertySubsidiary"("locationId", "name");
CREATE INDEX IF NOT EXISTS "PropertySubsidiary_locationId_idx" ON "PropertySubsidiary"("locationId");

-- CreateIndex: SubsidiaryOption
CREATE UNIQUE INDEX IF NOT EXISTS "SubsidiaryOption_propertySubsidiaryId_name_key" ON "SubsidiaryOption"("propertySubsidiaryId", "name");
CREATE INDEX IF NOT EXISTS "SubsidiaryOption_propertySubsidiaryId_idx" ON "SubsidiaryOption"("propertySubsidiaryId");
CREATE INDEX IF NOT EXISTS "SubsidiaryOption_sortOrder_idx" ON "SubsidiaryOption"("sortOrder");

-- AddForeignKey: PropertySubsidiary.locationId -> Location.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PropertySubsidiary_locationId_fkey'
    ) THEN
        ALTER TABLE "PropertySubsidiary" ADD CONSTRAINT "PropertySubsidiary_locationId_fkey" 
        FOREIGN KEY ("locationId") 
        REFERENCES "Location"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: SubsidiaryOption.propertySubsidiaryId -> PropertySubsidiary.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'SubsidiaryOption_propertySubsidiaryId_fkey'
    ) THEN
        ALTER TABLE "SubsidiaryOption" ADD CONSTRAINT "SubsidiaryOption_propertySubsidiaryId_fkey" 
        FOREIGN KEY ("propertySubsidiaryId") 
        REFERENCES "PropertySubsidiary"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 2: Add locationId and subsidiaryOptionId to Deal table
-- ============================================================================

-- AlterTable: Add locationId and subsidiaryOptionId to Deal
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "subsidiaryOptionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_locationId_idx" ON "Deal"("locationId");
CREATE INDEX IF NOT EXISTS "Deal_subsidiaryOptionId_idx" ON "Deal"("subsidiaryOptionId");

-- AddForeignKey: Deal.locationId -> Location.id
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
    END IF;
END $$;

-- AddForeignKey: Deal.subsidiaryOptionId -> SubsidiaryOption.id
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
    END IF;
END $$;

-- ============================================================================
-- Verification Queries (Optional - run to verify migration)
-- ============================================================================

-- Check if columns exist in Deal table
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'Deal' 
-- AND column_name IN ('locationId', 'subsidiaryOptionId');

-- Check if tables exist
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name IN ('PropertySubsidiary', 'SubsidiaryOption');

