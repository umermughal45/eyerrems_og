-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "payeeId" TEXT,
ADD COLUMN     "payeeType" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedByUserId" TEXT,
ADD COLUMN     "postingDate" TIMESTAMP(3),
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "reversedVoucherId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "unitId" TEXT;

-- CreateTable
CREATE TABLE "VoucherLine" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "entityAccountBindingId" TEXT,

    CONSTRAINT "VoucherLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherLine_voucherId_idx" ON "VoucherLine"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherLine_accountId_idx" ON "VoucherLine"("accountId");

-- CreateIndex
CREATE INDEX "VoucherLine_propertyId_idx" ON "VoucherLine"("propertyId");

-- CreateIndex
CREATE INDEX "VoucherLine_unitId_idx" ON "VoucherLine"("unitId");

-- CreateIndex
CREATE INDEX "Voucher_propertyId_idx" ON "Voucher"("propertyId");

-- CreateIndex
CREATE INDEX "Voucher_unitId_idx" ON "Voucher"("unitId");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_type_idx" ON "Voucher"("type");

-- CreateIndex
CREATE INDEX "Voucher_date_idx" ON "Voucher"("date");

-- CreateIndex
CREATE INDEX "Voucher_postingDate_idx" ON "Voucher"("postingDate");

-- CreateIndex
CREATE INDEX "Voucher_payeeType_payeeId_idx" ON "Voucher"("payeeType", "payeeId");

-- CreateIndex
CREATE INDEX "Voucher_reversedVoucherId_idx" ON "Voucher"("reversedVoucherId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_reversedVoucherId_fkey" FOREIGN KEY ("reversedVoucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherLine" ADD CONSTRAINT "VoucherLine_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherLine" ADD CONSTRAINT "VoucherLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherLine" ADD CONSTRAINT "VoucherLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherLine" ADD CONSTRAINT "VoucherLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
