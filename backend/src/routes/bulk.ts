import express, { Response } from 'express';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit-log';
import { errorResponse } from '../utils/error-handler';

const router = (express as any).Router();

// CSV escape function - properly escapes special characters
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

// Convert object to CSV row
function objectToCsvRow(obj: any, columns: string[]): string {
  return columns.map(col => escapeCsvValue(obj[col] ?? '')).join(',');
}

// Get all columns from Prisma model (excluding relations)
function getModelColumns(modelName: string): string[] {
  // Define column mappings for each model based on Prisma schema
  const columnMaps: Record<string, string[]> = {
    Property: [
      'id', 'name', 'title', 'type', 'address', 'city', 'location', 'size', 'status',
      'imageUrl', 'description', 'yearBuilt', 'totalArea', 'totalUnits', 'dealerId',
      'propertyCode', 'ownerName', 'ownerPhone', 'rentAmount', 'securityDeposit',
      'rentEscalationPercentage', 'documents', 'isDeleted', 'createdAt', 'updatedAt'
    ],
    FinanceLedger: [
      'id', 'referenceType', 'referenceId', 'category', 'amount', 'date', 'notes',
      'description', 'propertyId', 'tenantId', 'dealId', 'payrollId', 'invoiceId',
      'paymentId', 'isDeleted', 'createdBy', 'createdAt', 'updatedAt'
    ],
    Client: [
      'id', 'name', 'email', 'phone', 'company', 'status', 'clientType', 'clientCategory',
      'cnic', 'address', 'billingAddress', 'city', 'country', 'postalCode', 'clientCode',
      'clientNo', 'srNo', 'propertyInterest', 'cnicDocumentUrl', 'attachments', 'tags',
      'assignedDealerId', 'assignedAgentId', 'convertedFromLeadId', 'isDeleted',
      'createdBy', 'updatedBy', 'createdAt', 'updatedAt'
    ],
    Payment: [
      'id', 'paymentId', 'dealId', 'amount', 'paymentType', 'paymentMode', 'transactionId',
      'referenceNumber', 'date', 'remarks', 'createdByUserId', 'createdAt', 'updatedAt'
    ],
    LedgerEntry: [
      'id', 'dealId', 'paymentId', 'accountDebit', 'accountCredit', 'amount', 'remarks',
      'date', 'createdAt', 'updatedAt'
    ],
  };
  
  return columnMaps[modelName] || [];
}

// Export route - generates CSV with sections
router.get('/export', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const sections: Array<{ name: string; header: string; data: any[]; columns: string[] }> = [];

    // PROPERTIES section
    const properties = await prisma.property.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    if (properties.length > 0) {
      sections.push({
        name: 'PROPERTIES',
        header: '# PROPERTIES',
        data: properties,
        columns: getModelColumns('Property'),
      });
    }

    // FINANCE section (FinanceLedger)
    const financeLedgers = await prisma.financeLedger.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    if (financeLedgers.length > 0) {
      sections.push({
        name: 'FINANCE',
        header: '# FINANCE',
        data: financeLedgers,
        columns: getModelColumns('FinanceLedger'),
      });
    }

    // CUSTOMERS section (Client)
    const clients = await prisma.client.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    if (clients.length > 0) {
      sections.push({
        name: 'CUSTOMERS',
        header: '# CUSTOMERS',
        data: clients,
        columns: getModelColumns('Client'),
      });
    }

    // DEAL PAYMENTS section (Payment)
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (payments.length > 0) {
      sections.push({
        name: 'DEAL PAYMENTS',
        header: '# DEAL PAYMENTS',
        data: payments,
        columns: getModelColumns('Payment'),
      });
    }

    // LEDGER section (LedgerEntry)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      orderBy: { createdAt: 'asc' },
    });
    if (ledgerEntries.length > 0) {
      sections.push({
        name: 'LEDGER',
        header: '# LEDGER',
        data: ledgerEntries,
        columns: getModelColumns('LedgerEntry'),
      });
    }

    // Generate CSV content
    const csvLines: string[] = [];
    
    for (const section of sections) {
      // Add section header
      csvLines.push(section.header);
      
      // Add column headers
      csvLines.push(section.columns.join(','));
      
      // Add data rows
      for (const row of section.data) {
        // Convert JSON fields to strings
        const processedRow = { ...row };
        for (const key in processedRow) {
          if (processedRow[key] && typeof processedRow[key] === 'object') {
            processedRow[key] = JSON.stringify(processedRow[key]);
          }
          if (processedRow[key] instanceof Date) {
            processedRow[key] = processedRow[key].toISOString();
          }
        }
        csvLines.push(objectToCsvRow(processedRow, section.columns));
      }
      
      // Add blank line between sections
      csvLines.push('');
    }

    const csvContent = csvLines.join('\n');

    // Set response headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-export-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send(csvContent);
  } catch (error) {
    return errorResponse(res, error);
  }
});

