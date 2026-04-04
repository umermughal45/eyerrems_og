-- DropIndex
DROP INDEX "Account_accountType_idx";

-- DropIndex
DROP INDEX "Account_level_idx";

-- DropIndex
DROP INDEX "Account_normalBalance_idx";

-- DropIndex
DROP INDEX "Account_trustFlag_idx";

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "listingPriceSnapshot" DOUBLE PRECISION,
ADD COLUMN     "varianceAmount" DOUBLE PRECISION,
ADD COLUMN     "varianceType" TEXT;
