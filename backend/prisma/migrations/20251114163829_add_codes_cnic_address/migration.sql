/*
  Warnings:

  - A unique constraint covering the columns `[clientCode]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dealerCode]` on the table `Dealer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[leadCode]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[propertyCode]` on the table `Property` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantCode]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "address" TEXT,
ADD COLUMN     "clientCode" TEXT,
ADD COLUMN     "clientNo" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "srNo" INTEGER;

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "dealerCode" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "cnic" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "leadCode" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "propertyCode" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "tenantCode" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "floorId" TEXT;

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorNumber" INTEGER,
    "propertyId" TEXT NOT NULL,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Floor_propertyId_idx" ON "Floor"("propertyId");

-- CreateIndex
CREATE INDEX "Floor_isDeleted_idx" ON "Floor"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientCode_key" ON "Client"("clientCode");

-- CreateIndex
CREATE INDEX "Client_clientCode_idx" ON "Client"("clientCode");

-- CreateIndex
CREATE INDEX "Client_propertyId_idx" ON "Client"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_dealerCode_key" ON "Dealer"("dealerCode");

-- CreateIndex
CREATE INDEX "Dealer_dealerCode_idx" ON "Dealer"("dealerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadCode_key" ON "Lead"("leadCode");

-- CreateIndex
CREATE INDEX "Lead_leadCode_idx" ON "Lead"("leadCode");

-- CreateIndex
CREATE UNIQUE INDEX "Property_propertyCode_key" ON "Property"("propertyCode");

-- CreateIndex
CREATE INDEX "Property_propertyCode_idx" ON "Property"("propertyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_tenantCode_key" ON "Tenant"("tenantCode");

-- CreateIndex
CREATE INDEX "Tenant_tenantCode_idx" ON "Tenant"("tenantCode");

-- CreateIndex
CREATE INDEX "Unit_floorId_idx" ON "Unit"("floorId");

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
