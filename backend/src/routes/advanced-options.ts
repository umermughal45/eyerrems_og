import express, { Response } from 'express';
import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../services/audit-log';
import { errorResponse } from '../utils/error-handler';

const router = (express as any).Router();

type ExportableTableKey =
  | 'properties'
  | 'deals'
  | 'ledger_entries'
  | 'transactions'
  | 'payments'
  | 'tenant_payments'
  | 'amenities'
  | 'dropdown_options';

const tableQueries: Record<ExportableTableKey, () => Promise<any[]>> = {
  properties: () => prisma.property.findMany({ where: { isDeleted: false } }),
  deals: () => prisma.deal.findMany({ where: { isDeleted: false } }),
  ledger_entries: () => prisma.ledgerEntry.findMany(),
  transactions: () => prisma.transaction.findMany(),
  payments: () => prisma.payment.findMany(),
  tenant_payments: () => prisma.tenantPayment.findMany(),
  amenities: () => prisma.amenity.findMany(),
  dropdown_options: () =>
    prisma.dropdownOption.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { category: true },
    }),
};

const supportedTables = Object.keys(tableQueries) as ExportableTableKey[];
const moduleLabels: Record<ExportableTableKey, string> = {
  properties: "properties",
  deals: "finance",
  ledger_entries: "finance",
  transactions: "finance",
  payments: "finance",
  tenant_payments: "tenant",
  amenities: "properties",
  dropdown_options: "admin",
};

const sanitize = (value: any) => {
  if (!value || typeof value !== 'object') return {};
  return JSON.parse(JSON.stringify(value));
};

const trySafeQuery = async (query: () => Promise<any[]>) => {
  try {
    return await query();
  } catch (error: any) {
    const message = error?.message?.toLowerCase() || ''
    if (message.includes('does not exist') || message.includes('relation') || message.includes('table')) {
      console.warn('Schema mismatch detected in advanced options route:', error?.message)
      return []
    }
    throw error;
  }
};

const getUserRoleName = async (req: AuthRequest) => {
  if (!req.user) return undefined;
  const role = await prisma.role.findUnique({
    where: { id: req.user.roleId },
  });
  return role?.name;
};

const logAudit = async (req: AuthRequest, data: Parameters<typeof createAuditLog>[0]) => {
  const roleName = await getUserRoleName(req);
  await createAuditLog({
    ...data,
    userId: req.user?.id,
    userName: req.user?.username,
    userRole: roleName || undefined,
    req,
  });
};

