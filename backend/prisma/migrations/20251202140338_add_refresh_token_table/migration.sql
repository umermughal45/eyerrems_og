/*
  Warnings:

  - You are about to alter the column `priceShare` on the `DealProperty` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `DealerPayment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `DoublePrecision`.
  - Made the column `priceShare` on table `DealProperty` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_parentId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_creditAccountId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_debitAccountId_fkey";

-- AlterTable
ALTER TABLE "DealInstallment" ADD COLUMN     "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Pending';

-- AlterTable
ALTER TABLE "DealProperty" ALTER COLUMN "priceShare" SET NOT NULL,
ALTER COLUMN "priceShare" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DealerPayment" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentPlan" ADD COLUMN     "downPayment" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "installmentType" TEXT;

-- CreateTable
CREATE TABLE "DealReceipt" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receivedBy" TEXT,
    "pdfUrl" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealReceiptAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amountAllocated" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealReceiptAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsrfToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CsrfToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealReceipt_receiptNo_key" ON "DealReceipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "DealReceipt_journalEntryId_key" ON "DealReceipt"("journalEntryId");

-- CreateIndex
CREATE INDEX "DealReceipt_dealId_idx" ON "DealReceipt"("dealId");

-- CreateIndex
CREATE INDEX "DealReceipt_clientId_idx" ON "DealReceipt"("clientId");

-- CreateIndex
CREATE INDEX "DealReceipt_receiptNo_idx" ON "DealReceipt"("receiptNo");

-- CreateIndex
CREATE INDEX "DealReceipt_date_idx" ON "DealReceipt"("date");

-- CreateIndex
CREATE INDEX "DealReceipt_receivedBy_idx" ON "DealReceipt"("receivedBy");

-- CreateIndex
CREATE INDEX "DealReceiptAllocation_receiptId_idx" ON "DealReceiptAllocation"("receiptId");

-- CreateIndex
CREATE INDEX "DealReceiptAllocation_installmentId_idx" ON "DealReceiptAllocation"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DealReceiptAllocation_receiptId_installmentId_key" ON "DealReceiptAllocation"("receiptId", "installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_deviceId_idx" ON "RefreshToken"("deviceId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CsrfToken_token_key" ON "CsrfToken"("token");

-- CreateIndex
CREATE INDEX "CsrfToken_token_idx" ON "CsrfToken"("token");

-- CreateIndex
CREATE INDEX "CsrfToken_sessionId_idx" ON "CsrfToken"("sessionId");

-- CreateIndex
CREATE INDEX "CsrfToken_deviceId_idx" ON "CsrfToken"("deviceId");

-- CreateIndex
CREATE INDEX "CsrfToken_expiresAt_idx" ON "CsrfToken"("expiresAt");

-- CreateIndex
CREATE INDEX "DealInstallment_type_idx" ON "DealInstallment"("type");

-- CreateIndex
CREATE INDEX "DealerPayment_ledgerEntryId_idx" ON "DealerPayment"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "Payment_refundOfPaymentId_idx" ON "Payment"("refundOfPaymentId");

-- CreateIndex
CREATE INDEX "PaymentPlan_installmentType_idx" ON "PaymentPlan"("installmentType");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceipt" ADD CONSTRAINT "DealReceipt_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceiptAllocation" ADD CONSTRAINT "DealReceiptAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "DealReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealReceiptAllocation" ADD CONSTRAINT "DealReceiptAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "DealInstallment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DealProperty_deal_property_unique" RENAME TO "DealProperty_dealId_propertyId_key";
