-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "approvalMetadata" JSONB,
ADD COLUMN     "constructionProjectId" TEXT,
ADD COLUMN     "costCodeId" TEXT,
ADD COLUMN     "referenceDocumentId" TEXT,
ADD COLUMN     "sourceModule" TEXT;

-- CreateTable
CREATE TABLE "ConstructionProject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "propertyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "accountingMode" TEXT NOT NULL DEFAULT 'WIP',
    "costCodeMandatory" BOOLEAN NOT NULL DEFAULT true,
    "budgetEnforcement" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetAmount" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionDailyLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "weather" TEXT,
    "siteActivities" JSONB,
    "laborHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equipmentHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "attachments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionCrew" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "crewLeadId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionLabor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costCodeId" TEXT NOT NULL,
    "crewId" TEXT,
    "employeeId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionLabor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionEquipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "make" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,
    "costingMethod" TEXT NOT NULL DEFAULT 'hourly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionEquipmentUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costCodeId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "days" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionEquipmentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionInventoryItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitPrice" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionWarehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionStockBalance" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructionStockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionGRN" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "projectId" TEXT,
    "supplierName" TEXT,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "attachments" JSONB,
    "postedBy" TEXT,
    "postedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionGRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionGRNItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ConstructionGRNItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "costCodeId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionIssueItem" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ConstructionIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionConsumption" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costCodeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "consumptionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionBudget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costCodeId" TEXT NOT NULL,
    "budgetAmount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "fiscalYear" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "billingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionPostingRule" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "debitAccountCode" TEXT,
    "creditAccountCode" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionPostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionProject_code_key" ON "ConstructionProject"("code");

-- CreateIndex
CREATE INDEX "ConstructionProject_propertyId_idx" ON "ConstructionProject"("propertyId");

-- CreateIndex
CREATE INDEX "ConstructionProject_status_idx" ON "ConstructionProject"("status");

-- CreateIndex
CREATE INDEX "ConstructionProject_code_idx" ON "ConstructionProject"("code");

-- CreateIndex
CREATE INDEX "ConstructionProject_isDeleted_idx" ON "ConstructionProject"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "CostCode_code_key" ON "CostCode"("code");

-- CreateIndex
CREATE INDEX "CostCode_parentId_idx" ON "CostCode"("parentId");

-- CreateIndex
CREATE INDEX "CostCode_level_idx" ON "CostCode"("level");

-- CreateIndex
CREATE INDEX "CostCode_projectId_idx" ON "CostCode"("projectId");

-- CreateIndex
CREATE INDEX "CostCode_isActive_idx" ON "CostCode"("isActive");

-- CreateIndex
CREATE INDEX "ConstructionDailyLog_projectId_idx" ON "ConstructionDailyLog"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionDailyLog_logDate_idx" ON "ConstructionDailyLog"("logDate");

-- CreateIndex
CREATE INDEX "ConstructionDailyLog_status_idx" ON "ConstructionDailyLog"("status");

-- CreateIndex
CREATE INDEX "ConstructionDailyLog_isDeleted_idx" ON "ConstructionDailyLog"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionCrew_code_key" ON "ConstructionCrew"("code");

-- CreateIndex
CREATE INDEX "ConstructionCrew_code_idx" ON "ConstructionCrew"("code");

-- CreateIndex
CREATE INDEX "ConstructionCrew_isActive_idx" ON "ConstructionCrew"("isActive");

-- CreateIndex
CREATE INDEX "ConstructionLabor_projectId_idx" ON "ConstructionLabor"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionLabor_costCodeId_idx" ON "ConstructionLabor"("costCodeId");

-- CreateIndex
CREATE INDEX "ConstructionLabor_workDate_idx" ON "ConstructionLabor"("workDate");

-- CreateIndex
CREATE INDEX "ConstructionLabor_status_idx" ON "ConstructionLabor"("status");

