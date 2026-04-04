-- ============================================================================
-- Chart of Accounts Expansion Migration
-- Adds isPostable and cashFlowCategory fields to Account model
-- ============================================================================

-- Add isPostable field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'isPostable'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "isPostable" BOOLEAN NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS "Account_isPostable_idx" ON "Account"("isPostable");
  END IF;
END $$;

-- Add cashFlowCategory field to Account table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Account' AND column_name = 'cashFlowCategory'
  ) THEN
    ALTER TABLE "Account" ADD COLUMN "cashFlowCategory" TEXT;
    CREATE INDEX IF NOT EXISTS "Account_cashFlowCategory_idx" ON "Account"("cashFlowCategory");
  END IF;
END $$;

-- Update existing parent accounts to be non-postable (summary accounts)
UPDATE "Account" 
SET "isPostable" = false 
WHERE "code" IN ('1000', '1010', '1100', '2000', '3000', '4000', '5000', '5100')
  AND "parentId" IS NULL;

-- Set default cash flow categories for existing accounts
UPDATE "Account" 
SET "cashFlowCategory" = 'Operating'
WHERE "code" IN ('1000', '1010', '1100', '2000', '4000', '5000', '5100');

UPDATE "Account" 
SET "cashFlowCategory" = 'Financing'
WHERE "code" = '3000';

