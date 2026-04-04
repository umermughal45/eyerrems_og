/*
  Warnings:

  - You are about to alter the column `totalPaid` on the `Deal` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - You are about to alter the column `priceShare` on the `DealProperty` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `DealerPayment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - Made the column `totalPaid` on table `Deal` required. This step will fail if there are existing NULL values in that column.
  - Made the column `priceShare` on table `DealProperty` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey (with IF EXISTS check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Account_parentId_fkey') THEN
    ALTER TABLE "Account" DROP CONSTRAINT "Account_parentId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LedgerEntry_creditAccountId_fkey') THEN
    ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_creditAccountId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LedgerEntry_debitAccountId_fkey') THEN
    ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_debitAccountId_fkey";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_refundOfPaymentId_fkey') THEN
    ALTER TABLE "Payment" DROP CONSTRAINT "Payment_refundOfPaymentId_fkey";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Amenity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable (with column existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Deal' AND column_name = 'totalPaid') THEN
    ALTER TABLE "Deal" ALTER COLUMN "totalPaid" SET NOT NULL,
    ALTER COLUMN "totalPaid" SET DATA TYPE DOUBLE PRECISION;
  ELSE
    -- Column doesn't exist, create it
    ALTER TABLE "Deal" ADD COLUMN "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

-- AlterTable (with column existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DealProperty' AND column_name = 'priceShare') THEN
    ALTER TABLE "DealProperty" ALTER COLUMN "priceShare" SET NOT NULL,
    ALTER COLUMN "priceShare" SET DATA TYPE DOUBLE PRECISION,
    ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable (with table existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DealerPayment') THEN
    ALTER TABLE "DealerPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
    ALTER COLUMN "updatedAt" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "DropdownCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DropdownOption" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "installmentId" TEXT;

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "numberOfInstallments" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealInstallment" (
    "id" TEXT NOT NULL,
    "paymentPlanId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "notes" TEXT,
    "ledgerEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerLedger" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "dealId" TEXT,
    "clientId" TEXT,
    "entryType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "ledgerEntryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlan_dealId_key" ON "PaymentPlan"("dealId");

-- CreateIndex
CREATE INDEX "PaymentPlan_dealId_idx" ON "PaymentPlan"("dealId");

-- CreateIndex
CREATE INDEX "PaymentPlan_clientId_idx" ON "PaymentPlan"("clientId");

-- CreateIndex
CREATE INDEX "PaymentPlan_isActive_idx" ON "PaymentPlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DealInstallment_ledgerEntryId_key" ON "DealInstallment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "DealInstallment_paymentPlanId_idx" ON "DealInstallment"("paymentPlanId");

-- CreateIndex
CREATE INDEX "DealInstallment_dealId_idx" ON "DealInstallment"("dealId");

-- CreateIndex
CREATE INDEX "DealInstallment_clientId_idx" ON "DealInstallment"("clientId");

-- CreateIndex
CREATE INDEX "DealInstallment_status_idx" ON "DealInstallment"("status");

-- CreateIndex
CREATE INDEX "DealInstallment_dueDate_idx" ON "DealInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "DealInstallment_isDeleted_idx" ON "DealInstallment"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "DealerLedger_ledgerEntryId_key" ON "DealerLedger"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "DealerLedger_dealerId_idx" ON "DealerLedger"("dealerId");

-- CreateIndex
CREATE INDEX "DealerLedger_dealId_idx" ON "DealerLedger"("dealId");

-- CreateIndex
CREATE INDEX "DealerLedger_clientId_idx" ON "DealerLedger"("clientId");

-- CreateIndex
CREATE INDEX "DealerLedger_entryType_idx" ON "DealerLedger"("entryType");

-- CreateIndex
CREATE INDEX "DealerLedger_date_idx" ON "DealerLedger"("date");

-- CreateIndex
CREATE INDEX "DealerLedger_referenceId_idx" ON "DealerLedger"("referenceId");

-- CreateIndex
CREATE INDEX "Deal_clientId_status_idx" ON "Deal"("clientId", "status");

-- CreateIndex
CREATE INDEX "Deal_propertyId_status_idx" ON "Deal"("propertyId", "status");

-- CreateIndex (with table existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DealerPayment') THEN
    CREATE INDEX IF NOT EXISTS "DealerPayment_ledgerEntryId_idx" ON "DealerPayment"("ledgerEntryId");
  END IF;
END $$;

-- AddForeignKey (with IF NOT EXISTS check for both column and constraint)
DO $$ 
BEGIN
  -- Check if column exists before adding foreign key
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'refundOfPaymentId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_refundOfPaymentId_fkey') THEN
      ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfPaymentId_fkey" FOREIGN KEY ("refundOfPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- AddForeignKey (with column existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'installmentId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Payment_installmentId_fkey') THEN
      ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "DealInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- AddForeignKey (with IF NOT EXISTS check for both column and constraint)
DO $$ 
BEGIN
  -- Check if column exists before adding foreign key
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account' AND column_name = 'parentId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Account_parentId_fkey') THEN
      ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- AddForeignKey (with IF NOT EXISTS check for both column and constraint)
DO $$ 
BEGIN
  -- Check if columns exist before adding foreign keys
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LedgerEntry' AND column_name = 'debitAccountId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LedgerEntry_debitAccountId_fkey') THEN
      ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LedgerEntry' AND column_name = 'creditAccountId') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LedgerEntry_creditAccountId_fkey') THEN
      ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInstallment" ADD CONSTRAINT "DealInstallment_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInstallment" ADD CONSTRAINT "DealInstallment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInstallment" ADD CONSTRAINT "DealInstallment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealInstallment" ADD CONSTRAINT "DealInstallment_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerLedger" ADD CONSTRAINT "DealerLedger_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerLedger" ADD CONSTRAINT "DealerLedger_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerLedger" ADD CONSTRAINT "DealerLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerLedger" ADD CONSTRAINT "DealerLedger_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex (with existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DealProperty_deal_property_unique') THEN
    ALTER INDEX "DealProperty_deal_property_unique" RENAME TO "DealProperty_dealId_propertyId_key";
  END IF;
END $$;
