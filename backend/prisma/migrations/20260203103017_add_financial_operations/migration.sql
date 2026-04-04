-- CreateEnum
CREATE TYPE "FinancialOperationType" AS ENUM ('REFUND', 'TRANSFER', 'MERGE');

-- CreateEnum
CREATE TYPE "FinancialOperationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'POSTED', 'REJECTED');

-- CreateTable
CREATE TABLE "FinancialOperation" (
    "id" TEXT NOT NULL,
    "operationType" "FinancialOperationType" NOT NULL,
    "status" "FinancialOperationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "partialAmount" DOUBLE PRECISION,
    "requestedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedByUserId" TEXT,
    "postedAt" TIMESTAMP(3),
    "voucherId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialOperationLine" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialOperationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialOperationReference" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialOperationReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialOperation_operationType_idx" ON "FinancialOperation"("operationType");

-- CreateIndex
CREATE INDEX "FinancialOperation_status_idx" ON "FinancialOperation"("status");

-- CreateIndex
CREATE INDEX "FinancialOperation_dealId_idx" ON "FinancialOperation"("dealId");

-- CreateIndex
CREATE INDEX "FinancialOperation_createdAt_idx" ON "FinancialOperation"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialOperation_requestedByUserId_idx" ON "FinancialOperation"("requestedByUserId");

-- CreateIndex
CREATE INDEX "FinancialOperationLine_operationId_idx" ON "FinancialOperationLine"("operationId");

-- CreateIndex
CREATE INDEX "FinancialOperationLine_entityType_entityId_idx" ON "FinancialOperationLine"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FinancialOperationReference_operationId_idx" ON "FinancialOperationReference"("operationId");

-- CreateIndex
CREATE INDEX "FinancialOperationReference_refType_refId_idx" ON "FinancialOperationReference"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialOperationReference_operationId_refType_refId_role_key" ON "FinancialOperationReference"("operationId", "refType", "refId", "role");

-- AddForeignKey
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperationLine" ADD CONSTRAINT "FinancialOperationLine_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "FinancialOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialOperationReference" ADD CONSTRAINT "FinancialOperationReference_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "FinancialOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
