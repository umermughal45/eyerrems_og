/*
  Warnings:

  - A unique constraint covering the columns `[leaseNumber]` on the table `Lease` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "leaseDocumentUrl" TEXT,
ADD COLUMN     "leaseNumber" TEXT,
ADD COLUMN     "noticePeriod" INTEGER,
ADD COLUMN     "renewalDate" TIMESTAMP(3),
ADD COLUMN     "renewalHistory" JSONB,
ADD COLUMN     "rentTerms" JSONB,
ADD COLUMN     "securityDeposit" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "termsAndConditions" TEXT,
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "financeLedgerId" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "city" TEXT,
ADD COLUMN     "documents" JSONB,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "previousTenants" JSONB,
ADD COLUMN     "rentAmount" DOUBLE PRECISION,
ADD COLUMN     "rentEscalationPercentage" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "securityDeposit" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "size" DOUBLE PRECISION,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Vacant';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cnicDocumentUrl" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "profilePhotoUrl" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "maintenanceHistory" JSONB;

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "photos" JSONB,
    "technicianNotes" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "tenantRating" INTEGER,
    "tenantFeedback" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceActivity" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "MaintenanceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeToVacate" (
    "id" TEXT NOT NULL,
    "noticeNumber" TEXT,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT,
    "reason" TEXT NOT NULL,
    "moveOutDate" TIMESTAMP(3) NOT NULL,
    "supportingDocs" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeToVacate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentReminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "reminderType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sendDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantLedger" (
    "id" TEXT NOT NULL,
    "ledgerNumber" TEXT,
    "tenantId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUrl" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "targetTenantIds" JSONB,
    "targetPropertyIds" JSONB,
    "attachments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueSummary" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "month" TEXT NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rentRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSummary" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "month" TEXT NOT NULL,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maintenanceExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilityExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyExpense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "attachments" JSONB,
    "financeLedgerId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT,
    "leaseStart" TIMESTAMP(3) NOT NULL,
    "leaseEnd" TIMESTAMP(3) NOT NULL,
    "monthlyRent" DOUBLE PRECISION NOT NULL,
    "nextInvoiceDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT,
    "unitId" TEXT,
    "issueTitle" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "attachments" JSONB,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "financeLedgerId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLedger" (
    "id" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "description" TEXT,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "dealId" TEXT,
    "payrollId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "propertyId" TEXT,
    "tenantId" TEXT,
    "uploadedBy" TEXT,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTicket_ticketNumber_key" ON "MaintenanceTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_tenantId_idx" ON "MaintenanceTicket"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_unitId_idx" ON "MaintenanceTicket"("unitId");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_status_idx" ON "MaintenanceTicket"("status");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_priority_idx" ON "MaintenanceTicket"("priority");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_assignedTo_idx" ON "MaintenanceTicket"("assignedTo");

-- CreateIndex
CREATE INDEX "MaintenanceTicket_isDeleted_idx" ON "MaintenanceTicket"("isDeleted");

-- CreateIndex
CREATE INDEX "MaintenanceActivity_ticketId_idx" ON "MaintenanceActivity"("ticketId");

-- CreateIndex
CREATE INDEX "MaintenanceActivity_performedAt_idx" ON "MaintenanceActivity"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeToVacate_noticeNumber_key" ON "NoticeToVacate"("noticeNumber");

-- CreateIndex
CREATE INDEX "NoticeToVacate_tenantId_idx" ON "NoticeToVacate"("tenantId");

-- CreateIndex
CREATE INDEX "NoticeToVacate_unitId_idx" ON "NoticeToVacate"("unitId");

-- CreateIndex
CREATE INDEX "NoticeToVacate_status_idx" ON "NoticeToVacate"("status");

-- CreateIndex
CREATE INDEX "NoticeToVacate_moveOutDate_idx" ON "NoticeToVacate"("moveOutDate");

-- CreateIndex
CREATE INDEX "NoticeToVacate_isDeleted_idx" ON "NoticeToVacate"("isDeleted");

-- CreateIndex
CREATE INDEX "RentReminder_tenantId_idx" ON "RentReminder"("tenantId");

-- CreateIndex
CREATE INDEX "RentReminder_invoiceId_idx" ON "RentReminder"("invoiceId");

-- CreateIndex
CREATE INDEX "RentReminder_sendDate_idx" ON "RentReminder"("sendDate");

-- CreateIndex
CREATE INDEX "RentReminder_isSent_idx" ON "RentReminder"("isSent");

-- CreateIndex
CREATE UNIQUE INDEX "TenantLedger_ledgerNumber_key" ON "TenantLedger"("ledgerNumber");

-- CreateIndex
CREATE INDEX "TenantLedger_tenantId_idx" ON "TenantLedger"("tenantId");

-- CreateIndex
CREATE INDEX "TenantLedger_entryDate_idx" ON "TenantLedger"("entryDate");

-- CreateIndex
CREATE INDEX "TenantLedger_entryType_idx" ON "TenantLedger"("entryType");

-- CreateIndex
CREATE INDEX "TenantLedger_referenceId_idx" ON "TenantLedger"("referenceId");

-- CreateIndex
CREATE INDEX "TenantLedger_isDeleted_idx" ON "TenantLedger"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_idx" ON "Receipt"("tenantId");

-- CreateIndex
CREATE INDEX "Receipt_paymentId_idx" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");

-- CreateIndex
CREATE INDEX "Receipt_receiptDate_idx" ON "Receipt"("receiptDate");

-- CreateIndex
CREATE INDEX "Receipt_isDeleted_idx" ON "Receipt"("isDeleted");

-- CreateIndex
CREATE INDEX "Announcement_type_idx" ON "Announcement"("type");

-- CreateIndex
CREATE INDEX "Announcement_priority_idx" ON "Announcement"("priority");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_isDeleted_idx" ON "Announcement"("isDeleted");

-- CreateIndex
CREATE INDEX "RevenueSummary_propertyId_idx" ON "RevenueSummary"("propertyId");

-- CreateIndex
CREATE INDEX "RevenueSummary_month_idx" ON "RevenueSummary"("month");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueSummary_propertyId_month_key" ON "RevenueSummary"("propertyId", "month");

-- CreateIndex
CREATE INDEX "ExpenseSummary_propertyId_idx" ON "ExpenseSummary"("propertyId");

-- CreateIndex
CREATE INDEX "ExpenseSummary_month_idx" ON "ExpenseSummary"("month");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSummary_propertyId_month_key" ON "ExpenseSummary"("propertyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyExpense_financeLedgerId_key" ON "PropertyExpense"("financeLedgerId");

-- CreateIndex
CREATE INDEX "PropertyExpense_propertyId_idx" ON "PropertyExpense"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyExpense_category_idx" ON "PropertyExpense"("category");

-- CreateIndex
CREATE INDEX "PropertyExpense_date_idx" ON "PropertyExpense"("date");

-- CreateIndex
CREATE INDEX "PropertyExpense_isDeleted_idx" ON "PropertyExpense"("isDeleted");

-- CreateIndex
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_tenantId_idx" ON "Tenancy"("tenantId");

-- CreateIndex
CREATE INDEX "Tenancy_status_idx" ON "Tenancy"("status");

-- CreateIndex
CREATE INDEX "Tenancy_leaseEnd_idx" ON "Tenancy"("leaseEnd");

-- CreateIndex
CREATE INDEX "Tenancy_nextInvoiceDate_idx" ON "Tenancy"("nextInvoiceDate");

-- CreateIndex
CREATE INDEX "Tenancy_isDeleted_idx" ON "Tenancy"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Tenancy_propertyId_tenantId_leaseStart_key" ON "Tenancy"("propertyId", "tenantId", "leaseStart");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_financeLedgerId_key" ON "MaintenanceRequest"("financeLedgerId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_tenantId_idx" ON "MaintenanceRequest"("tenantId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_priority_idx" ON "MaintenanceRequest"("priority");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedTo_idx" ON "MaintenanceRequest"("assignedTo");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_isDeleted_idx" ON "MaintenanceRequest"("isDeleted");

-- CreateIndex
CREATE INDEX "FinanceLedger_referenceType_idx" ON "FinanceLedger"("referenceType");

-- CreateIndex
CREATE INDEX "FinanceLedger_referenceId_idx" ON "FinanceLedger"("referenceId");

-- CreateIndex
CREATE INDEX "FinanceLedger_category_idx" ON "FinanceLedger"("category");

-- CreateIndex
CREATE INDEX "FinanceLedger_date_idx" ON "FinanceLedger"("date");

-- CreateIndex
CREATE INDEX "FinanceLedger_propertyId_idx" ON "FinanceLedger"("propertyId");

-- CreateIndex
CREATE INDEX "FinanceLedger_tenantId_idx" ON "FinanceLedger"("tenantId");

-- CreateIndex
CREATE INDEX "FinanceLedger_dealId_idx" ON "FinanceLedger"("dealId");

-- CreateIndex
CREATE INDEX "FinanceLedger_payrollId_idx" ON "FinanceLedger"("payrollId");

-- CreateIndex
CREATE INDEX "FinanceLedger_invoiceId_idx" ON "FinanceLedger"("invoiceId");

-- CreateIndex
CREATE INDEX "FinanceLedger_paymentId_idx" ON "FinanceLedger"("paymentId");

-- CreateIndex
CREATE INDEX "FinanceLedger_isDeleted_idx" ON "FinanceLedger"("isDeleted");

-- CreateIndex
CREATE INDEX "Attachment_entityType_idx" ON "Attachment"("entityType");

-- CreateIndex
CREATE INDEX "Attachment_entityId_idx" ON "Attachment"("entityId");

-- CreateIndex
CREATE INDEX "Attachment_propertyId_idx" ON "Attachment"("propertyId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_idx" ON "Attachment"("tenantId");

-- CreateIndex
CREATE INDEX "Attachment_isDeleted_idx" ON "Attachment"("isDeleted");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_leaseNumber_key" ON "Lease"("leaseNumber");

-- CreateIndex
CREATE INDEX "Lease_leaseEnd_idx" ON "Lease"("leaseEnd");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Tenant_email_idx" ON "Tenant"("email");

-- CreateIndex
CREATE INDEX "Tenant_isActive_idx" ON "Tenant"("isActive");

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceActivity" ADD CONSTRAINT "MaintenanceActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeToVacate" ADD CONSTRAINT "NoticeToVacate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReminder" ADD CONSTRAINT "RentReminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantLedger" ADD CONSTRAINT "TenantLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueSummary" ADD CONSTRAINT "RevenueSummary_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSummary" ADD CONSTRAINT "ExpenseSummary_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyExpense" ADD CONSTRAINT "PropertyExpense_financeLedgerId_fkey" FOREIGN KEY ("financeLedgerId") REFERENCES "FinanceLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_financeLedgerId_fkey" FOREIGN KEY ("financeLedgerId") REFERENCES "FinanceLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedger" ADD CONSTRAINT "FinanceLedger_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedger" ADD CONSTRAINT "FinanceLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLedger" ADD CONSTRAINT "FinanceLedger_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