router.get('/dropdowns', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await trySafeQuery(() =>
      prisma.dropdownCategory.findMany({
        include: {
          options: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      })
    );
    res.json({ data: categories });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/dropdowns', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { key, name, description } = req.body;
    if (!key || !name) {
      return res.status(400).json({ error: 'Key and name are required' });
    }
    const category = await prisma.dropdownCategory.create({
      data: {
        key,
        name,
        description,
        createdBy: req.user?.id,
      },
    });
    await logAudit(req, {
      entityType: 'dropdown_category',
      entityId: category.id,
      action: 'create',
      description: `Dropdown category ${name} was created`,
      newValues: category,
    });
    res.status(201).json({ data: category });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// Central registry for all dropdowns (name, description, and defaults).
// This is the single source of truth for what categories should exist.
const DROPDOWN_REGISTRY: Record<
  string,
  {
    name: string;
    description?: string;
    defaults?: { label: string; value: string; sortOrder?: number }[];
  }
> = {
  // Properties
  'property.type': {
    name: 'Property Type',
    defaults: [
      { label: 'Residential', value: 'residential' },
      { label: 'Commercial', value: 'commercial' },
      { label: 'Industrial', value: 'industrial' },
      { label: 'Land', value: 'land' },
    ],
  },
  'property.category': {
    name: 'Property Category',
    defaults: [
      { label: 'Apartment', value: 'apartment' },
      { label: 'House', value: 'house' },
      { label: 'Villa', value: 'villa' },
      { label: 'Plot', value: 'plot' },
      { label: 'Shop', value: 'shop' },
      { label: 'Office', value: 'office' },
    ],
  },
  'property.status': {
    name: 'Property Status',
    defaults: [
      { label: 'Active', value: 'Active' },
      { label: 'Inactive', value: 'Inactive' },
      { label: 'Maintenance', value: 'Maintenance' },
      { label: 'Vacant', value: 'Vacant' },
      { label: 'Sold', value: 'Sold' },
    ],
  },
  'property.size': {
    name: 'Property Size',
    defaults: [
      { label: 'Small', value: 'small' },
      { label: 'Medium', value: 'medium' },
      { label: 'Large', value: 'large' },
    ],
  },

  // CRM - Deals
  'crm.deal.stage': {
    name: 'Deal Stage',
    defaults: [
      { label: 'Prospecting', value: 'prospecting' },
      { label: 'Qualified', value: 'qualified' },
      { label: 'Proposal', value: 'proposal' },
      { label: 'Negotiation', value: 'negotiation' },
      { label: 'Closing', value: 'closing' },
      { label: 'Closed Won', value: 'closed-won' },
      { label: 'Closed Lost', value: 'closed-lost' },
    ],
  },
  'crm.deal.status': {
    name: 'Deal Status',
    defaults: [
      { label: 'Open', value: 'open' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Won', value: 'won' },
      { label: 'Lost', value: 'lost' },
      { label: 'Cancelled', value: 'cancelled' },
    ],
  },

  // Finance
  'finance.payment.method': {
    name: 'Payment Method',
    defaults: [
      { label: 'Cash', value: 'cash' },
      { label: 'Bank Transfer', value: 'bank_transfer' },
      { label: 'Cheque', value: 'cheque' },
      { label: 'Card', value: 'card' },
    ],
  },

  // HR
  'employee.hr.department': {
    name: 'Department',
    description: 'Used to sync HR departments',
  },
};

// Map of dropdown keys to usage checkers to prevent deleting options in use.
type UsageChecker = (value: string) => Promise<boolean>;
const DROPDOWN_USAGE: Record<string, UsageChecker[]> = {
  'property.status': [
    async (value) => (await prisma.property.count({ where: { status: value } })) > 0,
  ],
  'property.type': [
    async (value) => (await prisma.property.count({ where: { type: value } })) > 0,
  ],
  'property.category': [
    async (value) => (await prisma.property.count({ where: { category: value } })) > 0,
  ],
  'property.size': [
    async (value) => (await prisma.property.count({ where: { size: value as any } })) > 0,
  ],

  'crm.deal.stage': [
    async (value) => (await prisma.deal.count({ where: { stage: value } })) > 0,
  ],
  'crm.deal.status': [
    async (value) => (await prisma.deal.count({ where: { status: value } })) > 0,
  ],

  'finance.payment.method': [
    async (value) => (await prisma.transaction.count({ where: { paymentMethod: value } })) > 0,
    async (value) => (await prisma.payroll.count({ where: { paymentMethod: value } })) > 0,
    async (value) => (await prisma.tenantPayment.count({ where: { method: value } })) > 0,
    async (value) => (await prisma.receipt.count({ where: { paymentMethod: value } })) > 0,
  ],

  'employee.hr.department': [
    async (value) => (await prisma.employee.count({ where: { department: value } })) > 0,
  ],
};

router.get('/dropdowns/:key([^/]+)', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const key = decodeURIComponent(req.params.key);

    // Try to load existing category with active options
    let category = await prisma.dropdownCategory.findUnique({
      where: { key },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Auto-create from registry (including defaults) if missing
    if (!category) {
      const registry = DROPDOWN_REGISTRY[key];
      if (registry) {
        category = await prisma.dropdownCategory.create({
          data: {
            key,
            name: registry.name,
            description: registry.description,
            options: {
              create: (registry.defaults || []).map((opt, idx) => ({
                label: opt.label,
                value: opt.value,
                sortOrder: typeof opt.sortOrder === 'number' ? opt.sortOrder : idx,
                isActive: true,
              })),
            },
          },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
      }
    }

    if (category) {
      return res.json({ data: category, options: category.options });
    }

    // If no registry entry and no DB record, return 404
    return res.status(404).json({ error: 'Category not found' });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/dropdowns/:key([^/]+)', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Decode the key in case it was URL encoded
    const key = decodeURIComponent(req.params.key);
    const { label, value, sortOrder, metadata, isActive } = req.body;
    if (!label || !value) {
      return res.status(400).json({ error: 'Label and value are required' });
    }
    const category = await prisma.dropdownCategory.findUnique({
      where: { key },
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const option = await prisma.dropdownOption.create({
      data: {
        label,
        value,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        metadata,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        categoryId: category.id,
      },
    });

    // Sync with Department table for employee departments
    if (key === 'employee.hr.department') {
      await prisma.department.upsert({
        where: { code: value },
        create: {
          code: value,
          name: label,
          description: `Auto-created from dropdown option`,
          isActive: typeof isActive === 'boolean' ? isActive : true,
        },
        update: {
          name: label,
          isActive: typeof isActive === 'boolean' ? isActive : true,
        },
      });
    }

    await logAudit(req, {
      entityType: 'dropdown_option',
      entityId: option.id,
      action: 'create',
      description: `Option "${label}" added to ${category.name}`,
      newValues: option,
    });
    res.status(201).json({ data: option });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.put('/dropdowns/options/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payload = sanitize(req.body);
    const existing = await prisma.dropdownOption.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Option not found' });
    }

    // Prevent changing value if the option is in use
    if (payload.value && payload.value !== existing.value) {
      const usageCheckers = DROPDOWN_USAGE[existing.category.key] || [];
      const used = await Promise.all(
        usageCheckers.map(async (fn) => (await fn(existing.value)) === true),
      ).then((results) => results.some(Boolean));

      if (used) {
        return res.status(400).json({
          error: 'Option value is in use and cannot be changed. You can edit the label or disable it.',
        });
      }
    }

    const updated = await prisma.dropdownOption.update({
      where: { id },
      data: {
        label: payload.label ?? existing.label,
        value: payload.value ?? existing.value,
        sortOrder: payload.sortOrder ?? existing.sortOrder,
        metadata: payload.metadata ?? existing.metadata,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : existing.isActive,
      },
    });

    // Sync with Department table for employee departments
    if (existing.category.key === 'employee.hr.department') {
      const newValue = payload.value ?? existing.value;
      const newLabel = payload.label ?? existing.label;
      const newIsActive =
        typeof payload.isActive === 'boolean' ? payload.isActive : existing.isActive;
      await prisma.department.upsert({
        where: { code: newValue },
        create: {
          code: newValue,
          name: newLabel,
          description: `Auto-created from dropdown option`,
          isActive: newIsActive,
        },
        update: {
          name: newLabel,
          isActive: newIsActive,
        },
      });
    }

    await logAudit(req, {
      entityType: 'dropdown_option',
      entityId: updated.id,
      action: 'update',
      description: `Dropdown option "${updated.label}" updated`,
      oldValues: existing,
      newValues: updated,
    });
    res.json({ data: updated });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.delete('/dropdowns/options/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.dropdownOption.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Option not found' });
    }

    const usageCheckers = DROPDOWN_USAGE[existing.category.key] || [];
    const used = await Promise.all(
      usageCheckers.map(async (fn) => (await fn(existing.value)) === true),
    ).then((results) => results.some(Boolean));

    if (used) {
      // Enforce soft-disable instead of delete when in use
      const updated = await prisma.dropdownOption.update({
        where: { id },
        data: { isActive: false },
      });
      await logAudit(req, {
        entityType: 'dropdown_option',
        entityId: updated.id,
        action: 'update',
        description: `Dropdown option "${updated.label}" marked inactive (in use)`,
        oldValues: existing,
        newValues: updated,
      });
      return res.status(200).json({
        data: updated,
        warning: 'Option is in use and was marked inactive instead of being deleted.',
      });
    }

    // Sync with Department table for employee departments - deactivate instead of delete
    if (existing.category.key === 'employee.hr.department') {
      await prisma.department.updateMany({
        where: { code: existing.value },
        data: { isActive: false },
      });
    }

    await prisma.dropdownOption.delete({ where: { id } });
    await logAudit(req, {
      entityType: 'dropdown_option',
      entityId: existing.id,
      action: 'delete',
      description: `Dropdown option "${existing.label}" removed`,
      oldValues: existing,
    });
    res.status(204).end();
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.get('/amenities', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const list = await trySafeQuery(() =>
      prisma.amenity.findMany({
        orderBy: { name: 'asc' },
      })
    );
    res.json({ data: list });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/amenities', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, icon, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Amenity name is required' });
    }
    const amenity = await prisma.amenity.create({
      data: {
        name,
        description,
        icon,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });
    await logAudit(req, {
      entityType: 'amenity',
      entityId: amenity.id,
      action: 'create',
      description: `Amenity "${name}" added`,
      newValues: amenity,
    });
    res.status(201).json({ data: amenity });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.put('/amenities/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payload = sanitize(req.body);
    const existing = await prisma.amenity.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Amenity not found' });
    }
    const updated = await prisma.amenity.update({
      where: { id },
      data: {
        name: payload.name ?? existing.name,
        description: payload.description ?? existing.description,
        icon: payload.icon ?? existing.icon,
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : existing.isActive,
      },
    });
    await logAudit(req, {
      entityType: 'amenity',
      entityId: updated.id,
      action: 'update',
      description: `Amenity "${updated.name}" updated`,
      oldValues: existing,
      newValues: updated,
    });
    res.json({ data: updated });
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.delete('/amenities/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.amenity.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Amenity not found' });
    }
    await prisma.amenity.delete({ where: { id } });
    await logAudit(req, {
      entityType: 'amenity',
      entityId: existing.id,
      action: 'delete',
      description: `Amenity "${existing.name}" removed`,
      oldValues: existing,
    });
    res.status(204).end();
  } catch (error) {
    return errorResponse(res, error);
  }
});

router.post('/export', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { tables } = req.body;
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: 'At least one table must be specified' });
    }
    const requested: ExportableTableKey[] = [];
    for (const table of tables) {
      if (supportedTables.includes(table as ExportableTableKey)) {
        requested.push(table as ExportableTableKey);
      }
    }
    if (requested.length === 0) {
      return res.status(400).json({ error: 'No supported tables were provided' });
    }
    const datasets: Record<string, any[]> = {};
    await Promise.all(
      requested.map(async (table) => {
        const records = await trySafeQuery(() => tableQueries[table]());
        datasets[table] = records.map((record) => sanitize(record));
      }),
    );
    res.json({
      generatedAt: new Date().toISOString(),
      tables: datasets,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

interface ImportSummary {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
}

const importHelpers: Record<ExportableTableKey, (tx: Prisma.TransactionClient, payload: any) => Promise<void>> = {
  properties: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.property.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.property.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.property.create({ data: row });
  },
  deals: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.deal.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.deal.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.deal.create({ data: row });
  },
  ledger_entries: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.ledgerEntry.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.ledgerEntry.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.ledgerEntry.create({ data: row });
  },
  transactions: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.transaction.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.transaction.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.transaction.create({ data: row });
  },
  payments: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.payment.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.payment.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.payment.create({ data: row });
  },
  tenant_payments: async (tx, payload) => {
    const row = sanitize(payload);
    if (row.id) {
      const existing = await tx.tenantPayment.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.tenantPayment.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.tenantPayment.create({ data: row });
  },
  amenities: async (tx, payload) => {
    const row = sanitize(payload);
    if (!row.name) {
      throw new Error('Amenity name is required');
    }
    await tx.amenity.upsert({
      where: { name: row.name },
      create: row,
      update: row,
    });
  },
  dropdown_options: async (tx, payload) => {
    const row = sanitize(payload);
    if (!row.value || !row.label || !row.categoryId) {
      throw new Error('Dropdown option must include value, label, and categoryId');
    }
    if (row.id) {
      const existing = await tx.dropdownOption.findUnique({ where: { id: row.id } });
      if (existing) {
        await tx.dropdownOption.update({ where: { id: row.id }, data: row });
        return;
      }
    }
    await tx.dropdownOption.create({ data: row });
  },
};

