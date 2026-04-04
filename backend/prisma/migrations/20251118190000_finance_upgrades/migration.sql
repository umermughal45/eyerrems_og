-- Enable UUID helpers for legacy backfills
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Transaction Categories
CREATE TABLE "TransactionCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "defaultDebitAccountId" TEXT,
  "defaultCreditAccountId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TransactionCategory"
  ADD CONSTRAINT "TransactionCategory_defaultDebitAccountId_fkey"
    FOREIGN KEY ("defaultDebitAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransactionCategory"
  ADD CONSTRAINT "TransactionCategory_defaultCreditAccountId_fkey"
    FOREIGN KEY ("defaultCreditAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TransactionCategory_type_idx" ON "TransactionCategory"("type");
CREATE INDEX "TransactionCategory_isActive_idx" ON "TransactionCategory"("isActive");

-- Voucher table
CREATE TABLE "Voucher" (
  "id" TEXT NOT NULL,
  "voucherNumber" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "expenseCategoryId" TEXT,
  "description" TEXT,
  "referenceNumber" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attachments" JSONB,
  "preparedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "journalEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_expenseCategoryId_fkey"
    FOREIGN KEY ("expenseCategoryId") REFERENCES "TransactionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_preparedByUserId_fkey"
    FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Transactions
ALTER TABLE "Transaction"
  ADD COLUMN "transactionCode" TEXT,
  ADD COLUMN "transactionType" TEXT,
  ADD COLUMN "transactionCategoryId" TEXT,
  ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "debitAccountId" TEXT,
  ADD COLUMN "creditAccountId" TEXT,
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "dealerId" TEXT,
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "journalEntryId" TEXT;

UPDATE "Transaction"
SET
  "transactionType" = LOWER(COALESCE("type", 'income')),
  "totalAmount" = COALESCE("amount", 0),
  "paymentMethod" = COALESCE("paymentMethod", 'cash')
WHERE "transactionType" IS NULL OR "totalAmount" = 0 OR "paymentMethod" IS NULL;

UPDATE "Transaction"
SET "transactionCode" = CONCAT(
  'TX-',
  TO_CHAR(COALESCE("date", CURRENT_TIMESTAMP), 'YYYYMMDD'),
  '-',
  SUBSTR(gen_random_uuid()::TEXT, 1, 4)
)
WHERE "transactionCode" IS NULL;

CREATE UNIQUE INDEX "Transaction_transactionCode_key" ON "Transaction"("transactionCode");
CREATE INDEX "Transaction_transactionType_idx" ON "Transaction"("transactionType");
CREATE INDEX "Transaction_transactionCategoryId_idx" ON "Transaction"("transactionCategoryId");
CREATE INDEX "Transaction_tenantId_idx" ON "Transaction"("tenantId");
CREATE INDEX "Transaction_propertyId_idx" ON "Transaction"("propertyId");

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_transactionCategoryId_fkey"
    FOREIGN KEY ("transactionCategoryId") REFERENCES "TransactionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_debitAccountId_fkey"
    FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_creditAccountId_fkey"
    FOREIGN KEY ("creditAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invoices
ALTER TABLE "Invoice"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "billingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "lateFeeRule" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "tenantAccountId" TEXT,
  ADD COLUMN "incomeAccountId" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "journalEntryId" TEXT;

UPDATE "Invoice"
SET
  "billingDate" = COALESCE("billingDate", COALESCE("dueDate", CURRENT_TIMESTAMP)),
  "totalAmount" = COALESCE("amount", 0),
  "remainingAmount" = COALESCE("amount", 0)
WHERE "totalAmount" = 0;

CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");
CREATE INDEX "Invoice_propertyId_idx" ON "Invoice"("propertyId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_incomeAccountId_fkey"
    FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payments
ALTER TABLE "Payment"
  ADD COLUMN "tenantId" TEXT,
  ADD COLUMN "invoiceId" TEXT,
  ADD COLUMN "bankAccountId" TEXT,
  ADD COLUMN "referenceNumber" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "allocatedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "overpaymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "allocations" JSONB,
  ADD COLUMN "receivableAccountId" TEXT,
  ADD COLUMN "advanceAccountId" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "journalEntryId" TEXT;

CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_receivableAccountId_fkey"
    FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_advanceAccountId_fkey"
    FOREIGN KEY ("advanceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant advance balance
ALTER TABLE "Tenant"
  ADD COLUMN "advanceBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Journal entries
ALTER TABLE "JournalEntry"
  ALTER COLUMN "voucherNo" DROP NOT NULL;

ALTER TABLE "JournalEntry"
  ADD COLUMN "entryNumber" TEXT,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "preparedByUserId" TEXT,
  ADD COLUMN "approvedByUserId" TEXT;

UPDATE "JournalEntry"
SET "entryNumber" = CONCAT(
  'JV-',
  TO_CHAR(COALESCE("date", CURRENT_TIMESTAMP), 'YYYYMMDD'),
  '-',
  SUBSTR(gen_random_uuid()::TEXT, 1, 4)
)
WHERE "entryNumber" IS NULL;

ALTER TABLE "JournalEntry"
  ALTER COLUMN "entryNumber" SET NOT NULL;

CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_preparedByUserId_fkey"
    FOREIGN KEY ("preparedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Journal lines restructuring
CREATE TABLE "JournalLine_new" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "description" TEXT,
  CONSTRAINT "JournalLine_new_pkey" PRIMARY KEY ("id")
);

INSERT INTO "JournalLine_new" ("id", "entryId", "accountId", "debit", "credit", "description")
SELECT
  gen_random_uuid()::TEXT,
  jl."entryId",
  jl."debitAccountId",
  jl."amount",
  0,
  jl."description"
FROM "JournalLine" jl
WHERE jl."debitAccountId" IS NOT NULL;

INSERT INTO "JournalLine_new" ("id", "entryId", "accountId", "debit", "credit", "description")
SELECT
  gen_random_uuid()::TEXT,
  jl."entryId",
  jl."creditAccountId",
  0,
  jl."amount",
  jl."description"
FROM "JournalLine" jl
WHERE jl."creditAccountId" IS NOT NULL;

DROP TABLE "JournalLine";

ALTER TABLE "JournalLine_new"
  RENAME TO "JournalLine";

CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

