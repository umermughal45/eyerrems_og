/*
  Warnings:

  - A unique constraint covering the columns `[buyerId]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "actualPropertyValue" DOUBLE PRECISION,
ADD COLUMN     "buyerId" TEXT,
ADD COLUMN     "dealerId" TEXT,
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "profit" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SaleInstallment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Unpaid',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleInstallment_saleId_idx" ON "SaleInstallment"("saleId");

-- CreateIndex
CREATE INDEX "SaleInstallment_status_idx" ON "SaleInstallment"("status");

-- CreateIndex
CREATE INDEX "SaleInstallment_dueDate_idx" ON "SaleInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "SaleInstallment_isDeleted_idx" ON "SaleInstallment"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_buyerId_key" ON "Sale"("buyerId");

-- CreateIndex
CREATE INDEX "Sale_dealerId_idx" ON "Sale"("dealerId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleInstallment" ADD CONSTRAINT "SaleInstallment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
