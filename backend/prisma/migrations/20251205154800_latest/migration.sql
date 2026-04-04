-- Migration: Add manualUniqueId fields to all relevant models
-- This migration adds manualUniqueId fields to Property, Lead, Client, Dealer, Deal, Payment, and DealReceipt models

-- Add manualUniqueId to Property
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Property_manualUniqueId_key" ON "Property"("manualUniqueId");
CREATE INDEX "Property_manualUniqueId_idx" ON "Property"("manualUniqueId");

-- Add manualUniqueId to Lead
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Lead_manualUniqueId_key" ON "Lead"("manualUniqueId");
CREATE INDEX "Lead_manualUniqueId_idx" ON "Lead"("manualUniqueId");

-- Add manualUniqueId to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Client_manualUniqueId_key" ON "Client"("manualUniqueId");
CREATE INDEX "Client_manualUniqueId_idx" ON "Client"("manualUniqueId");

-- Add manualUniqueId to Dealer
ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Dealer_manualUniqueId_key" ON "Dealer"("manualUniqueId");
CREATE INDEX "Dealer_manualUniqueId_idx" ON "Dealer"("manualUniqueId");

-- Add manualUniqueId to Deal
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Deal_manualUniqueId_key" ON "Deal"("manualUniqueId");
CREATE INDEX "Deal_manualUniqueId_idx" ON "Deal"("manualUniqueId");

-- Add manualUniqueId to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "Payment_manualUniqueId_key" ON "Payment"("manualUniqueId");
CREATE INDEX "Payment_manualUniqueId_idx" ON "Payment"("manualUniqueId");
CREATE INDEX "Payment_paymentId_idx" ON "Payment"("paymentId");

-- Add manualUniqueId to DealReceipt
ALTER TABLE "DealReceipt" ADD COLUMN IF NOT EXISTS "manualUniqueId" TEXT;
CREATE UNIQUE INDEX "DealReceipt_manualUniqueId_key" ON "DealReceipt"("manualUniqueId");
CREATE INDEX "DealReceipt_manualUniqueId_idx" ON "DealReceipt"("manualUniqueId");
