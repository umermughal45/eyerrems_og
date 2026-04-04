-- DropIndex
DROP INDEX "Payment_clearing_status_idx";

-- AlterTable
ALTER TABLE "PaymentAllocation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Commission_dealerId_idx" ON "Commission"("dealerId");

-- RenameForeignKey
ALTER TABLE "Commission" RENAME CONSTRAINT "Commission_milestoneInstallId_fkey" TO "Commission_milestoneInstallmentId_fkey";