router.post('/import', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { table, rows } = req.body;
    if (!table || !supportedTables.includes(table as ExportableTableKey)) {
      return res.status(400).json({ error: 'Unsupported table name' });
    }
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Rows must be an array' });
    }
    const summary: ImportSummary = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };
    await prisma.$transaction(async (tx) => {
      for (const [index, row] of rows.entries()) {
        try {
          await importHelpers[table as ExportableTableKey](tx, row);
          const identifier = row?.id || row?.name || `row-${index + 1}`;
          if (row?.id) {
            summary.updated += 1;
          } else {
            summary.inserted += 1;
          }
        } catch (error: any) {
          summary.failed += 1;
          summary.errors.push(`Row ${index + 1}: ${error?.message || 'Failed to import row'}`);
        }
      }
    });
    await logAudit(req, {
      entityType: `table.${table}`,
      entityId: table,
      action: 'update',
      description: `Imported ${rows.length} rows into ${table}`,
      metadata: summary,
    });
    res.json({ success: true, summary });
  } catch (error) {
    return errorResponse(res, error);
  }
});

const csvHeader = "module,table,payload";

router.get('/export/full-csv', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const rows: string[] = [csvHeader];
    for (const tableKey of supportedTables) {
      const dataset = await trySafeQuery(() => tableQueries[tableKey]())
      const moduleName = moduleLabels[tableKey] || "general"
      for (const record of dataset) {
        const payload = JSON.stringify(record)
          .replace(/"/g, '""')
        rows.push(`${moduleName},${tableKey},"${payload}"`)
      }
    }
    const csv = rows.join("\n")
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="rems-full-backup.csv"')
    res.send(csv)
  } catch (error) {
    return errorResponse(res, error)
  }
})

