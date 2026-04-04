-- Add logoPath column to PropertySubsidiary table
ALTER TABLE "PropertySubsidiary" ADD COLUMN IF NOT EXISTS "logoPath" TEXT;

