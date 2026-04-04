-- Add missing fields to Property table
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "salePrice" DECIMAL;

-- Add missing fields to Unit table  
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "unitType" VARCHAR(100);
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "sizeSqFt" DECIMAL;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "securityDeposit" DECIMAL;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "utilitiesIncluded" TEXT[];

-- Migrate existing data from Property documents JSON to new salePrice field
UPDATE "Property" 
SET "salePrice" = CAST(documents->>'salePrice' AS DECIMAL)
WHERE documents IS NOT NULL 
  AND documents->>'salePrice' IS NOT NULL 
  AND documents->>'salePrice' != '';

-- Migrate existing amenities data from Property documents JSON to amenities array
UPDATE "Property"
SET "amenities" = ARRAY(
  SELECT jsonb_array_elements_text(documents->'amenities')
)
WHERE documents IS NOT NULL
  AND documents->'amenities' IS NOT NULL
  AND jsonb_typeof(documents->'amenities') = 'array';

-- Set empty array for properties without amenities
UPDATE "Property" 
SET "amenities" = ARRAY[]::TEXT[]
WHERE "amenities" IS NULL;