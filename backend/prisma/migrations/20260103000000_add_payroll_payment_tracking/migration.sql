-- Add payroll payment tracking fields
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "remainingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Update default paymentStatus from 'pending' to 'created'
UPDATE "Payroll" SET "paymentStatus" = 'created' WHERE "paymentStatus" = 'pending';

-- Create PayrollPayment table
CREATE TABLE IF NOT EXISTS "PayrollPayment" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PayrollPayment_payrollId_idx" ON "PayrollPayment"("payrollId");
CREATE INDEX IF NOT EXISTS "PayrollPayment_paymentDate_idx" ON "PayrollPayment"("paymentDate");
CREATE INDEX IF NOT EXISTS "PayrollPayment_createdByUserId_idx" ON "PayrollPayment"("createdByUserId");

-- Add foreign key constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PayrollPayment_payrollId_fkey'
    ) THEN
        ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollId_fkey" 
        FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PayrollPayment_createdByUserId_fkey'
    ) THEN
        ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_createdByUserId_fkey" 
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Initialize paidAmount and remainingBalance for existing payroll records
UPDATE "Payroll" 
SET 
    "paidAmount" = COALESCE((
        SELECT SUM("amount") 
        FROM "PayrollPayment" 
        WHERE "PayrollPayment"."payrollId" = "Payroll"."id"
    ), 0),
    "remainingBalance" = GREATEST(0, "netPay" - COALESCE((
        SELECT SUM("amount") 
        FROM "PayrollPayment" 
        WHERE "PayrollPayment"."payrollId" = "Payroll"."id"
    ), 0))
WHERE "paidAmount" = 0 AND "remainingBalance" = 0;

-- Update paymentStatus based on paidAmount
UPDATE "Payroll"
SET "paymentStatus" = CASE
    WHEN "paidAmount" = 0 THEN 'created'
    WHEN "paidAmount" >= "netPay" THEN 'fully_paid'
    ELSE 'partially_paid'
END
WHERE "paymentStatus" IN ('pending', 'paid');

