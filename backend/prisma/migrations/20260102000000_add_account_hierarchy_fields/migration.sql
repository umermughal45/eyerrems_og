-- ============================================================================
-- Add Account Hierarchy Fields Migration
-- Adds level, accountType, normalBalance, and trustFlag fields to Account model
-- ============================================================================

-- Add level field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'level'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
    CREATE INDEX IF NOT EXISTS "Account_level_idx" ON "Account"("level");
  END IF;
END $$;

-- Add accountType field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'accountType'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'Posting';
    CREATE INDEX IF NOT EXISTS "Account_accountType_idx" ON "Account"("accountType");
  END IF;
END $$;

-- Add normalBalance field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'normalBalance'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "normalBalance" TEXT NOT NULL DEFAULT 'Debit';
    CREATE INDEX IF NOT EXISTS "Account_normalBalance_idx" ON "Account"("normalBalance");
  END IF;
END $$;

-- Add trustFlag field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'trustFlag'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "trustFlag" BOOLEAN NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS "Account_trustFlag_idx" ON "Account"("trustFlag");
  END IF;
END $$;

-- Set default normalBalance based on account type
UPDATE "Account" 
SET "normalBalance" = 'Debit'
WHERE "type" IN ('Asset', 'Expense')
  AND "normalBalance" = 'Debit'; -- Only update if still default

UPDATE "Account" 
SET "normalBalance" = 'Credit'
WHERE "type" IN ('Liability', 'Equity', 'Revenue')
  AND "normalBalance" = 'Debit'; -- Update from default to correct value

-- Set trustFlag for trust/escrow accounts (based on code patterns)
UPDATE "Account" 
SET "trustFlag" = true
WHERE "code" LIKE '1121%' -- Client Trust Accounts
   OR "code" LIKE '2111%' -- Client Liabilities
   OR "cashFlowCategory" = 'Escrow';

-- Set accountType based on existing isPostable flag
UPDATE "Account" 
SET "accountType" = CASE 
  WHEN "isPostable" = false THEN 'Header'
  WHEN "isPostable" = true AND "parentId" IS NOT NULL THEN 'Posting'
  ELSE 'Control'
END
WHERE "accountType" = 'Posting'; -- Only update defaults

