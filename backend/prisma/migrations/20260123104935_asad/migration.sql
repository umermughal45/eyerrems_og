/*
  Warnings:

  - Made the column `status` on table `Role` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "category" TEXT,
ALTER COLUMN "status" SET NOT NULL;

-- CreateTable
CREATE TABLE "LeadImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "readyCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "errorSummary" TEXT,

    CONSTRAINT "LeadImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "cnic" TEXT,
    "leadSource" TEXT,
    "sourceDetails" TEXT,
    "dealerTid" TEXT,
    "dealerEmail" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "duplicateOfLeadId" TEXT,
    "duplicateOfClientId" TEXT,
    "resolvedDealerId" TEXT,
    "assignmentMode" TEXT,
    "createdLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "tab" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "customLimit" INTEGER,
    "filterJson" JSONB NOT NULL,
    "columns" JSONB,
    "dataShape" TEXT,
    "rowCount" INTEGER,
    "error" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "tab" TEXT,
    "name" TEXT NOT NULL,
    "filterJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadImportBatch_createdByUserId_idx" ON "LeadImportBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "LeadImportBatch_status_idx" ON "LeadImportBatch"("status");

-- CreateIndex
CREATE INDEX "LeadImportBatch_createdAt_idx" ON "LeadImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "LeadImportRow_batchId_idx" ON "LeadImportRow"("batchId");

-- CreateIndex
CREATE INDEX "LeadImportRow_status_idx" ON "LeadImportRow"("status");

-- CreateIndex
CREATE INDEX "LeadImportRow_resolvedDealerId_idx" ON "LeadImportRow"("resolvedDealerId");

-- CreateIndex
CREATE INDEX "LeadImportRow_createdLeadId_idx" ON "LeadImportRow"("createdLeadId");

-- CreateIndex
CREATE INDEX "ExportJob_userId_idx" ON "ExportJob"("userId");

-- CreateIndex
CREATE INDEX "ExportJob_module_idx" ON "ExportJob"("module");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

-- CreateIndex
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_module_tab_idx" ON "ExportJob"("module", "tab");

-- CreateIndex
CREATE INDEX "FilterPreset_userId_idx" ON "FilterPreset"("userId");

-- CreateIndex
CREATE INDEX "FilterPreset_module_tab_idx" ON "FilterPreset"("module", "tab");

-- CreateIndex
CREATE UNIQUE INDEX "FilterPreset_userId_module_tab_name_key" ON "FilterPreset"("userId", "module", "tab", "name");

-- CreateIndex
CREATE INDEX "Role_category_idx" ON "Role"("category");

-- AddForeignKey
ALTER TABLE "LeadImportRow" ADD CONSTRAINT "LeadImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LeadImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilterPreset" ADD CONSTRAINT "FilterPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
