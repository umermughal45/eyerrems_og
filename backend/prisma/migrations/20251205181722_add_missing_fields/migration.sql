-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "commissionType" TEXT NOT NULL DEFAULT 'percentage';

-- AlterTable
ALTER TABLE "DealReceipt" ADD COLUMN     "referenceNumber" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedDealerId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_assignedDealerId_idx" ON "Lead"("assignedDealerId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedDealerId_fkey" FOREIGN KEY ("assignedDealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
