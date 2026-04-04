import prisma from '../prisma/client';
import { Readable } from 'stream';
import { parse as csvParse } from 'csv-parse';
import type { Request } from 'express';
import { generateSystemId } from './id-generation-service';
import { createAuditLog } from './audit-log';
import { z } from 'zod';

export type LeadImportAssignmentMode = 'CSV_DEFINED' | 'AUTO_ASSIGN' | 'UNASSIGNED';

export interface LeadImportUploadContext {
  userId: string;
  fileName: string;
  filePath: string;
  fileHash: string;
  buffer: Buffer;
  assignmentMode: LeadImportAssignmentMode;
  rowLimit: number;
}

export const LEAD_IMPORT_REQUIRED_HEADERS = [
  'Full Name',
  'Phone',
  'Email',
  'CNIC',
  'Lead Source',
  'Source Details',
  'Dealer TID',
  'Dealer Email',
  'Notes',
] as const;

type CsvRow = Record<string, string>;

type LeadImportRowError = {
  code: string;
  field?: string;
  message: string;
  relatedRow?: number;
  entityId?: string;
};

type ValidatorUser = {
  id: string;
  username?: string;
  roleName?: string;
};

function normalizeHeaderKey(value: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const CANONICAL_HEADER_MAP: Record<string, (typeof LEAD_IMPORT_REQUIRED_HEADERS)[number]> = Object.fromEntries(
  LEAD_IMPORT_REQUIRED_HEADERS.map((h) => [normalizeHeaderKey(h), h])
) as any;

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, '').trim();
  const normalized = digits.startsWith('+') ? `+${digits.replace(/[^\d]/g, '')}` : digits.replace(/[^\d]/g, '');
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

const leadImportRowSchema = z.object({
  'Full Name': z.string().optional().transform(v => v?.trim() || ''),
  'Phone': z.string().optional().transform(v => v?.trim() || ''),
  'Email': z.string().optional().transform(v => v?.trim() || ''),
  'CNIC': z.string().optional().transform(v => v?.trim() || ''),
  'Lead Source': z.string().optional().transform(v => v?.trim() || ''),
  'Source Details': z.string().optional().transform(v => v?.trim() || ''),
  'Dealer TID': z.string().optional().transform(v => v?.trim() || ''),
  'Dealer Email': z.string().optional().transform(v => v?.trim() || ''),
  'Notes': z.string().optional().transform(v => v?.trim() || ''),
});

export async function parseLeadImportCsv(buffer: Buffer, rowLimit: number): Promise<{ header: string[]; rows: CsvRow[] }> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    let header: string[] | null = null;
    const requiredNormalized = new Set(Object.keys(CANONICAL_HEADER_MAP));

    const parser = csvParse({
      bom: true,
      columns: (hdrs: string[]) => {
        header = hdrs;
        const providedNormalized = new Set(hdrs.map(h => normalizeHeaderKey(h)));
        const missing = Array.from(requiredNormalized).filter(k => !providedNormalized.has(k));
        if (missing.length > 0) {
          const missingCanonical = missing.map(k => CANONICAL_HEADER_MAP[k]);
          throw new Error(`Invalid CSV headers. Missing: ${missingCanonical.join(', ')}`);
        }

        // Normalize to canonical keys; ignore unexpected headers by returning null
        return hdrs.map((h) => {
          const key = normalizeHeaderKey(h);
          return CANONICAL_HEADER_MAP[key] || null;
        });
      },
      trim: true,
      skip_empty_lines: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        rows.push(record);
        if (rows.length > rowLimit) {
          parser.destroy(new Error(`Row limit exceeded (${rowLimit}). Please split the file into smaller batches.`));
          return;
        }
      }
    });

    parser.on('error', (err: Error) => {
      reject(err);
    });

    parser.on('end', () => {
      if (!header) {
        return reject(new Error('Missing header row in CSV file.'));
      }
      resolve({ header, rows });
    });

    Readable.from(buffer).pipe(parser);
  });
}

