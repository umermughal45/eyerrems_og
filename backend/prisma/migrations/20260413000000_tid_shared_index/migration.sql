-- Migration: tid_shared_index
-- Remove @unique constraints from Deal.tid and Payment.tid
-- so multiple deals/payments can share the same client TID.
-- Add non-unique indexes for fast TID lookups.

-- Drop unique index on Deal.tid (if it exists)
DROP INDEX IF EXISTS "Deal_tid_key";

-- Drop unique index on Payment.tid (if it exists)
DROP INDEX IF EXISTS "Payment_tid_key";

-- Add non-unique index on Deal.tid (if not already present)
CREATE INDEX IF NOT EXISTS "Deal_tid_idx" ON "Deal"("tid");

-- Add non-unique index on Payment.tid (if not already present)
CREATE INDEX IF NOT EXISTS "Payment_tid_idx" ON "Payment"("tid");
