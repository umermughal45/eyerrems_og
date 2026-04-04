-- Additive migration for deal payment allocations, payment mode metadata, commission upgrade, and installment penalties
-- This migration is STRICTLY additive. No columns or tables are dropped or modified in a breaking way.

-- 1) Extend Payment with mode metadata (nullable, safe)
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "cheque_number" TEXT,
  ADD COLUMN IF NOT EXISTS "clearing_status" TEXT;

CREATE INDEX IF NOT EXISTS "Payment_clearing_status_idx" ON "Payment"("clearing_status");

-- 2) PaymentAllocation table (one payment -> many allocations)
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "allocationType" TEXT NOT NULL,
    "installmentId" TEXT,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "DealInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_installmentId_idx" ON "PaymentAllocation"("installmentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_allocationType_idx" ON "PaymentAllocation"("allocationType");

-- 3) DealInstallment penalty (per-installment penalty amount)
ALTER TABLE "DealInstallment"
  ADD COLUMN IF NOT EXISTS "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 4) Commission upgrade for deal-/property-based brokerage
ALTER TABLE "Commission"
  ADD COLUMN IF NOT EXISTS "dealId" TEXT,
  ADD COLUMN IF NOT EXISTS "propertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "commissionBase" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "grossCommission" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "taxDeduction" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "netCommission" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'EARNED',
  ADD COLUMN IF NOT EXISTS "milestoneInstallmentId" TEXT;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_milestoneInstallId_fkey"
    FOREIGN KEY ("milestoneInstallmentId") REFERENCES "DealInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Commission_dealId_idx" ON "Commission"("dealId");
CREATE INDEX IF NOT EXISTS "Commission_propertyId_idx" ON "Commission"("propertyId");
CREATE INDEX IF NOT EXISTS "Commission_status_idx" ON "Commission"("status");