export async function createLeadImportBatch(ctx: LeadImportUploadContext) {
  const { buffer, rowLimit } = ctx;

  const { header, rows } = await parseLeadImportCsv(buffer, rowLimit);

  // Create batch
  const batch = await prisma.leadImportBatch.create({
    data: {
      fileName: ctx.fileName,
      fileHash: ctx.fileHash,
      filePath: ctx.filePath,
      rowCount: rows.length,
      status: 'uploaded',
      createdByUserId: ctx.userId,
    },
  });

  // Insert raw rows
  const rowData = rows.map((raw, index) => {
    const parsed = leadImportRowSchema.parse(raw);
    return {
      batchId: batch.id,
      rowNumber: index + 2, // account for header row
      fullName: parsed['Full Name'] || null,
      phone: parsed['Phone'] || null,
      email: parsed['Email'] || null,
      cnic: parsed['CNIC'] || null,
      leadSource: parsed['Lead Source'] || null,
      sourceDetails: parsed['Source Details'] || null,
      dealerTid: parsed['Dealer TID'] || null,
      dealerEmail: parsed['Dealer Email'] || null,
      notes: parsed['Notes'] || null,
      status: 'PENDING',
      duplicateOfLeadId: null,
      duplicateOfClientId: null,
      resolvedDealerId: null,
      assignmentMode: null,
      createdLeadId: null,
    };
  });

  // Bulk insert in chunks
  const chunkSize = 500;
  for (let i = 0; i < rowData.length; i += chunkSize) {
    const chunk = rowData.slice(i, i + chunkSize);
    await prisma.leadImportRow.createMany({ data: chunk });
  }

  return batch;
}