-- CreateIndex
CREATE INDEX "ConstructionLabor_isDeleted_idx" ON "ConstructionLabor"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionEquipment_code_key" ON "ConstructionEquipment"("code");

-- CreateIndex
CREATE INDEX "ConstructionEquipment_code_idx" ON "ConstructionEquipment"("code");

-- CreateIndex
CREATE INDEX "ConstructionEquipment_isActive_idx" ON "ConstructionEquipment"("isActive");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_projectId_idx" ON "ConstructionEquipmentUsage"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_costCodeId_idx" ON "ConstructionEquipmentUsage"("costCodeId");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_equipmentId_idx" ON "ConstructionEquipmentUsage"("equipmentId");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_usageDate_idx" ON "ConstructionEquipmentUsage"("usageDate");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_status_idx" ON "ConstructionEquipmentUsage"("status");

-- CreateIndex
CREATE INDEX "ConstructionEquipmentUsage_isDeleted_idx" ON "ConstructionEquipmentUsage"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionInventoryItem_code_key" ON "ConstructionInventoryItem"("code");

-- CreateIndex
CREATE INDEX "ConstructionInventoryItem_code_idx" ON "ConstructionInventoryItem"("code");

-- CreateIndex
CREATE INDEX "ConstructionInventoryItem_category_idx" ON "ConstructionInventoryItem"("category");

-- CreateIndex
CREATE INDEX "ConstructionInventoryItem_isActive_idx" ON "ConstructionInventoryItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionWarehouse_code_key" ON "ConstructionWarehouse"("code");

-- CreateIndex
CREATE INDEX "ConstructionWarehouse_code_idx" ON "ConstructionWarehouse"("code");

-- CreateIndex
CREATE INDEX "ConstructionWarehouse_isActive_idx" ON "ConstructionWarehouse"("isActive");

-- CreateIndex
CREATE INDEX "ConstructionStockBalance_warehouseId_idx" ON "ConstructionStockBalance"("warehouseId");

-- CreateIndex
CREATE INDEX "ConstructionStockBalance_itemId_idx" ON "ConstructionStockBalance"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionStockBalance_warehouseId_itemId_key" ON "ConstructionStockBalance"("warehouseId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionGRN_grnNumber_key" ON "ConstructionGRN"("grnNumber");

-- CreateIndex
CREATE INDEX "ConstructionGRN_warehouseId_idx" ON "ConstructionGRN"("warehouseId");

-- CreateIndex
CREATE INDEX "ConstructionGRN_projectId_idx" ON "ConstructionGRN"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionGRN_grnNumber_idx" ON "ConstructionGRN"("grnNumber");

-- CreateIndex
CREATE INDEX "ConstructionGRN_status_idx" ON "ConstructionGRN"("status");

-- CreateIndex
CREATE INDEX "ConstructionGRN_isDeleted_idx" ON "ConstructionGRN"("isDeleted");

-- CreateIndex
CREATE INDEX "ConstructionGRNItem_grnId_idx" ON "ConstructionGRNItem"("grnId");

-- CreateIndex
CREATE INDEX "ConstructionGRNItem_itemId_idx" ON "ConstructionGRNItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionIssue_issueNumber_key" ON "ConstructionIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "ConstructionIssue_projectId_idx" ON "ConstructionIssue"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionIssue_warehouseId_idx" ON "ConstructionIssue"("warehouseId");

-- CreateIndex
CREATE INDEX "ConstructionIssue_costCodeId_idx" ON "ConstructionIssue"("costCodeId");

-- CreateIndex
CREATE INDEX "ConstructionIssue_issueNumber_idx" ON "ConstructionIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "ConstructionIssue_status_idx" ON "ConstructionIssue"("status");

-- CreateIndex
CREATE INDEX "ConstructionIssue_isDeleted_idx" ON "ConstructionIssue"("isDeleted");

-- CreateIndex
CREATE INDEX "ConstructionIssueItem_issueId_idx" ON "ConstructionIssueItem"("issueId");

