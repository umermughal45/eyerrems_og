/*
  Warnings:

  - You are about to alter the column `salePrice` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `DoublePrecision`.
  - You are about to alter the column `sizeSqFt` on the `Unit` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `DoublePrecision`.
  - You are about to alter the column `securityDeposit` on the `Unit` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `DoublePrecision`.

*/
-- DropIndex
DROP INDEX "Deal_manualUniqueId_idx";



-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "subsidiaryOptionId" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isLeaf" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "subsidiaryOptionId" TEXT,
ALTER COLUMN "salePrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "unitType" SET DATA TYPE TEXT,
ALTER COLUMN "sizeSqFt" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "securityDeposit" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Deal_locationId_idx" ON "Deal"("locationId");

-- CreateIndex
CREATE INDEX "Deal_subsidiaryOptionId_idx" ON "Deal"("subsidiaryOptionId");

-- CreateIndex
CREATE INDEX "Location_isLeaf_idx" ON "Location"("isLeaf");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "Property_subsidiaryOptionId_idx" ON "Property"("subsidiaryOptionId");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_subsidiaryOptionId_fkey" FOREIGN KEY ("subsidiaryOptionId") REFERENCES "SubsidiaryOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_subsidiaryOptionId_fkey" FOREIGN KEY ("subsidiaryOptionId") REFERENCES "SubsidiaryOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
