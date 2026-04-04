-- Additive migration: Ledger Engine - single source of truth for balances
-- Does NOT modify existing tables. No backfill. New operations write here only.

CREATE TABLE "LedgerEngineEntry" (
    "id" TEXT NOT NULL,
    "transactionUuid" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "debitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "narration" TEXT,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEngineEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEngineEntry_entityType_entityId_idx" ON "LedgerEngineEntry"("entityType", "entityId");
CREATE INDEX "LedgerEngineEntry_transactionUuid_idx" ON "LedgerEngineEntry"("transactionUuid");
CREATE INDEX "LedgerEngineEntry_sourceType_idx" ON "LedgerEngineEntry"("sourceType");
CREATE INDEX "LedgerEngineEntry_entryDate_idx" ON "LedgerEngineEntry"("entryDate");
CREATE INDEX "LedgerEngineEntry_status_idx" ON "LedgerEngineEntry"("status");
