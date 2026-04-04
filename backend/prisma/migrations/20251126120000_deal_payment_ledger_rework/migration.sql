-- Rename legacy payments table to tenant_payments to preserve existing rental flows
ALTER TABLE "Payment" RENAME TO "tenant_payments";

-- Optional: ensure primary key constraint keeps a meaningful name
ALTER INDEX IF EXISTS "Payment_pkey" RENAME TO "tenant_payments_pkey";
ALTER INDEX IF EXISTS "Payment_paymentId_key" RENAME TO "tenant_payments_paymentId_key";

-- Drop old client-to-property foreign key and column
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_propertyId_fkey";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "propertyId";
DROP INDEX IF EXISTS "Client_propertyId_idx";

-- Rename deal value column and add required metadata columns
ALTER TABLE "Deal" RENAME COLUMN "value" TO "deal_amount";
ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "role" TEXT,
  ADD COLUMN IF NOT EXISTS "deal_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
CREATE INDEX IF NOT EXISTS "Deal_status_idx" ON "Deal"("status");
CREATE INDEX IF NOT EXISTS "Deal_deal_date_idx" ON "Deal"("deal_date");

-- Create new payments table dedicated to deal settlements
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentType" TEXT NOT NULL,
  "paymentMode" TEXT NOT NULL,
  "transactionId" TEXT,
  "referenceNumber" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_paymentId_key" UNIQUE ("paymentId"),
  CONSTRAINT "Payment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Payment_dealId_idx" ON "Payment"("dealId");
CREATE INDEX "Payment_paymentMode_idx" ON "Payment"("paymentMode");
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");
CREATE INDEX IF NOT EXISTS "Payment_date_idx" ON "Payment"("date");


-- Create ledger entries table to store double-entry accounting records per deal
CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "paymentId" TEXT,
  "accountDebit" TEXT NOT NULL,
  "accountCredit" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "remarks" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LedgerEntry_dealId_idx" ON "LedgerEntry"("dealId");
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");
CREATE INDEX "LedgerEntry_accountDebit_idx" ON "LedgerEntry"("accountDebit");
CREATE INDEX "LedgerEntry_accountCredit_idx" ON "LedgerEntry"("accountCredit");
CREATE INDEX "LedgerEntry_date_idx" ON "LedgerEntry"("date");