// Parse CSV with sections
function parseCsvWithSections(csvContent: string): Map<string, Array<Record<string, string>>> {
  const sections = new Map<string, Array<Record<string, string>>>();
  const lines = csvContent.split(/\r?\n/);
  
  let currentSection: string | null = null;
  let currentColumns: string[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (inSection) {
        inSection = false;
        currentSection = null;
        currentColumns = [];
      }
      continue;
    }

    // Check for section header (starts with #)
    if (line.startsWith('#')) {
      // Save previous section if exists
      if (currentSection && currentColumns.length > 0) {
        inSection = true;
      }
      
      // Extract section name - remove #, trim, and take only the section name
      let sectionName = line.replace(/^#\s*/, '').trim();
      
      // If there are commas in the line, it might be malformed - take only the first part
      // Section headers should be like "# PROPERTIES" or "# DEAL PAYMENTS"
      if (sectionName.includes(',')) {
        // Take only the first part before comma
        sectionName = sectionName.split(',')[0].trim();
      }
      
      // Remove any trailing characters that aren't part of the section name
      // Section names should only contain letters, spaces, and possibly hyphens
      sectionName = sectionName.replace(/[^a-zA-Z\s-]/g, '').trim();
      
      // Normalize: remove any extra whitespace and convert to uppercase for consistency
      sectionName = sectionName.replace(/\s+/g, ' ').trim().toUpperCase();
      
      // Only set section if we have a valid name
      if (sectionName) {
        currentSection = sectionName;
        currentColumns = [];
        inSection = false;
      }
      continue;
    }

    // If we have a section, process the line
    if (currentSection) {
      // First non-header line after section is column headers
      if (currentColumns.length === 0) {
        currentColumns = line.split(',').map(col => col.trim()).filter(col => col.length > 0);
        inSection = true;
        // currentSection is already normalized from the header parsing
        if (currentSection && !sections.has(currentSection)) {
          sections.set(currentSection, []);
        }
        continue;
      }

      // Parse CSV row (handle quoted values)
      if (inSection && currentColumns.length > 0) {
        const row: Record<string, string> = {};
        const values = parseCsvLine(line);
        
        currentColumns.forEach((col, idx) => {
          row[col] = values[idx] || '';
        });
        
        // Skip completely empty rows
        if (Object.values(row).some(v => v.trim() !== '') && currentSection) {
          if (sections.has(currentSection)) {
            sections.get(currentSection)!.push(row);
          }
        }
      }
    }
  }

  return sections;
}

// Parse a CSV line handling quoted values
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last value
  values.push(current);
  
  return values;
}

// Convert string value to appropriate type
function convertValue(value: string, fieldName: string): any {
  if (!value || value.trim() === '') {
    return null;
  }
  
  const trimmed = value.trim();
  
  // Try to parse as JSON (for Json fields)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Only return parsed if it's actually an object/array, not a string that looks like JSON
      if (typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Not valid JSON, continue to other parsing
    }
  }
  
  // Try to parse as boolean
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  
  // Try to parse as date (ISO format or common date formats)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try to parse as number (integer or float)
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      // Return as integer if it's a whole number, otherwise as float
      return num % 1 === 0 ? parseInt(trimmed, 10) : num;
    }
  }
  
  return trimmed;
}

