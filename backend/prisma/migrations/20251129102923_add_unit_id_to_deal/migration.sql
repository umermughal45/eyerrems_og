/*
  Warnings:

  - You are about to alter the column `priceShare` on the `DealProperty` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `DealerPayment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - Made the column `priceShare` on table `DealProperty` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_parentId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_creditAccountId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT IF EXISTS "LedgerEntry_debitAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_refundOfPaymentId_fkey";

-- Add refundOfPaymentId column to Payment table if it doesn't exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'Payment'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' AND column_name = 'refundOfPaymentId'
  ) THEN
    ALTER TABLE "Payment" ADD COLUMN "refundOfPaymentId" TEXT;
  END IF;
END $$;

-- AlterTable
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Deal' AND column_name = 'unitId'
  ) THEN
    ALTER TABLE "Deal" ADD COLUMN "unitId" TEXT;
  END IF;
END $$;

-- AlterTable (only if DealProperty table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'DealProperty'
  ) THEN
    ALTER TABLE "DealProperty" ALTER COLUMN "priceShare" SET NOT NULL,
    ALTER COLUMN "priceShare" SET DATA TYPE DOUBLE PRECISION,
    ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable (only if DealerPayment table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'DealerPayment'
  ) THEN
    ALTER TABLE "DealerPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
    ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_unitId_idx" ON "Deal"("unitId");

-- CreateIndex (only if DealerPayment table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'DealerPayment'
  ) THEN
    CREATE INDEX IF NOT EXISTS "DealerPayment_ledgerEntryId_idx" ON "DealerPayment"("ledgerEntryId");
  END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Deal_unitId_fkey' AND table_name = 'Deal'
  ) THEN
    ALTER TABLE "Deal" ADD CONSTRAINT "Deal_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (only if Payment table exists and refundOfPaymentId column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'Payment'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Payment' AND column_name = 'refundOfPaymentId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Payment_refundOfPaymentId_fkey' AND table_name = 'Payment'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfPaymentId_fkey" FOREIGN KEY ("refundOfPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (only if Account table exists and parentId column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'Account'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'parentId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Account_parentId_fkey' AND table_name = 'Account'
  ) THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (only if LedgerEntry table exists and debitAccountId column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'LedgerEntry'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'LedgerEntry' AND column_name = 'debitAccountId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'LedgerEntry_debitAccountId_fkey' AND table_name = 'LedgerEntry'
  ) THEN
    ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (only if LedgerEntry table exists and creditAccountId column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'LedgerEntry'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'LedgerEntry' AND column_name = 'creditAccountId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'LedgerEntry_creditAccountId_fkey' AND table_name = 'LedgerEntry'
  ) THEN
    ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- RenameIndex (only if index exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'DealProperty_deal_property_unique'
  ) THEN
    ALTER INDEX "DealProperty_deal_property_unique" RENAME TO "DealProperty_dealId_propertyId_key";
  END IF;
END $$;
