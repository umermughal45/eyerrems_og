-- AlterTable: Add status fields to PaymentPlan
DO $$ 
BEGIN
  -- Only proceed if PaymentPlan table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentPlan') THEN
    -- Add totalExpected column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaymentPlan' AND column_name = 'totalExpected') THEN
      ALTER TABLE "PaymentPlan" ADD COLUMN "totalExpected" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    -- Add totalPaid column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaymentPlan' AND column_name = 'totalPaid') THEN
      ALTER TABLE "PaymentPlan" ADD COLUMN "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    -- Add remaining column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaymentPlan' AND column_name = 'remaining') THEN
      ALTER TABLE "PaymentPlan" ADD COLUMN "remaining" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaymentPlan' AND column_name = 'status') THEN
      ALTER TABLE "PaymentPlan" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Pending';
    END IF;
  END IF;
END $$;

-- CreateIndex: Add index on status field (with table existence check)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentPlan') THEN
    CREATE INDEX IF NOT EXISTS "PaymentPlan_status_idx" ON "PaymentPlan"("status");
  END IF;
END $$;

-- Update existing PaymentPlan records to calculate totals from installments
DO $$
DECLARE
  plan_record RECORD;
  calculated_total_expected DOUBLE PRECISION;
  calculated_total_paid DOUBLE PRECISION;
  calculated_remaining DOUBLE PRECISION;
  calculated_status TEXT;
BEGIN
  -- Only proceed if PaymentPlan table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PaymentPlan') THEN
    FOR plan_record IN SELECT id FROM "PaymentPlan" LOOP
    -- Calculate totals from installments
    SELECT 
      COALESCE(SUM(amount), 0),
      COALESCE(SUM("paidAmount"), 0)
    INTO 
      calculated_total_expected,
      calculated_total_paid
    FROM "DealInstallment"
    WHERE "paymentPlanId" = plan_record.id AND "isDeleted" = false;

    calculated_remaining := calculated_total_expected - calculated_total_paid;

    -- Determine status
    IF calculated_total_paid = 0 THEN
      calculated_status := 'Pending';
    ELSIF calculated_remaining <= 0.01 THEN
      calculated_status := 'Fully Paid';
    ELSE
      calculated_status := 'Partially Paid';
    END IF;

    -- Update PaymentPlan
    UPDATE "PaymentPlan"
    SET 
      "totalExpected" = calculated_total_expected,
      "totalPaid" = calculated_total_paid,
      "remaining" = calculated_remaining,
      "status" = calculated_status
    WHERE id = plan_record.id;
    END LOOP;
  END IF;
END $$;

