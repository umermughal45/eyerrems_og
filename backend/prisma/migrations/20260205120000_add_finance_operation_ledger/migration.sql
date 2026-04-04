-- Additive migration: New ledger table for Refund/Transfer/Merge operations only
-- Does NOT modify existing tables. Single source of truth for future finance operations.

CREATE TABLE "FinanceOperationLedgerEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "side" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "voucherId" TEXT,
    "paymentId" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceOperationLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceOperationLedgerEntry_entityType_entityId_idx" ON "FinanceOperationLedgerEntry"("entityType", "entityId");
CREATE INDEX "FinanceOperationLedgerEntry_operationId_idx" ON "FinanceOperationLedgerEntry"("operationId");
CREATE INDEX "FinanceOperationLedgerEntry_voucherId_idx" ON "FinanceOperationLedgerEntry"("voucherId");
CREATE INDEX "FinanceOperationLedgerEntry_paymentId_idx" ON "FinanceOperationLedgerEntry"("paymentId");
CREATE INDEX "FinanceOperationLedgerEntry_sourceType_idx" ON "FinanceOperationLedgerEntry"("sourceType");
CREATE INDEX "FinanceOperationLedgerEntry_date_idx" ON "FinanceOperationLedgerEntry"("date");