// Import route - parses CSV and upserts data
router.post('/import', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { csv } = req.body;
    
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    const sections = parseCsvWithSections(csv);
    const summary: {
      inserted: number;
      updated: number;
      failed: number;
      errors: string[];
      sectionResults: Record<string, { inserted: number; updated: number; failed: number }>;
    } = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
      sectionResults: {},
    };

    // Process each section in a separate transaction
    for (const [sectionName, rows] of sections.entries()) {
      const sectionResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
      };

      try {
        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            try {
              // Convert row values to appropriate types
              const processedRow: any = {};
              for (const [key, value] of Object.entries(row)) {
                processedRow[key] = convertValue(value, key);
              }

              // sectionName is already normalized from parsing, but ensure it's uppercase
              const normalizedSectionName = sectionName.toUpperCase().trim().replace(/\s+/g, ' ');
              
              // Handle each section type
              switch (normalizedSectionName) {
                case 'PROPERTIES':
                  await upsertProperty(tx, processedRow, sectionResult, i);
                  break;
                case 'FINANCE':
                  await upsertFinanceLedger(tx, processedRow, sectionResult, i);
                  break;
                case 'CUSTOMERS':
                  await upsertClient(tx, processedRow, sectionResult, i);
                  break;
                case 'DEAL PAYMENTS':
                  await upsertPayment(tx, processedRow, sectionResult, i);
                  break;
                case 'LEDGER':
                  await upsertLedgerEntry(tx, processedRow, sectionResult, i);
                  break;
                default:
                  summary.errors.push(`Section "${sectionName}": Unknown section type. Expected: PROPERTIES, FINANCE, CUSTOMERS, DEAL PAYMENTS, or LEDGER`);
                  sectionResult.failed++;
              }
            } catch (error: any) {
              sectionResult.failed++;
              summary.errors.push(`${sectionName} row ${i + 1}: ${error?.message || 'Failed to process row'}`);
            }
          }
        }, {
          timeout: 30000, // 30 second timeout
        });
      } catch (error: any) {
        summary.errors.push(`${sectionName} transaction failed: ${error?.message || 'Unknown error'}`);
        sectionResult.failed += rows.length;
      }

      summary.sectionResults[sectionName] = sectionResult;
      summary.inserted += sectionResult.inserted;
      summary.updated += sectionResult.updated;
      summary.failed += sectionResult.failed;
    }

    // Log audit
    await createAuditLog({
      entityType: 'bulk_import',
      entityId: 'csv-import',
      action: 'import',
      userId: req.user?.id,
      userName: req.user?.username,
      description: `Bulk CSV import completed: ${summary.inserted} inserted, ${summary.updated} updated, ${summary.failed} failed`,
      metadata: summary,
    });

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// Upsert helpers for each model
async function upsertProperty(
  tx: Prisma.TransactionClient,
  row: any,
  result: { inserted: number; updated: number; failed: number },
  index: number
) {
  // Validate required fields
  if (!row.name || !row.type || !row.address) {
    throw new Error('Missing required fields: name, type, address');
  }

  if (row.id) {
    const existing = await tx.property.findUnique({ where: { id: row.id } });
    if (existing) {
      await tx.property.update({
        where: { id: row.id },
        data: {
          ...row,
          updatedAt: new Date(),
        },
      });
      result.updated++;
      return;
    }
  }

  // Create new
  await tx.property.create({
    data: {
      ...row,
      id: row.id || undefined, // Let Prisma generate if not provided
    },
  });
  result.inserted++;
}

async function upsertFinanceLedger(
  tx: Prisma.TransactionClient,
  row: any,
  result: { inserted: number; updated: number; failed: number },
  index: number
) {
  if (!row.category || !row.amount || !row.referenceType) {
    throw new Error('Missing required fields: category, amount, referenceType');
  }

  if (row.id) {
    const existing = await tx.financeLedger.findUnique({ where: { id: row.id } });
    if (existing) {
      await tx.financeLedger.update({
        where: { id: row.id },
        data: {
          ...row,
          updatedAt: new Date(),
        },
      });
      result.updated++;
      return;
    }
  }

  await tx.financeLedger.create({
    data: {
      ...row,
      id: row.id || undefined,
    },
  });
  result.inserted++;
}

async function upsertClient(
  tx: Prisma.TransactionClient,
  row: any,
  result: { inserted: number; updated: number; failed: number },
  index: number
) {
  if (!row.name) {
    throw new Error('Missing required field: name');
  }

  if (row.id) {
    const existing = await tx.client.findUnique({ where: { id: row.id } });
    if (existing) {
      await tx.client.update({
        where: { id: row.id },
        data: {
          ...row,
          updatedAt: new Date(),
        },
      });
      result.updated++;
      return;
    }
  }

  await tx.client.create({
    data: {
      ...row,
      id: row.id || undefined,
    },
  });
  result.inserted++;
}

async function upsertPayment(
  tx: Prisma.TransactionClient,
  row: any,
  result: { inserted: number; updated: number; failed: number },
  index: number
) {
  if (!row.dealId || !row.amount || !row.paymentType) {
    throw new Error('Missing required fields: dealId, amount, paymentType');
  }

  if (row.id) {
    const existing = await tx.payment.findUnique({ where: { id: row.id } });
    if (existing) {
      await tx.payment.update({
        where: { id: row.id },
        data: {
          ...row,
          updatedAt: new Date(),
        },
      });
      result.updated++;
      return;
    }
  }

  // Generate paymentId if not provided
  if (!row.paymentId) {
    const count = await tx.payment.count();
    row.paymentId = `PAY-${String(count + 1).padStart(6, '0')}`;
  }

  await tx.payment.create({
    data: {
      ...row,
      id: row.id || undefined,
    },
  });
  result.inserted++;
}

async function upsertLedgerEntry(
  tx: Prisma.TransactionClient,
  row: any,
  result: { inserted: number; updated: number; failed: number },
  index: number
) {
  if (!row.dealId || !row.accountDebit || !row.accountCredit || !row.amount) {
    throw new Error('Missing required fields: dealId, accountDebit, accountCredit, amount');
  }

  if (row.id) {
    const existing = await tx.ledgerEntry.findUnique({ where: { id: row.id } });
    if (existing) {
      await tx.ledgerEntry.update({
        where: { id: row.id },
        data: {
          ...row,
          updatedAt: new Date(),
        },
      });
      result.updated++;
      return;
    }
  }

  await tx.ledgerEntry.create({
    data: {
      ...row,
      id: row.id || undefined,
    },
  });
  result.inserted++;
}

export default router;

