import ExcelJS from 'exceljs';
import prisma from '../prisma/client';

// Define sheet configurations
export interface SheetConfig {
  name: string;
  model: string;
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    type?: 'string' | 'number' | 'date' | 'boolean';
  }>;
  query: () => Promise<any[]>;
}

// Get all sheet configurations
export function getSheetConfigs(): SheetConfig[] {
  return [
    {
      name: 'Properties',
      model: 'Property',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'title', header: 'Title', width: 30 },
        { key: 'type', header: 'Type', width: 20 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'location', header: 'Location', width: 30 },
        { key: 'size', header: 'Size', width: 15, type: 'number' },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'imageUrl', header: 'Image URL', width: 50 },
        { key: 'description', header: 'Description', width: 50 },
        { key: 'yearBuilt', header: 'Year Built', width: 15, type: 'number' },
        { key: 'totalArea', header: 'Total Area', width: 15, type: 'number' },
        { key: 'totalUnits', header: 'Total Units', width: 15, type: 'number' },
        { key: 'dealerId', header: 'Dealer ID', width: 36 },
        { key: 'propertyCode', header: 'Property Code', width: 20 },
        { key: 'ownerName', header: 'Owner Name', width: 30 },
        { key: 'ownerPhone', header: 'Owner Phone', width: 20 },
        { key: 'rentAmount', header: 'Rent Amount', width: 15, type: 'number' },
        { key: 'securityDeposit', header: 'Security Deposit', width: 15, type: 'number' },
        { key: 'rentEscalationPercentage', header: 'Rent Escalation %', width: 15, type: 'number' },
        { key: 'documents', header: 'Documents (JSON)', width: 50 },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.property.findMany({ where: { isDeleted: false } }),
    },
    {
      name: 'Customers',
      model: 'Client',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 20 },
        { key: 'company', header: 'Company', width: 30 },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'clientType', header: 'Client Type', width: 20 },
        { key: 'clientCategory', header: 'Client Category', width: 20 },
        { key: 'cnic', header: 'CNIC', width: 20 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'billingAddress', header: 'Billing Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'country', header: 'Country', width: 20 },
        { key: 'postalCode', header: 'Postal Code', width: 15 },
        { key: 'clientCode', header: 'Client Code', width: 20 },
        { key: 'clientNo', header: 'Client No', width: 15 },
        { key: 'srNo', header: 'SR No', width: 15, type: 'number' },
        { key: 'propertyInterest', header: 'Property Interest', width: 25 },
        { key: 'cnicDocumentUrl', header: 'CNIC Document URL', width: 50 },
        { key: 'attachments', header: 'Attachments (JSON)', width: 50 },
        { key: 'tags', header: 'Tags (JSON)', width: 50 },
        { key: 'assignedDealerId', header: 'Assigned Dealer ID', width: 36 },
        { key: 'assignedAgentId', header: 'Assigned Agent ID', width: 36 },
        { key: 'convertedFromLeadId', header: 'Converted From Lead ID', width: 36 },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdBy', header: 'Created By', width: 36 },
        { key: 'updatedBy', header: 'Updated By', width: 36 },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.client.findMany({ where: { isDeleted: false } }),
    },
    {
      name: 'Installments',
      model: 'SaleInstallment',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'saleId', header: 'Sale ID', width: 36 },
        { key: 'installmentNumber', header: 'Installment Number', width: 20, type: 'number' },
        { key: 'amount', header: 'Amount', width: 15, type: 'number' },
        { key: 'dueDate', header: 'Due Date', width: 20, type: 'date' },
        { key: 'paidDate', header: 'Paid Date', width: 20, type: 'date' },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'paidAmount', header: 'Paid Amount', width: 15, type: 'number' },
        { key: 'notes', header: 'Notes', width: 50 },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.saleInstallment.findMany({ where: { isDeleted: false } }),
    },
    {
      name: 'Payments',
      model: 'Payment',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'paymentId', header: 'Payment ID', width: 20 },
        { key: 'dealId', header: 'Deal ID', width: 36 },
        { key: 'amount', header: 'Amount', width: 15, type: 'number' },
        { key: 'paymentType', header: 'Payment Type', width: 20 },
        { key: 'paymentMode', header: 'Payment Mode', width: 20 },
        { key: 'transactionId', header: 'Transaction ID', width: 30 },
        { key: 'referenceNumber', header: 'Reference Number', width: 30 },
        { key: 'date', header: 'Date', width: 20, type: 'date' },
        { key: 'remarks', header: 'Remarks', width: 50 },
        { key: 'createdByUserId', header: 'Created By User ID', width: 36 },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.payment.findMany(),
    },
    {
      name: 'Ledger',
      model: 'LedgerEntry',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'dealId', header: 'Deal ID', width: 36 },
        { key: 'paymentId', header: 'Payment ID', width: 36 },
        { key: 'accountDebit', header: 'Account Debit', width: 30 },
        { key: 'accountCredit', header: 'Account Credit', width: 30 },
        { key: 'amount', header: 'Amount', width: 15, type: 'number' },
        { key: 'remarks', header: 'Remarks', width: 50 },
        { key: 'date', header: 'Date', width: 20, type: 'date' },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.ledgerEntry.findMany(),
    },
    {
      name: 'Staff',
      model: 'Employee',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'employeeId', header: 'Employee ID', width: 20 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 20 },
        { key: 'position', header: 'Position', width: 30 },
        { key: 'department', header: 'Department', width: 30 },
        { key: 'departmentCode', header: 'Department Code', width: 20 },
        { key: 'role', header: 'Role', width: 20 },
        { key: 'salary', header: 'Salary', width: 15, type: 'number' },
        { key: 'basicSalary', header: 'Basic Salary', width: 15, type: 'number' },
        { key: 'joinDate', header: 'Join Date', width: 20, type: 'date' },
        { key: 'dateOfBirth', header: 'Date of Birth', width: 20, type: 'date' },
        { key: 'gender', header: 'Gender', width: 15 },
        { key: 'maritalStatus', header: 'Marital Status', width: 20 },
        { key: 'nationality', header: 'Nationality', width: 20 },
        { key: 'bloodGroup', header: 'Blood Group', width: 15 },
        { key: 'cnic', header: 'CNIC', width: 20 },
        { key: 'cnicDocumentUrl', header: 'CNIC Document URL', width: 50 },
        { key: 'profilePhotoUrl', header: 'Profile Photo URL', width: 50 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'country', header: 'Country', width: 20 },
        { key: 'postalCode', header: 'Postal Code', width: 15 },
        { key: 'employeeType', header: 'Employee Type', width: 20 },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.employee.findMany({ where: { isDeleted: false } }),
    },
    {
      name: 'Leads',
      model: 'Lead',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'name', header: 'Name', width: 30 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone', width: 20 },
        { key: 'source', header: 'Source', width: 20 },
        { key: 'leadSourceDetails', header: 'Source Details', width: 30 },
        { key: 'priority', header: 'Priority', width: 15 },
        { key: 'score', header: 'Score', width: 15, type: 'number' },
        { key: 'interest', header: 'Interest', width: 20 },
        { key: 'interestType', header: 'Interest Type', width: 20 },
        { key: 'budget', header: 'Budget', width: 20 },
        { key: 'budgetMin', header: 'Budget Min', width: 15, type: 'number' },
        { key: 'budgetMax', header: 'Budget Max', width: 15, type: 'number' },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'temperature', header: 'Temperature', width: 15 },
        { key: 'cnic', header: 'CNIC', width: 20 },
        { key: 'address', header: 'Address', width: 40 },
        { key: 'city', header: 'City', width: 20 },
        { key: 'country', header: 'Country', width: 20 },
        { key: 'postalCode', header: 'Postal Code', width: 15 },
        { key: 'leadCode', header: 'Lead Code', width: 20 },
        { key: 'manualUniqueId', header: 'Manual Unique ID', width: 20 },
        { key: 'assignedToUserId', header: 'Assigned Agent ID', width: 36 },
        { key: 'assignedDealerId', header: 'Assigned Dealer ID', width: 36 },
        { key: 'expectedCloseDate', header: 'Expected Close Date', width: 20, type: 'date' },
        { key: 'followUpDate', header: 'Follow-up Date', width: 20, type: 'date' },
        { key: 'communicationPreference', header: 'Communication Preference', width: 25 },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.lead.findMany({ where: { isDeleted: false } }),
    },
    {
      name: 'Bookings',
      model: 'Deal',
      columns: [
        { key: 'id', header: 'ID', width: 36 },
        { key: 'title', header: 'Title', width: 40 },
        { key: 'dealCode', header: 'Deal Code', width: 20 },
        { key: 'role', header: 'Role', width: 20 },
        { key: 'dealAmount', header: 'Deal Amount', width: 15, type: 'number' },
        { key: 'valueBreakdown', header: 'Value Breakdown (JSON)', width: 50 },
        { key: 'dealType', header: 'Deal Type', width: 20 },
        { key: 'stage', header: 'Stage', width: 20 },
        { key: 'status', header: 'Status', width: 20 },
        { key: 'probability', header: 'Probability', width: 15, type: 'number' },
        { key: 'dealDate', header: 'Deal Date', width: 20, type: 'date' },
        { key: 'clientId', header: 'Client ID', width: 36 },
        { key: 'dealerId', header: 'Dealer ID', width: 36 },
        { key: 'propertyId', header: 'Property ID', width: 36 },
        { key: 'commissionRate', header: 'Commission Rate', width: 15, type: 'number' },
        { key: 'commissionAmount', header: 'Commission Amount', width: 15, type: 'number' },
        { key: 'expectedClosingDate', header: 'Expected Closing Date', width: 20, type: 'date' },
        { key: 'actualClosingDate', header: 'Actual Closing Date', width: 20, type: 'date' },
        { key: 'expectedRevenue', header: 'Expected Revenue', width: 15, type: 'number' },
        { key: 'attachments', header: 'Attachments (JSON)', width: 50 },
        { key: 'notes', header: 'Notes', width: 50 },
        { key: 'tags', header: 'Tags (JSON)', width: 50 },
        { key: 'requiresApproval', header: 'Requires Approval', width: 20, type: 'boolean' },
        { key: 'approvedBy', header: 'Approved By', width: 36 },
        { key: 'approvedAt', header: 'Approved At', width: 20, type: 'date' },
        { key: 'isDeleted', header: 'Is Deleted', width: 15, type: 'boolean' },
        { key: 'createdBy', header: 'Created By', width: 36 },
        { key: 'updatedBy', header: 'Updated By', width: 36 },
        { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
        { key: 'updatedAt', header: 'Updated At', width: 20, type: 'date' },
      ],
      query: () => prisma.deal.findMany({ where: { isDeleted: false } }),
    },
  ];
}