export async function validateLeadImportBatch(batchId: string, validatorUser: ValidatorUser) {
  const batch = await prisma.leadImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: true },
  });

  if (!batch) {
    throw new Error('Lead import batch not found');
  }
  if (batch.status === 'committed') {
    throw new Error('This import batch has already been committed and cannot be re-validated.');
  }

  const rows = batch.rows;
  const rowUpdates = new Map<string, { status: 'READY' | 'INVALID' | 'DUPLICATE'; errors: LeadImportRowError[]; resolvedDealerId: string | null; duplicateOfLeadId: string | null; duplicateOfClientId: string | null }>();

  // Pre-compute normalized keys for duplicate detection and system lookups
  const rowById = new Map(rows.map(r => [r.id, r]));
  const rowKey = rows.map(r => ({
    id: r.id,
    rowNumber: r.rowNumber,
    phone: normalizePhone(r.phone),
    email: normalizeEmail(r.email),
  }));

  // Load existing system duplicates (bulk, by phone/email)
  const phones = Array.from(new Set(rowKey.map(r => r.phone).filter(Boolean))) as string[];
  const emails = Array.from(new Set(rowKey.map(r => r.email).filter(Boolean))) as string[];

  const [existingLeadsByPhone, existingLeadsByEmail, existingClientsByPhone, existingClientsByEmail] = await Promise.all([
    phones.length
      ? prisma.lead.findMany({ where: { isDeleted: false, phone: { in: phones } }, select: { id: true, phone: true } })
      : Promise.resolve([]),
    emails.length
      ? prisma.lead.findMany({ where: { isDeleted: false, email: { in: emails } }, select: { id: true, email: true } })
      : Promise.resolve([]),
    phones.length
      ? prisma.client.findMany({ where: { isDeleted: false, phone: { in: phones } }, select: { id: true, phone: true } })
      : Promise.resolve([]),
    emails.length
      ? prisma.client.findMany({ where: { isDeleted: false, email: { in: emails } }, select: { id: true, email: true } })
      : Promise.resolve([]),
  ]);

  const leadByPhone = new Map<string, string>();
  for (const l of existingLeadsByPhone) {
    if (l.phone) leadByPhone.set(normalizePhone(l.phone) || l.phone, l.id);
  }
  const leadByEmail = new Map<string, string>();
  for (const l of existingLeadsByEmail) {
    if (l.email) leadByEmail.set(normalizeEmail(l.email) || l.email, l.id);
  }
  const clientByPhone = new Map<string, string>();
  for (const c of existingClientsByPhone) {
    if (c.phone) clientByPhone.set(normalizePhone(c.phone) || c.phone, c.id);
  }
  const clientByEmail = new Map<string, string>();
  for (const c of existingClientsByEmail) {
    if (c.email) clientByEmail.set(normalizeEmail(c.email) || c.email, c.id);
  }

  // Within-batch duplicates (all involved rows must be flagged)
  const phoneToRowNumbers = new Map<string, number[]>();
  const emailToRowNumbers = new Map<string, number[]>();
  for (const r of rowKey) {
    if (r.phone) phoneToRowNumbers.set(r.phone, [...(phoneToRowNumbers.get(r.phone) || []), r.rowNumber]);
    if (r.email) emailToRowNumbers.set(r.email, [...(emailToRowNumbers.get(r.email) || []), r.rowNumber]);
  }

  // Dealer resolution cache
  const dealerByTid = new Map<string, string | 'AMBIGUOUS' | null>();
  const dealerByEmail = new Map<string, string | 'AMBIGUOUS' | null>();

  for (const row of rows) {
    const errors: LeadImportRowError[] = [];
    let status: 'READY' | 'INVALID' | 'DUPLICATE' = 'READY';

    const fullName = (row.fullName || '').trim();
    const phone = (row.phone || '').trim();
    const leadSource = (row.leadSource || '').trim();
    const dealerTid = (row.dealerTid || '').trim();
    const dealerEmail = (row.dealerEmail || '').trim();

    // DB invariant: Lead.name is required
    if (!fullName) {
      status = 'INVALID';
      errors.push({ code: 'REQUIRED_FULL_NAME', field: 'fullName', message: 'Full Name is required.' });
    }
    if (!phone) {
      status = 'INVALID';
      errors.push({ code: 'REQUIRED_PHONE', field: 'phone', message: 'Phone is required.' });
    }
    if (!leadSource) {
      status = 'INVALID';
      errors.push({ code: 'REQUIRED_LEAD_SOURCE', field: 'leadSource', message: 'Lead Source is required.' });
    }

    // Dealer rules
    let resolvedDealerId: string | null = null;
    if (dealerTid && dealerEmail) {
      status = 'INVALID';
      errors.push({
        code: 'DEALER_REFERENCE_CONFLICT',
        field: 'dealer',
        message: 'Provide either Dealer TID or Dealer Email, not both.',
      });
    } else if (dealerTid || dealerEmail) {
      if (dealerTid) {
        const key = dealerTid.trim();
        if (!dealerByTid.has(key)) {
          const matches = await prisma.dealer.findMany({
            where: { tid: key, isActive: true, isDeleted: false },
            select: { id: true },
            take: 2,
          });
          dealerByTid.set(key, matches.length === 1 ? matches[0].id : matches.length > 1 ? 'AMBIGUOUS' : null);
        }
        const resolved = dealerByTid.get(key);
        if (resolved === 'AMBIGUOUS') {
          status = 'INVALID';
          errors.push({ code: 'DEALER_AMBIGUOUS', field: 'dealerTid', message: `Multiple active dealers found for TID "${key}".` });
        } else if (!resolved) {
          status = 'INVALID';
          errors.push({ code: 'DEALER_NOT_FOUND', field: 'dealerTid', message: `No active dealer found for TID "${key}".` });
        } else {
          resolvedDealerId = resolved;
        }
      } else if (dealerEmail) {
        const key = dealerEmail.trim().toLowerCase();
        if (!dealerByEmail.has(key)) {
          const matches = await prisma.dealer.findMany({
            where: { email: key, isActive: true, isDeleted: false },
            select: { id: true },
            take: 2,
          });
          dealerByEmail.set(key, matches.length === 1 ? matches[0].id : matches.length > 1 ? 'AMBIGUOUS' : null);
        }
        const resolved = dealerByEmail.get(key);
        if (resolved === 'AMBIGUOUS') {
          status = 'INVALID';
          errors.push({ code: 'DEALER_AMBIGUOUS', field: 'dealerEmail', message: `Multiple active dealers found for Email "${key}".` });
        } else if (!resolved) {
          status = 'INVALID';
          errors.push({ code: 'DEALER_NOT_FOUND', field: 'dealerEmail', message: `No active dealer found for Email "${key}".` });
        } else {
          resolvedDealerId = resolved;
        }
      }
    }

    // Duplicates within file (flag all rows involved)
    const nPhone = normalizePhone(row.phone);
    const nEmail = normalizeEmail(row.email);
    if (nPhone) {
      const dups = phoneToRowNumbers.get(nPhone) || [];
      if (dups.length > 1) {
        status = 'DUPLICATE';
        for (const otherRow of dups) {
          if (otherRow !== row.rowNumber) {
            errors.push({ code: 'DUPLICATE_IN_FILE_PHONE', field: 'phone', message: 'Duplicate phone found within uploaded file.', relatedRow: otherRow });
          }
        }
      }
    }
    if (nEmail) {
      const dups = emailToRowNumbers.get(nEmail) || [];
      if (dups.length > 1) {
        status = 'DUPLICATE';
        for (const otherRow of dups) {
          if (otherRow !== row.rowNumber) {
            errors.push({ code: 'DUPLICATE_IN_FILE_EMAIL', field: 'email', message: 'Duplicate email found within uploaded file.', relatedRow: otherRow });
          }
        }
      }
    }

    // Duplicates against system data (leads/clients)
    let duplicateOfLeadId: string | null = null;
    let duplicateOfClientId: string | null = null;

    if (nPhone && leadByPhone.has(nPhone)) {
      status = 'DUPLICATE';
      duplicateOfLeadId = leadByPhone.get(nPhone) || null;
      errors.push({ code: 'DUPLICATE_EXISTING_LEAD_PHONE', field: 'phone', message: 'Phone already exists on an existing lead.', entityId: duplicateOfLeadId || undefined });
    }
    if (nEmail && leadByEmail.has(nEmail)) {
      status = 'DUPLICATE';
      duplicateOfLeadId = duplicateOfLeadId || leadByEmail.get(nEmail) || null;
      errors.push({ code: 'DUPLICATE_EXISTING_LEAD_EMAIL', field: 'email', message: 'Email already exists on an existing lead.', entityId: (leadByEmail.get(nEmail) || undefined) });
    }
    if (nPhone && clientByPhone.has(nPhone)) {
      status = 'DUPLICATE';
      duplicateOfClientId = clientByPhone.get(nPhone) || null;
      errors.push({ code: 'DUPLICATE_EXISTING_CLIENT_PHONE', field: 'phone', message: 'Phone already exists on an existing client.', entityId: duplicateOfClientId || undefined });
    }
    if (nEmail && clientByEmail.has(nEmail)) {
      status = 'DUPLICATE';
      duplicateOfClientId = duplicateOfClientId || clientByEmail.get(nEmail) || null;
      errors.push({ code: 'DUPLICATE_EXISTING_CLIENT_EMAIL', field: 'email', message: 'Email already exists on an existing client.', entityId: (clientByEmail.get(nEmail) || undefined) });
    }

    rowUpdates.set(row.id, { status, errors, resolvedDealerId, duplicateOfLeadId, duplicateOfClientId });
  }

  // Persist row updates + batch counts atomically
  const counts = { READY: 0, DUPLICATE: 0, INVALID: 0 };
  for (const u of rowUpdates.values()) counts[u.status]++;

  const summary = {
    batchId,
    validatedAt: new Date().toISOString(),
    validatedByUserId: validatorUser.id,
    validatedByUserName: validatorUser.username,
    validatedByRole: validatorUser.roleName,
    totals: {
      rowCount: batch.rowCount,
      readyCount: counts.READY,
      duplicateCount: counts.DUPLICATE,
      invalidCount: counts.INVALID,
    },
  };

  await prisma.$transaction(async (tx) => {
    for (const [rowId, u] of rowUpdates.entries()) {
      await tx.leadImportRow.update({
        where: { id: rowId },
        data: {
          status: u.status,
          errors: u.errors.length > 0 ? u.errors : undefined,
          resolvedDealerId: u.resolvedDealerId,
          duplicateOfLeadId: u.duplicateOfLeadId,
          duplicateOfClientId: u.duplicateOfClientId,
        },
      });
    }
    await tx.leadImportBatch.update({
      where: { id: batchId },
      data: {
        readyCount: counts.READY,
        duplicateCount: counts.DUPLICATE,
        invalidCount: counts.INVALID,
        status: 'validated',
        errorSummary: JSON.stringify(summary),
      },
    });
  });

  return {
    batchId,
    status: 'validated' as const,
    rowCount: batch.rowCount,
    readyCount: counts.READY,
    duplicateCount: counts.DUPLICATE,
    invalidCount: counts.INVALID,
  };
}