-- CreateIndex
CREATE INDEX "ConstructionIssueItem_itemId_idx" ON "ConstructionIssueItem"("itemId");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_projectId_idx" ON "ConstructionConsumption"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_costCodeId_idx" ON "ConstructionConsumption"("costCodeId");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_itemId_idx" ON "ConstructionConsumption"("itemId");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_consumptionDate_idx" ON "ConstructionConsumption"("consumptionDate");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_status_idx" ON "ConstructionConsumption"("status");

-- CreateIndex
CREATE INDEX "ConstructionConsumption_isDeleted_idx" ON "ConstructionConsumption"("isDeleted");

-- CreateIndex
CREATE INDEX "ConstructionBudget_projectId_idx" ON "ConstructionBudget"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionBudget_costCodeId_idx" ON "ConstructionBudget"("costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionBudget_projectId_costCodeId_fiscalYear_key" ON "ConstructionBudget"("projectId", "costCodeId", "fiscalYear");

-- CreateIndex
CREATE INDEX "ConstructionMilestone_projectId_idx" ON "ConstructionMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionMilestone_status_idx" ON "ConstructionMilestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionPostingRule_eventType_key" ON "ConstructionPostingRule"("eventType");

-- CreateIndex
CREATE INDEX "ConstructionPostingRule_eventType_idx" ON "ConstructionPostingRule"("eventType");

-- CreateIndex
CREATE INDEX "ConstructionPostingRule_isActive_idx" ON "ConstructionPostingRule"("isActive");

-- CreateIndex
CREATE INDEX "JournalLine_constructionProjectId_idx" ON "JournalLine"("constructionProjectId");

-- CreateIndex
CREATE INDEX "JournalLine_costCodeId_idx" ON "JournalLine"("costCodeId");

-- CreateIndex
CREATE INDEX "JournalLine_sourceModule_idx" ON "JournalLine"("sourceModule");

-- CreateIndex
CREATE INDEX "JournalLine_referenceDocumentId_idx" ON "JournalLine"("referenceDocumentId");

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "ConstructionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionDailyLog" ADD CONSTRAINT "ConstructionDailyLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionLabor" ADD CONSTRAINT "ConstructionLabor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionLabor" ADD CONSTRAINT "ConstructionLabor_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionLabor" ADD CONSTRAINT "ConstructionLabor_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "ConstructionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionEquipmentUsage" ADD CONSTRAINT "ConstructionEquipmentUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionEquipmentUsage" ADD CONSTRAINT "ConstructionEquipmentUsage_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionEquipmentUsage" ADD CONSTRAINT "ConstructionEquipmentUsage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "ConstructionEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionStockBalance" ADD CONSTRAINT "ConstructionStockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ConstructionWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionStockBalance" ADD CONSTRAINT "ConstructionStockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConstructionInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionGRN" ADD CONSTRAINT "ConstructionGRN_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ConstructionWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionGRN" ADD CONSTRAINT "ConstructionGRN_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionGRNItem" ADD CONSTRAINT "ConstructionGRNItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "ConstructionGRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionGRNItem" ADD CONSTRAINT "ConstructionGRNItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConstructionInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionIssue" ADD CONSTRAINT "ConstructionIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionIssue" ADD CONSTRAINT "ConstructionIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "ConstructionWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionIssue" ADD CONSTRAINT "ConstructionIssue_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionIssueItem" ADD CONSTRAINT "ConstructionIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "ConstructionIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionIssueItem" ADD CONSTRAINT "ConstructionIssueItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConstructionInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionConsumption" ADD CONSTRAINT "ConstructionConsumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionConsumption" ADD CONSTRAINT "ConstructionConsumption_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionConsumption" ADD CONSTRAINT "ConstructionConsumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConstructionInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionBudget" ADD CONSTRAINT "ConstructionBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionBudget" ADD CONSTRAINT "ConstructionBudget_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionMilestone" ADD CONSTRAINT "ConstructionMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
