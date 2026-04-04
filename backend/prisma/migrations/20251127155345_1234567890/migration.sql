-- AlterTable (conditional - only if tables exist)
DO $$ 
BEGIN
  -- Alter Amenity table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Amenity') THEN
    ALTER TABLE "Amenity" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;

  -- Alter DropdownCategory table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DropdownCategory') THEN
    ALTER TABLE "DropdownCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;

  -- Alter DropdownOption table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DropdownOption') THEN
    ALTER TABLE "DropdownOption" ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;