export async function commitLeadImportBatch(batchId: string, approverUser: ValidatorUser, req?: Request) {
  const batch = await prisma.leadImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: true },
  });

  if (!batch) {
    throw new Error('Lead import batch not found');
  }
  if (batch.status === 'committed') {
    throw new Error('This import batch has already been committed and is immutable.');
  }
  if (batch.status !== 'validated') {
    throw new Error('Import batch must be validated before commit.');
  }

  const readyRows = batch.rows.filter(r => r.status === 'READY');

  const created: Array<{ rowId: string; rowNumber: number; leadId: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of readyRows) {
      const leadCode = await generateSystemId('lead', tx);

      const lead = await tx.lead.create({
        data: {
          name: (row.fullName || '').trim(),
          phone: row.phone || null,
          email: row.email || null,
          cnic: row.cnic || null,
          source: row.leadSource || null,
          leadSourceDetails: row.sourceDetails || null,
          notes: row.notes || null,
          assignedDealerId: row.resolvedDealerId || null,
          leadCode,
          createdBy: approverUser.id,
        },
      });

      await tx.leadImportRow.update({
        where: { id: row.id },
        data: { createdLeadId: lead.id },
      });

      created.push({ rowId: row.id, rowNumber: row.rowNumber, leadId: lead.id });

      await createAuditLog({
        entityType: 'lead',
        entityId: lead.id,
        action: 'import',
        userId: approverUser.id,
        userName: approverUser.username,
        userRole: approverUser.roleName,
        description: 'Lead created via approved CSV import',
        metadata: { batchId, rowNumber: row.rowNumber },
        req,
      });
    }

    const summary = {
      batchId,
      committedAt: new Date().toISOString(),
      committedByUserId: approverUser.id,
      committedByUserName: approverUser.username,
      committedByRole: approverUser.roleName,
      totals: {
        rowCount: batch.rowCount,
        readyProcessed: created.length,
        duplicateCount: batch.duplicateCount,
        invalidCount: batch.invalidCount,
      },
    };

    await tx.leadImportBatch.update({
      where: { id: batchId },
      data: {
        status: 'committed',
        committedAt: new Date(),
        errorSummary: JSON.stringify(summary),
      },
    });
  });

  return {
    batchId,
    status: 'committed' as const,
    rowCount: batch.rowCount,
    committedLeads: created.length,
  };
}