router.post('/import/full-csv', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { csv } = req.body
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV payload required' })
    }

    const lines = csv.trim().split(/\r?\n/)
    if (!lines.length || lines[0] !== csvHeader) {
      return res.status(400).json({ error: 'Invalid CSV header' })
    }

    const summary: ImportSummary = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: [],
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        const firstComma = line.indexOf(',')
        const secondComma = line.indexOf(',', firstComma + 1)
        if (firstComma === -1 || secondComma === -1) {
          summary.failed += 1
          summary.errors!.push(`Line ${i + 1}: invalid format`)
          continue
        }
        const table = line.slice(firstComma + 1, secondComma)
        let payload = line.slice(secondComma + 1)
        if (payload.startsWith('"') && payload.endsWith('"')) {
          payload = payload.slice(1, -1).replace(/""/g, '"')
        }
        try {
          const parsed = JSON.parse(payload)
          if (!supportedTables.includes(table as ExportableTableKey)) {
            summary.failed += 1
            summary.errors!.push(`Line ${i + 1}: unsupported table ${table}`)
            continue
          }
          await importHelpers[table as ExportableTableKey](tx, parsed)
          if (parsed?.id) {
            summary.updated += 1
          } else {
            summary.inserted += 1
          }
        } catch (error: any) {
          summary.failed += 1
          summary.errors!.push(`Line ${i + 1}: ${error?.message || 'JSON parse error'}`)
        }
      }
    })

    await logAudit(req, {
      entityType: 'export.full',
      entityId: 'full-csv',
      action: 'update',
      description: 'Imported full CSV backup',
      metadata: summary,
    })

    res.json({ success: true, summary })
  } catch (error) {
    return errorResponse(res, error)
  }
})

export default router;

