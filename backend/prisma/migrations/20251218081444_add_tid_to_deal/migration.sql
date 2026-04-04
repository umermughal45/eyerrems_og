/*
  Warnings:

  - Note: tid column indexes are deferred to migration 20251230000000_add_tid_columns

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "propertySubsidiary" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "propertySubsidiary" TEXT;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "dealId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_propertySubsidiary_idx" ON "Client"("propertySubsidiary");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Property_propertySubsidiary_idx" ON "Property"("propertySubsidiary");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Voucher_dealId_idx" ON "Voucher"("dealId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
