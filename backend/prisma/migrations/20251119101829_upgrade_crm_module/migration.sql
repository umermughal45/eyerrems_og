/*
  Warnings:

  - You are about to drop the column `tenant` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `invoice` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `tenant` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Payroll` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `property` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[dealCode]` on the table `Deal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[convertedToClientId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Communication` table without a default value. This is not possible if the table is not empty.
  - Made the column `transactionCode` on table `Transaction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `transactionType` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Invoice_propertyId_idx";

-- DropIndex
DROP INDEX "Payroll_status_idx";

-- DropIndex
DROP INDEX "Transaction_category_idx";

-- DropIndex
DROP INDEX "Transaction_type_idx";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkInLocation" JSONB,
ADD COLUMN     "checkOutLocation" JSONB,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "graceMinutes" INTEGER DEFAULT 0,
ADD COLUMN     "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNightShift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateMinutes" INTEGER DEFAULT 0,
ADD COLUMN     "overrideBy" TEXT,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "overtimeHours" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "suspiciousReason" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assignedAgentId" TEXT,
ADD COLUMN     "assignedDealerId" TEXT,
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "clientCategory" TEXT,
ADD COLUMN     "clientType" TEXT,
ADD COLUMN     "cnicDocumentUrl" TEXT,
ADD COLUMN     "convertedFromLeadId" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "propertyInterest" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "activityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "activityOutcome" TEXT,
ADD COLUMN     "activityType" TEXT NOT NULL DEFAULT 'note',
ADD COLUMN     "assignedAgentId" TEXT,
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "contactPersonId" TEXT,
ADD COLUMN     "contactPersonName" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "dealId" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextFollowUpDate" TIMESTAMP(3),
ADD COLUMN     "recurrence" TEXT,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "reminderDate" TIMESTAMP(3),
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voiceNoteUrl" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "actualClosingDate" TIMESTAMP(3),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "dealCode" TEXT,
ADD COLUMN     "dealType" TEXT,
ADD COLUMN     "expectedClosingDate" TIMESTAMP(3),
ADD COLUMN     "expectedRevenue" DOUBLE PRECISION,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "probability" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "valueBreakdown" JSONB;

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "agreementContractUrl" TEXT,
ADD COLUMN     "assignedRegion" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cnicImageUrl" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "currentPipelineValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "experienceYears" INTEGER DEFAULT 0,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "qualifications" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "settlementHistory" JSONB,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "totalCommissionEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalDealsClosed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedBy" TEXT,
ALTER COLUMN "commissionRate" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "address" TEXT,
ADD COLUMN     "attendanceQRCode" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "basicSalary" DOUBLE PRECISION,
ADD COLUMN     "benefitsEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cnicDocumentUrl" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "departmentCode" TEXT,
ADD COLUMN     "education" JSONB,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "employeeType" TEXT NOT NULL DEFAULT 'full-time',
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "insuranceEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "probationEndDate" TIMESTAMP(3),
ADD COLUMN     "probationPeriod" INTEGER,
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "reportingManagerId" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "shiftTimings" TEXT,
ADD COLUMN     "workLocation" TEXT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "tenant",
ALTER COLUMN "billingDate" DROP DEFAULT,
ALTER COLUMN "totalAmount" DROP DEFAULT,
ALTER COLUMN "remainingAmount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JournalLine" RENAME CONSTRAINT "JournalLine_new_pkey" TO "JournalLine_pkey";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "attachments" JSONB,
ADD COLUMN     "budgetMax" DOUBLE PRECISION,
ADD COLUMN     "budgetMin" DOUBLE PRECISION,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "communicationPreference" TEXT,
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedToClientId" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "expectedCloseDate" TIMESTAMP(3),
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "interestType" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "leadSourceDetails" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "score" INTEGER DEFAULT 0,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "temperature" TEXT DEFAULT 'cold',
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "approvalLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "approvalReason" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "halfDayType" TEXT,
ADD COLUMN     "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaveBalance" DOUBLE PRECISION,
ADD COLUMN     "payrollDeduction" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "proofDocumentUrl" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ALTER COLUMN "days" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "invoice",
DROP COLUMN "tenant";

-- AlterTable
ALTER TABLE "Payroll" DROP COLUMN "status",
ADD COLUMN     "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "basicSalary" DOUBLE PRECISION,
ADD COLUMN     "epfAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "etfAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "financeLinked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "grossSalary" DOUBLE PRECISION,
ADD COLUMN     "insuranceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "overtimeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "payslipUrl" TEXT,
ADD COLUMN     "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "category",
DROP COLUMN "property",
DROP COLUMN "type",
ALTER COLUMN "transactionCode" SET NOT NULL,
ALTER COLUMN "transactionType" SET NOT NULL,
ALTER COLUMN "totalAmount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TransactionCategory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Voucher" ALTER COLUMN "date" DROP DEFAULT,
ALTER COLUMN "amount" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "originalCheckIn" TIMESTAMP(3),
    "originalCheckOut" TIMESTAMP(3),
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAllowance" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousSalary" DOUBLE PRECISION NOT NULL,
    "newSalary" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carryForward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL,
    "accrualRate" DOUBLE PRECISION,
    "maxCarryForward" DOUBLE PRECISION,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPerson" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "department" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerReview" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAgent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT,
    "commissionShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "probability" INTEGER,

    CONSTRAINT "StageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "dealId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "activityDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT,
    "assignedTo" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CRMActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_code_idx" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_attendanceId_idx" ON "AttendanceCorrection"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_employeeId_idx" ON "AttendanceCorrection"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");

-- CreateIndex
CREATE INDEX "PayrollAllowance_payrollId_idx" ON "PayrollAllowance"("payrollId");

-- CreateIndex
CREATE INDEX "PayrollAllowance_employeeId_idx" ON "PayrollAllowance"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollDeduction_payrollId_idx" ON "PayrollDeduction"("payrollId");

-- CreateIndex
CREATE INDEX "PayrollDeduction_employeeId_idx" ON "PayrollDeduction"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryHistory_employeeId_idx" ON "SalaryHistory"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryHistory_effectiveDate_idx" ON "SalaryHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_leaveType_idx" ON "LeaveBalance"("leaveType");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE INDEX "LeaveBalance_isDeleted_idx" ON "LeaveBalance"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveType_year_key" ON "LeaveBalance"("employeeId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE INDEX "PublicHoliday_isActive_idx" ON "PublicHoliday"("isActive");

-- CreateIndex
CREATE INDEX "ContactPerson_clientId_idx" ON "ContactPerson"("clientId");

-- CreateIndex
CREATE INDEX "DealerReview_dealerId_idx" ON "DealerReview"("dealerId");

-- CreateIndex
CREATE INDEX "DealAgent_dealId_idx" ON "DealAgent"("dealId");

-- CreateIndex
CREATE INDEX "DealAgent_agentId_idx" ON "DealAgent"("agentId");

-- CreateIndex
CREATE INDEX "StageHistory_dealId_idx" ON "StageHistory"("dealId");

-- CreateIndex
CREATE INDEX "StageHistory_changedAt_idx" ON "StageHistory"("changedAt");

-- CreateIndex
CREATE INDEX "CRMActivity_leadId_idx" ON "CRMActivity"("leadId");

-- CreateIndex
CREATE INDEX "CRMActivity_clientId_idx" ON "CRMActivity"("clientId");

-- CreateIndex
CREATE INDEX "CRMActivity_dealId_idx" ON "CRMActivity"("dealId");

-- CreateIndex
CREATE INDEX "CRMActivity_assignedTo_idx" ON "CRMActivity"("assignedTo");

-- CreateIndex
CREATE INDEX "CRMActivity_activityDate_idx" ON "CRMActivity"("activityDate");

-- CreateIndex
CREATE INDEX "CRMActivity_status_idx" ON "CRMActivity"("status");

-- CreateIndex
CREATE INDEX "Attendance_isSuspicious_idx" ON "Attendance"("isSuspicious");

-- CreateIndex
CREATE INDEX "Client_assignedDealerId_idx" ON "Client"("assignedDealerId");

-- CreateIndex
CREATE INDEX "Client_assignedAgentId_idx" ON "Client"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_clientCategory_idx" ON "Client"("clientCategory");

-- CreateIndex
CREATE INDEX "Client_isDeleted_idx" ON "Client"("isDeleted");

-- CreateIndex
CREATE INDEX "Communication_dealId_idx" ON "Communication"("dealId");

-- CreateIndex
CREATE INDEX "Communication_assignedAgentId_idx" ON "Communication"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Communication_activityDate_idx" ON "Communication"("activityDate");

-- CreateIndex
CREATE INDEX "Communication_nextFollowUpDate_idx" ON "Communication"("nextFollowUpDate");

-- CreateIndex
CREATE INDEX "Communication_isDeleted_idx" ON "Communication"("isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_dealCode_key" ON "Deal"("dealCode");

-- CreateIndex
CREATE INDEX "Deal_dealCode_idx" ON "Deal"("dealCode");

-- CreateIndex
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");

-- CreateIndex
CREATE INDEX "Deal_dealerId_idx" ON "Deal"("dealerId");

-- CreateIndex
CREATE INDEX "Deal_propertyId_idx" ON "Deal"("propertyId");

-- CreateIndex
CREATE INDEX "Deal_stage_idx" ON "Deal"("stage");

-- CreateIndex
CREATE INDEX "Deal_expectedClosingDate_idx" ON "Deal"("expectedClosingDate");

-- CreateIndex
CREATE INDEX "Deal_isDeleted_idx" ON "Deal"("isDeleted");

-- CreateIndex
CREATE INDEX "Dealer_isActive_idx" ON "Dealer"("isActive");

-- CreateIndex
CREATE INDEX "Dealer_isDeleted_idx" ON "Dealer"("isDeleted");

-- CreateIndex
CREATE INDEX "Employee_departmentCode_idx" ON "Employee"("departmentCode");

-- CreateIndex
CREATE INDEX "Employee_employeeType_idx" ON "Employee"("employeeType");

-- CreateIndex
CREATE INDEX "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_billingDate_idx" ON "Invoice"("billingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedToClientId_key" ON "Lead"("convertedToClientId");

-- CreateIndex
CREATE INDEX "Lead_assignedToUserId_idx" ON "Lead"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_priority_idx" ON "Lead"("priority");

-- CreateIndex
CREATE INDEX "Lead_temperature_idx" ON "Lead"("temperature");

-- CreateIndex
CREATE INDEX "Lead_followUpDate_idx" ON "Lead"("followUpDate");

-- CreateIndex
CREATE INDEX "Lead_isDeleted_idx" ON "Lead"("isDeleted");

-- CreateIndex
CREATE INDEX "LeaveRequest_type_idx" ON "LeaveRequest"("type");

-- CreateIndex
CREATE INDEX "Payroll_paymentStatus_idx" ON "Payroll"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentCode_fkey" FOREIGN KEY ("departmentCode") REFERENCES "Department"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAllowance" ADD CONSTRAINT "PayrollAllowance_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAllowance" ADD CONSTRAINT "PayrollAllowance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedToClientId_fkey" FOREIGN KEY ("convertedToClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedDealerId_fkey" FOREIGN KEY ("assignedDealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactPerson" ADD CONSTRAINT "ContactPerson_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerReview" ADD CONSTRAINT "DealerReview_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAgent" ADD CONSTRAINT "DealAgent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageHistory" ADD CONSTRAINT "StageHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMActivity" ADD CONSTRAINT "CRMActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMActivity" ADD CONSTRAINT "CRMActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMActivity" ADD CONSTRAINT "CRMActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
