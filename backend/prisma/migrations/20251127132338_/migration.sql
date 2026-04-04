-- DropForeignKey
ALTER TABLE "Location" DROP CONSTRAINT "Location_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_locationId_fkey";

-- AlterTable
ALTER TABLE "LedgerEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Location" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paymentMode" SET DEFAULT 'cash',
ALTER COLUMN "date" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Property_location_idx" ON "Property"("location");

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_advanceAccountId_fkey" TO "tenant_payments_advanceAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_bankAccountId_fkey" TO "tenant_payments_bankAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_createdByUserId_fkey" TO "tenant_payments_createdByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_invoiceId_fkey" TO "tenant_payments_invoiceId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_journalEntryId_fkey" TO "tenant_payments_journalEntryId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_receivableAccountId_fkey" TO "tenant_payments_receivableAccountId_fkey";

-- RenameForeignKey
ALTER TABLE "tenant_payments" RENAME CONSTRAINT "Payment_tenantId_fkey" TO "tenant_payments_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Location_parentId_index" RENAME TO "Location_parentId_idx";

-- RenameIndex
ALTER INDEX "Location_type_index" RENAME TO "Location_type_idx";

-- RenameIndex
ALTER INDEX "Property_locationId_index" RENAME TO "Property_locationId_idx";

-- RenameIndex
ALTER INDEX "Payment_date_idx" RENAME TO "tenant_payments_date_idx";

-- RenameIndex
ALTER INDEX "Payment_status_idx" RENAME TO "tenant_payments_status_idx";

-- RenameIndex
ALTER INDEX "Payment_tenantId_idx" RENAME TO "tenant_payments_tenantId_idx";