// Convert value to appropriate Excel format
function formatValue(value: any, type?: string): any {
  if (value === null || value === undefined) {
    return '';
  }

  if (type === 'date' && value instanceof Date) {
    return value;
  }

  if (type === 'boolean') {
    return value === true || value === 'true' || value === 1;
  }

  if (type === 'number') {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '' : num;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

// Generate Excel workbook
export async function generateExcelExport(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'REMS Software';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetConfigs = getSheetConfigs();

  // Create data sheets
  for (const config of sheetConfigs) {
    const sheet = workbook.addWorksheet(config.name);
    
    // Add action column for import
    const columns = [...config.columns];
    columns.push({
      key: 'action',
      header: 'Action (optional: leave empty, or set to "delete" to soft delete)',
      width: 30,
      type: 'string' as const,
    });

    // Set column headers
    sheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15,
    }));

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Fetch and add data
    try {
      const data = await config.query();
      
      for (const row of data) {
        const rowData: any = {};
        for (const col of config.columns) {
          const value = row[col.key];
          rowData[col.key] = formatValue(value, col.type);
        }
        sheet.addRow(rowData);
      }

      // Freeze header row
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    } catch (error) {
      console.error(`Error fetching data for sheet ${config.name}:`, error);
      // Add error row
      sheet.addRow({ [config.columns[0].key]: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }

  // Options sheet removed - not needed in bulk export

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ExcelJS.Buffer;
}

