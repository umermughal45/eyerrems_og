/**
 * Centralized ID Generation Service
 * 
 * Generates system IDs in format: {prefix}-{YY}-{####}
 * - prefix: module identifier (prop, pay, cli, lead, deal, etc.)
 * - YY: last 2 digits of current year
 * - ####: 4-digit incremental counter per module per year
 * 
 * Features:
 * - Atomic operations to prevent race conditions
 * - Year-based counter reset
 * - Continues from highest existing ID
 * - Thread-safe using database transactions
 */

import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';

// Helper function to check if a column exists in a table
const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND LOWER(table_name) = LOWER(${tableName})
          AND LOWER(column_name) = LOWER(${columnName})
      ) AS "exists";
    `;
    return Boolean(rows[0]?.exists);
  } catch (error) {
    return false;
  }
};

export type ModulePrefix =
  | 'prop'  // Properties
  | 'pay'   // Payments
  | 'cli'   // Clients
  | 'lead'  // Leads
  | 'deal'  // Dealers
  | 'dl'    // Deals (different from dealers)
  | 'rcp'   // Receipts
  | 'inv'   // Invoices
  | 'txn'   // Transactions
  | 'je'    // Journal Entries
  | 'vch'   // Vouchers
  | 'ten'   // Tenants
  | 'tkt'   // Maintenance Tickets
  | 'ntc'   // Notices
  | 'emp'   // Employees
  | 'ldg';  // Ledger

interface IdGenerationResult {
  systemId: string;
  year: number;
  counter: number;
}

// Re-implementing generateSequenceNumber here since tid-service is missing
export async function generateSequenceNumber(prefix: string): Promise<number> {
  try {
    const seq = await prisma.sequence.update({
      where: { prefix },
      data: { current: { increment: 1 } },
    });
    return seq.current;
  } catch (error: any) {
    // If sequence not found (P2025), initialize it
    if (error.code === 'P2025') {
      // Create sequence starting at 1
      const seq = await prisma.sequence.upsert({
        where: { prefix },
        create: { prefix, current: 1 },
        update: { current: { increment: 1 } },
      });
      return seq.current;
    }
    throw error;
  }
}

// Helper to find max ID from legacy tables
async function findMaxSystemId(
  modulePrefix: ModulePrefix,
  prefix: string,
  client: Prisma.TransactionClient
): Promise<number> {
  let maxCounter = 0;

  // Query based on module type
  switch (modulePrefix) {
    case 'prop':
      const maxProp = await client.property.findFirst({
        where: { propertyCode: { startsWith: prefix } },
        orderBy: { propertyCode: 'desc' },
        select: { propertyCode: true },
      });
      if (maxProp?.propertyCode) {
        const counterStr = maxProp.propertyCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'pay':
      const maxPay = await client.payment.findFirst({
        where: { paymentId: { startsWith: prefix } },
        orderBy: { paymentId: 'desc' },
        select: { paymentId: true },
      });
      if (maxPay?.paymentId) {
        const counterStr = maxPay.paymentId.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'cli':
      const maxCli = await client.client.findFirst({
        where: { clientCode: { startsWith: prefix } },
        orderBy: { clientCode: 'desc' },
        select: { clientCode: true },
      });
      if (maxCli?.clientCode) {
        const counterStr = maxCli.clientCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'lead':
      const maxLead = await client.lead.findFirst({
        where: { leadCode: { startsWith: prefix } },
        orderBy: { leadCode: 'desc' },
        select: { leadCode: true },
      });
      if (maxLead?.leadCode) {
        const counterStr = maxLead.leadCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'deal':
      const maxDeal = await client.dealer.findFirst({
        where: { dealerCode: { startsWith: prefix } },
        orderBy: { dealerCode: 'desc' },
        select: { dealerCode: true },
      });
      if (maxDeal?.dealerCode) {
        const counterStr = maxDeal.dealerCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'dl':
      const maxDl = await client.deal.findFirst({
        where: { dealCode: { startsWith: prefix } },
        orderBy: { dealCode: 'desc' },
        select: { dealCode: true },
      });
      if (maxDl?.dealCode) {
        const counterStr = maxDl.dealCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'rcp':
      const maxRcp = await client.dealReceipt.findFirst({
        where: { receiptNo: { startsWith: prefix } },
        orderBy: { receiptNo: 'desc' },
        select: { receiptNo: true },
      });
      if (maxRcp?.receiptNo) {
        const counterStr = maxRcp.receiptNo.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'inv':
      const maxInv = await client.invoice.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });
      if (maxInv?.invoiceNumber) {
        const counterStr = maxInv.invoiceNumber.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'txn':
      const maxTxn = await client.transaction.findFirst({
        where: { transactionCode: { startsWith: prefix } },
        orderBy: { transactionCode: 'desc' },
        select: { transactionCode: true },
      });
      if (maxTxn?.transactionCode) {
        const counterStr = maxTxn.transactionCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'je':
      const maxJe = await client.journalEntry.findFirst({
        where: { entryNumber: { startsWith: prefix } },
        orderBy: { entryNumber: 'desc' },
        select: { entryNumber: true },
      });
      if (maxJe?.entryNumber) {
        const counterStr = maxJe.entryNumber.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'vch':
      const maxVch = await client.voucher.findFirst({
        where: { voucherNumber: { startsWith: prefix } },
        orderBy: { voucherNumber: 'desc' },
        select: { voucherNumber: true },
      });
      if (maxVch?.voucherNumber) {
        const counterStr = maxVch.voucherNumber.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'ten':
      const maxTen = await client.tenant.findFirst({
        where: { tenantCode: { startsWith: prefix } },
        orderBy: { tenantCode: 'desc' },
        select: { tenantCode: true },
      });
      if (maxTen?.tenantCode) {
        const counterStr = maxTen.tenantCode.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'tkt':
      const maxTkt = await client.maintenanceTicket.findFirst({
        where: { ticketNumber: { startsWith: prefix } },
        orderBy: { ticketNumber: 'desc' },
        select: { ticketNumber: true },
      });
      if (maxTkt?.ticketNumber) {
        const counterStr = maxTkt.ticketNumber.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'ntc':
      const maxNtc = await client.noticeToVacate.findFirst({
        where: { noticeNumber: { startsWith: prefix } },
        orderBy: { noticeNumber: 'desc' },
        select: { noticeNumber: true },
      });
      if (maxNtc?.noticeNumber) {
        const counterStr = maxNtc.noticeNumber.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    case 'emp':
      const maxEmp = await client.employee.findFirst({
        where: { tid: { startsWith: prefix } },
        orderBy: { tid: 'desc' },
        select: { tid: true },
      });
      if (maxEmp?.tid) {
        const counterStr = maxEmp.tid.replace(prefix, '');
        maxCounter = parseInt(counterStr, 10) || 0;
      }
      break;

    default:
      // For unknown prefixes, start at 0
      break;
  }

  return maxCounter;
}

/**
 * Generate system ID for a module
 * Format: {prefix}-{YY}-{####}
 * 
 * @param modulePrefix - Module prefix (prop, pay, cli, etc.)
 * @param tx - Optional transaction client for atomic operations
 * @returns Generated system ID
 */
export async function generateSystemId(
  modulePrefix: ModulePrefix,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearSuffix = String(currentYear).slice(-2); // Last 2 digits

  // Create a prefix that includes the year to ensure year-based uniqueness in the sequence
  // e.g. "lead-25"
  const sequencePrefix = `${modulePrefix}-${yearSuffix}`;
  const dbPrefix = `${modulePrefix}-${yearSuffix}-`;

  try {
    // Optimistic: Try to increment sequence
    // We use raw update to fail fast if not exists
    // Note: 'tx' might not have 'sequence' if it's a restricted view, but standard Prisma tx does.
    // If we are in a transaction, we should try to use it, but sequence operations 
    // often need to be outside the main transaction to avoid locking unrelated rows if possible,
    // OR inside to ensure atomicity with the main operation.
    // Here we strictly follow the passed tx or global prisma.
    const client = tx || prisma;

    const seq = await client.sequence.update({
      where: { prefix: sequencePrefix },
      data: { current: { increment: 1 } },
    });

    return `${modulePrefix}-${yearSuffix}-${seq.current.toString().padStart(4, '0')}`;
  } catch (error: any) {
    // If sequence not found (P2025), initialize it
    if (error.code === 'P2025') {
      const client = tx || prisma;

      // Find max from legacy tables
      const maxCounter = await findMaxSystemId(modulePrefix, dbPrefix, client);
      const nextCounter = maxCounter + 1;

      // Create sequence starting at nextCounter
      // We use upsert here just in case another concurrent request created it 
      // between the update failure and now.
      const seq = await client.sequence.upsert({
        where: { prefix: sequencePrefix },
        create: { prefix: sequencePrefix, current: nextCounter },
        update: { current: { increment: 1 } },
      });

      return `${modulePrefix}-${yearSuffix}-${seq.current.toString().padStart(4, '0')}`;
    }
    throw error;
  }
}

/**
 * Validate manual unique ID
 * Ensures it doesn't conflict with system IDs
 * 
 * @param manualId - User-provided manual ID
 * @param modulePrefix - Module prefix to check against
 * @param excludeId - Optional ID to exclude from check (for updates)
 * @param tx - Optional transaction client
 * @returns true if valid, throws error if invalid
 */
export async function validateManualUniqueId(
  manualId: string,
  modulePrefix: ModulePrefix,
  excludeId?: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  if (!manualId || manualId.trim() === '') {
    return true; // Empty is allowed (optional field)
  }

  const client = tx || prisma;
  const trimmedId = manualId.trim();

  // Check if manual ID matches system ID pattern (should not)
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const systemIdPattern = new RegExp(`^${modulePrefix}-${yearSuffix}-\\d{4}$`);
  if (systemIdPattern.test(trimmedId)) {
    throw new Error('Manual ID cannot match system ID format');
  }

  // Check for conflicts based on module
  switch (modulePrefix) {
    case 'prop':
      const existingProp = await client.property.findFirst({
        where: {
          OR: [
            { propertyCode: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingProp) {
        throw new Error('Manual ID already exists for a property');
      }
      break;

    case 'pay':
      const existingPay = await client.payment.findFirst({
        where: {
          OR: [
            { paymentId: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingPay) {
        throw new Error('Manual ID already exists for a payment');
      }
      break;

    case 'cli':
      const existingCli = await client.client.findFirst({
        where: {
          OR: [
            { clientCode: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingCli) {
        throw new Error('Manual ID already exists for a client');
      }
      break;

    case 'lead':
      const existingLead = await client.lead.findFirst({
        where: {
          OR: [
            { leadCode: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingLead) {
        throw new Error('Manual ID already exists for a lead');
      }
      break;

    case 'deal':
      // Dealers only
      const existingDealer = await client.dealer.findFirst({
        where: {
          OR: [
            { dealerCode: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingDealer) {
        throw new Error('Manual ID already exists for a dealer');
      }
      break;

    case 'dl':
      // Deals only
      const existingDeal = await client.deal.findFirst({
        where: {
          OR: [
            { dealCode: trimmedId },
            { manualUniqueId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingDeal) {
        throw new Error('Manual ID already exists for a deal');
      }
      break;

    case 'emp':
      const existingEmp = await client.employee.findFirst({
        where: {
          OR: [
            { tid: trimmedId },
            { employeeId: trimmedId },
          ],
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (existingEmp) {
        throw new Error('Manual ID already exists for an employee');
      }
      break;

    default:
      throw new Error(`Unsupported module prefix: ${modulePrefix}`);
  }

  return true;
}

/**
 * Validate TID (Transaction ID) - must be unique across Property, Deal, Client, Lead, Employee, and Tenant
 * 
 * @param tid - Transaction ID to validate
 * @param excludePropertyId - Optional property ID to exclude from check (for updates)
 * @param excludeDealId - Optional deal ID to exclude from check (for updates)
 * @param excludeClientId - Optional client ID to exclude from check (for updates)
 * @param excludeLeadId - Optional lead ID to exclude from check (for updates)
 * @param excludeEmployeeId - Optional employee ID to exclude from check (for updates)
 * @param excludeTenantId - Optional tenant ID to exclude from check (for updates)
 * @param tx - Optional transaction client
 * @returns true if valid, throws error if invalid
 */
export async function validateTID(
  tid: string,
  excludePropertyId?: string,
  excludeDealId?: string,
  excludeClientId?: string,
  excludeLeadId?: string,
  excludeEmployeeId?: string,
  excludeTenantId?: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  if (!tid || tid.trim() === '') {
    throw new Error('TID is required');
  }

  const client = tx || prisma;
  const trimmedTid = tid.trim();

  // Check if tid column exists in each table before querying
  const [propertyTidExists, dealTidExists, clientTidExists, leadTidExists, employeeTidExists, tenantTidExists] = await Promise.all([
    columnExists('Property', 'tid'),
    columnExists('Deal', 'tid'),
    columnExists('Client', 'tid'),
    columnExists('Lead', 'tid'),
    columnExists('Employee', 'tid'),
    columnExists('Tenant', 'tid'),
  ]);

  // Check for conflicts across Property, Deal, Client, Lead, Employee, and Tenant
  // Only query tables where tid column exists
  const queries: Promise<any>[] = [];

  if (propertyTidExists) {
    queries.push(
      client.property.findFirst({
        where: {
          tid: trimmedTid,
          ...(excludePropertyId ? { id: { not: excludePropertyId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (dealTidExists) {
    queries.push(
      client.deal.findFirst({
        where: {
          tid: trimmedTid,
          isDeleted: false,
          deletedAt: null,
          ...(excludeDealId ? { id: { not: excludeDealId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (clientTidExists) {
    queries.push(
      client.client.findFirst({
        where: {
          tid: trimmedTid,
          isDeleted: false,
          ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (leadTidExists) {
    queries.push(
      client.lead.findFirst({
        where: {
          tid: trimmedTid,
          isDeleted: false,
          ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (employeeTidExists) {
    queries.push(
      client.employee.findFirst({
        where: {
          tid: trimmedTid,
          isDeleted: false,
          ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  if (tenantTidExists) {
    queries.push(
      client.tenant.findFirst({
        where: {
          tid: trimmedTid,
          isDeleted: false,
          ...(excludeTenantId ? { id: { not: excludeTenantId } } : {}),
        },
        select: { id: true, tid: true },
      })
    );
  } else {
    queries.push(Promise.resolve(null));
  }

  const [existingProperty, existingDeal, existingClient, existingLead, existingEmployee, existingTenant] = await Promise.all(queries);

  if (existingProperty) {
    throw new Error(`TID "${trimmedTid}" already exists for a property`);
  }
  if (existingDeal) {
    throw new Error(`TID "${trimmedTid}" already exists for a deal`);
  }
  if (existingClient) {
    throw new Error(`TID "${trimmedTid}" already exists for a client`);
  }
  if (existingLead) {
    throw new Error(`TID "${trimmedTid}" already exists for a lead`);
  }
  if (existingEmployee) {
    throw new Error(`TID "${trimmedTid}" already exists for an employee`);
  }
  if (existingTenant) {
    throw new Error(`TID "${trimmedTid}" already exists for a tenant`);
  }

  return true;
}

/**
 * Generate a prefixed ID for special cases like converted entities
 * Format: {customPrefix}-{XXXX}
 * Example: L-CLI-0001 for lead-converted clients
 *
 * @param customPrefix - The custom prefix (e.g., 'L-CLI')
 * @param entityType - The entity type for uniqueness checking
 * @param tx - Optional transaction client
 * @returns Generated prefixed ID
 */
export async function generatePrefixedId(
  customPrefix: string,
  entityType: ModulePrefix,
  tx?: Prisma.TransactionClient
): Promise<string> {
  // Use a sequence key for the custom prefix
  const sequencePrefix = `${customPrefix}-counter`;

  try {
    // Try to increment sequence
    const client = tx || prisma;
    const seq = await client.sequence.update({
      where: { prefix: sequencePrefix },
      data: { current: { increment: 1 } },
    });

    return `${customPrefix}-${seq.current.toString().padStart(4, '0')}`;
  } catch (error: any) {
    // If sequence not found, initialize it
    if (error.code === 'P2025') {
      const client = tx || prisma;

      // Find max existing ID with this prefix for the entity type
      let maxCounter = 0;

      switch (entityType) {
        case 'cli':
          const maxCli = await client.client.findFirst({
            where: { tid: { startsWith: customPrefix } },
            orderBy: { tid: 'desc' },
            select: { tid: true },
          });
          if (maxCli?.tid) {
            const counterStr = maxCli.tid.replace(customPrefix + '-', '');
            maxCounter = parseInt(counterStr, 10) || 0;
          }
          break;
        // Add other entity types if needed
        default:
          break;
      }

      const nextCounter = maxCounter + 1;

      // Create sequence starting at nextCounter
      const seq = await client.sequence.upsert({
        where: { prefix: sequencePrefix },
        create: { prefix: sequencePrefix, current: nextCounter },
        update: { current: { increment: 1 } },
      });

      return `${customPrefix}-${seq.current.toString().padStart(4, '0')}`;
    }
    throw error;
  }
}

/**
 * Extract year and counter from system ID
 * Useful for migration or analysis
 */
export function parseSystemId(systemId: string): { prefix: string; year: number; counter: number } | null {
  const match = systemId.match(/^([a-z]+)-(\d{2})-(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, prefix, yearStr, counterStr] = match;
  const year = 2000 + parseInt(yearStr, 10); // Convert YY to YYYY
  const counter = parseInt(counterStr, 10);

  return { prefix, year, counter };
}

