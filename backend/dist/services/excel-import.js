"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importExcelFile = importExcelFile;
const exceljs_1 = __importDefault(require("exceljs"));
const client_1 = __importDefault(require("../prisma/client"));
// Allowed columns for update (excludes created_at and other system fields)
const ALLOWED_UPDATE_COLUMNS = {
    Property: [
        'name', 'title', 'type', 'address', 'city', 'location', 'size', 'status',
        'imageUrl', 'description', 'yearBuilt', 'totalArea', 'totalUnits', 'dealerId',
        'propertyCode', 'ownerName', 'ownerPhone', 'rentAmount', 'securityDeposit',
        'rentEscalationPercentage', 'documents', 'isDeleted', 'updatedAt'
    ],
    Client: [
        'name', 'email', 'phone', 'company', 'status', 'clientType', 'clientCategory',
        'cnic', 'address', 'billingAddress', 'city', 'country', 'postalCode', 'clientCode',
        'clientNo', 'srNo', 'propertyInterest', 'cnicDocumentUrl', 'attachments', 'tags',
        'assignedDealerId', 'assignedAgentId', 'convertedFromLeadId', 'isDeleted', 'updatedBy', 'updatedAt'
    ],
    SaleInstallment: [
        'saleId', 'installmentNumber', 'amount', 'dueDate', 'paidDate', 'status',
        'paidAmount', 'notes', 'isDeleted', 'updatedAt'
    ],
    Payment: [
        'paymentId', 'dealId', 'amount', 'paymentType', 'paymentMode', 'transactionId',
        'referenceNumber', 'date', 'remarks', 'createdByUserId', 'updatedAt'
    ],
    LedgerEntry: [
        'dealId', 'paymentId', 'accountDebit', 'accountCredit', 'amount', 'remarks',
        'date', 'updatedAt'
    ],
    Employee: [
        'employeeId', 'name', 'email', 'phone', 'position', 'department', 'departmentCode',
        'role', 'salary', 'basicSalary', 'joinDate', 'dateOfBirth', 'gender', 'maritalStatus',
        'nationality', 'bloodGroup', 'cnic', 'cnicDocumentUrl', 'profilePhotoUrl', 'address',
        'city', 'country', 'postalCode', 'employeeType', 'status', 'isDeleted', 'updatedAt'
    ],
    Deal: [
        'title', 'dealCode', 'role', 'dealAmount', 'valueBreakdown', 'dealType', 'stage',
        'status', 'probability', 'dealDate', 'clientId', 'dealerId', 'propertyId',
        'commissionRate', 'commissionAmount', 'expectedClosingDate', 'actualClosingDate',
        'expectedRevenue', 'attachments', 'notes', 'tags', 'requiresApproval', 'approvedBy',
        'approvedAt', 'isDeleted', 'updatedBy', 'updatedAt'
    ],
};
// Required fields for each model
const REQUIRED_FIELDS = {
    Property: ['name', 'type', 'address'],
    Client: ['name'],
    SaleInstallment: ['saleId', 'installmentNumber', 'amount', 'dueDate'],
    Payment: ['dealId', 'amount', 'paymentType'],
    LedgerEntry: ['dealId', 'accountDebit', 'accountCredit', 'amount'],
    Employee: ['employeeId', 'name', 'email', 'position', 'department', 'salary', 'joinDate'],
    Deal: ['title', 'dealAmount'],
};
// Convert Excel cell value to appropriate type
function convertValue(value, columnType, fieldName) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    // Keep phone, email, and other string fields as strings (don't convert to number)
    const stringFields = ['phone', 'email', 'cnic', 'postalCode', 'clientCode', 'propertyCode',
        'employeeId', 'paymentId', 'transactionId', 'referenceNumber', 'dealCode',
        'clientNo', 'paymentId'];
    if (fieldName && stringFields.includes(fieldName)) {
        return String(value);
    }
    // Integer fields (must be whole numbers)
    const integerFields = ['yearBuilt', 'totalUnits', 'installmentNumber', 'srNo', 'probability',
        'totalUnits', 'probationPeriod', 'graceMinutes', 'lateMinutes', 'overtimeHours'];
    if (fieldName && integerFields.includes(fieldName)) {
        const num = parseInt(String(value), 10);
        return isNaN(num) ? null : num;
    }
    // Float fields (can have decimals)
    const floatFields = ['size', 'totalArea', 'amount', 'rentAmount', 'securityDeposit',
        'rentEscalationPercentage', 'paidAmount', 'salary', 'basicSalary',
        'commissionRate', 'commissionAmount', 'dealAmount', 'expectedRevenue',
        'hours', 'days', 'totalAllocated', 'used', 'pending', 'available',
        'carryForward', 'accrualRate', 'maxCarryForward', 'taxAmount',
        'taxPercent', 'discountAmount', 'totalAmount', 'remainingAmount',
        'estimatedCost', 'actualCost', 'advanceBalance', 'outstandingBalance'];
    if (fieldName && floatFields.includes(fieldName)) {
        const num = parseFloat(String(value));
        return isNaN(num) ? null : num;
    }
    // Handle boolean
    if (columnType === 'boolean' || typeof value === 'boolean') {
        return value === true || value === 'true' || value === 1 || value === '1';
    }
    // Handle number (only if columnType is explicitly 'number' and not already handled above)
    if (columnType === 'number' && fieldName && !integerFields.includes(fieldName) && !floatFields.includes(fieldName)) {
        const num = Number(value);
        return isNaN(num) ? null : num;
    }
    // Handle date
    if (columnType === 'date' || value instanceof Date) {
        if (value instanceof Date) {
            return value;
        }
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }
    // Handle JSON strings
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    return String(value);
}
// Helper to convert Excel header to field name (used in validation too)
function headerToFieldName(header, allowedColumns) {
    // Direct match first
    if (allowedColumns.includes(header))
        return header;
    if (header.toLowerCase() === 'id')
        return 'id';
    // Convert "Property Code" -> "propertyCode", "Created At" -> "createdAt", etc.
    return header
        .split(/\s+/)
        .map((word, idx) => idx === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
        .replace(/[^a-zA-Z0-9]/g, '');
}
// Validate row data (using mapped field names)
function validateRow(rowData, modelName, rowNumber, allowedColumns) {
    const required = REQUIRED_FIELDS[modelName] || [];
    // Create a mapped version of rowData with proper field names
    const mappedData = {};
    for (const [header, value] of Object.entries(rowData)) {
        if (header.toLowerCase() === 'action')
            continue;
        const fieldName = headerToFieldName(header, allowedColumns);
        if (allowedColumns.includes(fieldName) || fieldName === 'id') {
            // Convert value and store (pass fieldName to keep strings as strings)
            const convertedValue = convertValue(value, undefined, fieldName);
            if (convertedValue !== null && convertedValue !== undefined && convertedValue !== '') {
                mappedData[fieldName] = convertedValue;
            }
        }
    }
    // Check if row has any data at all (if completely empty, skip validation)
    const hasAnyData = Object.keys(mappedData).length > 0;
    if (!hasAnyData) {
        return null; // Empty row, skip validation
    }
    for (const field of required) {
        const value = mappedData[field];
        if (value === null || value === undefined || value === '' ||
            (typeof value === 'string' && value.trim() === '')) {
            return `Missing required field: ${field}`;
        }
    }
    return null;
}
// Options sheet processing removed - not needed in bulk import
// Process a single sheet
async function processSheet(sheet, modelName, result) {
    const sheetName = sheet.name;
    const rows = sheet.getRows(2, sheet.rowCount - 1) || [];
    const headers = [];
    // Get headers from first row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
            headers[colNumber - 1] = cell.value.toString();
        }
    });
    const allowedColumns = ALLOWED_UPDATE_COLUMNS[modelName] || [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row)
            continue;
        const rowData = {};
        let hasData = false;
        // Extract row data
        row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
                const value = cell.value;
                if (value !== null && value !== undefined && value !== '') {
                    hasData = true;
                }
                rowData[header] = value;
            }
        });
        // Skip empty rows
        if (!hasData) {
            continue;
        }
        // Check for action column
        const action = rowData['action']?.toString()?.toLowerCase()?.trim();
        const id = rowData['ID']?.toString()?.trim() || rowData['id']?.toString()?.trim();
        try {
            // Map model names to Prisma client methods (camelCase) - defined once
            const prismaModelMap = {
                'Property': 'property',
                'Client': 'client',
                'SaleInstallment': 'saleInstallment',
                'Payment': 'payment',
                'LedgerEntry': 'ledgerEntry',
                'Employee': 'employee',
                'Deal': 'deal',
            };
            const prismaMethod = prismaModelMap[modelName];
            if (!prismaMethod) {
                throw new Error(`Unknown model: ${modelName}`);
            }
            // Filter allowed columns only - extract data first
            const updateData = {};
            for (const [key, value] of Object.entries(rowData)) {
                // Skip action column
                if (key.toLowerCase() === 'action') {
                    continue;
                }
                const fieldName = headerToFieldName(key, allowedColumns);
                if (allowedColumns.includes(fieldName) || fieldName === 'id') {
                    updateData[fieldName] = convertValue(value, undefined, fieldName);
                }
            }
            // Extract id from updateData (we use it separately)
            const recordId = updateData.id || id;
            delete updateData.id;
            // Skip validation for delete action (only need ID)
            if (action !== 'delete') {
                // Check if row has any meaningful data (not just empty cells)
                const hasMeaningfulData = Object.entries(rowData).some(([key, value]) => {
                    if (key.toLowerCase() === 'action')
                        return false;
                    return value !== null && value !== undefined && value !== '' &&
                        (typeof value !== 'string' || value.trim() !== '');
                });
                // If row is completely empty, skip it
                if (!hasMeaningfulData) {
                    continue;
                }
                // Validate row with proper field mapping
                const validationError = validateRow(rowData, modelName, i + 2, allowedColumns);
                if (validationError) {
                    result.errors.push({
                        row: i + 2,
                        sheet: sheetName,
                        error: validationError,
                    });
                    result.failed++;
                    continue;
                }
            }
            else {
                // For delete, only validate that ID exists
                if (!recordId) {
                    result.errors.push({
                        row: i + 2,
                        sheet: sheetName,
                        error: 'ID is required for delete action',
                    });
                    result.failed++;
                    continue;
                }
            }
            // Handle delete action
            if (action === 'delete') {
                if (recordId) {
                    const deleteId = recordId;
                    // Use Prisma update for soft delete
                    try {
                        await client_1.default[prismaMethod].update({
                            where: { id: deleteId },
                            data: { isDeleted: true, updatedAt: new Date() },
                        });
                        result.deleted++;
                        if (!result.details[sheetName]) {
                            result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                        }
                        result.details[sheetName].deleted++;
                    }
                    catch (error) {
                        // If update fails, try to check if record exists
                        const exists = await client_1.default[prismaMethod].findUnique({
                            where: { id: deleteId },
                        });
                        if (!exists) {
                            throw new Error(`Record with ID ${deleteId} not found`);
                        }
                        throw error;
                    }
                }
                continue;
            }
            // Handle update or create
            if (recordId) {
                const updateId = recordId;
                // Check if record exists
                const existing = await client_1.default[prismaMethod].findUnique({
                    where: { id: updateId },
                });
                if (existing) {
                    // Update existing record
                    updateData.updatedAt = new Date();
                    await client_1.default[prismaMethod].update({
                        where: { id: updateId },
                        data: updateData,
                    });
                    result.updated++;
                    if (!result.details[sheetName]) {
                        result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                    }
                    result.details[sheetName].updated++;
                }
                else {
                    // Create new record with provided ID
                    // Check for unique constraints (propertyCode, clientCode, etc.)
                    try {
                        updateData.id = updateId;
                        updateData.createdAt = new Date();
                        updateData.updatedAt = new Date();
                        await client_1.default[prismaMethod].create({
                            data: updateData,
                        });
                        result.inserted++;
                        if (!result.details[sheetName]) {
                            result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                        }
                        result.details[sheetName].inserted++;
                    }
                    catch (createError) {
                        // Handle unique constraint violations
                        if (createError?.code === 'P2002') {
                            // Unique constraint failed - try to find existing record and update instead
                            const uniqueField = createError?.meta?.target?.[0];
                            if (uniqueField && updateData[uniqueField]) {
                                try {
                                    const existingByUnique = await client_1.default[prismaMethod].findUnique({
                                        where: { [uniqueField]: updateData[uniqueField] },
                                    });
                                    if (existingByUnique) {
                                        // Update existing record
                                        updateData.updatedAt = new Date();
                                        await client_1.default[prismaMethod].update({
                                            where: { id: existingByUnique.id },
                                            data: updateData,
                                        });
                                        result.updated++;
                                        if (!result.details[sheetName]) {
                                            result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                                        }
                                        result.details[sheetName].updated++;
                                    }
                                    else {
                                        throw createError;
                                    }
                                }
                                catch (updateError) {
                                    throw createError;
                                }
                            }
                            else {
                                throw createError;
                            }
                        }
                        else {
                            throw createError;
                        }
                    }
                }
            }
            else {
                // Create new record without ID
                // Check for unique constraints
                try {
                    updateData.createdAt = new Date();
                    updateData.updatedAt = new Date();
                    await client_1.default[prismaMethod].create({
                        data: updateData,
                    });
                    result.inserted++;
                    if (!result.details[sheetName]) {
                        result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                    }
                    result.details[sheetName].inserted++;
                }
                catch (createError) {
                    // Handle unique constraint violations
                    if (createError?.code === 'P2002') {
                        // Unique constraint failed - try to find existing record and update instead
                        const uniqueField = createError?.meta?.target?.[0];
                        if (uniqueField && updateData[uniqueField]) {
                            try {
                                const existingByUnique = await client_1.default[prismaMethod].findUnique({
                                    where: { [uniqueField]: updateData[uniqueField] },
                                });
                                if (existingByUnique) {
                                    // Update existing record
                                    updateData.updatedAt = new Date();
                                    await client_1.default[prismaMethod].update({
                                        where: { id: existingByUnique.id },
                                        data: updateData,
                                    });
                                    result.updated++;
                                    if (!result.details[sheetName]) {
                                        result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
                                    }
                                    result.details[sheetName].updated++;
                                }
                                else {
                                    throw createError;
                                }
                            }
                            catch (updateError) {
                                throw createError;
                            }
                        }
                        else {
                            throw createError;
                        }
                    }
                    else {
                        throw createError;
                    }
                }
            }
        }
        catch (error) {
            result.errors.push({
                row: i + 2,
                sheet: sheetName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            result.failed++;
            if (!result.details[sheetName]) {
                result.details[sheetName] = { inserted: 0, updated: 0, deleted: 0, failed: 0 };
            }
            result.details[sheetName].failed++;
        }
    }
}
// Main import function
async function importExcelFile(buffer) {
    const result = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        errors: [],
        details: {},
    };
    const workbook = new exceljs_1.default.Workbook();
    // ExcelJS accepts Buffer, so we can pass it directly
    await workbook.xlsx.load(buffer);
    // Options sheet processing removed - not needed
    // Map sheet names to model names (Amenities removed)
    const sheetModelMap = {
        'Properties': 'Property',
        'Customers': 'Client',
        'Installments': 'SaleInstallment',
        'Payments': 'Payment',
        'Ledger': 'LedgerEntry',
        'Staff': 'Employee',
        'Bookings': 'Deal',
    };
    // Process each data sheet
    for (const [sheetName, modelName] of Object.entries(sheetModelMap)) {
        const sheet = workbook.getWorksheet(sheetName);
        if (sheet) {
            await processSheet(sheet, modelName, result);
        }
    }
    return result;
}
//# sourceMappingURL=excel-import.js.map