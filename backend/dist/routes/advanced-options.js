"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const audit_log_1 = require("../services/audit-log");
const error_handler_1 = require("../utils/error-handler");
const router = express_1.default.Router();
const tableQueries = {
    properties: () => client_1.default.property.findMany({ where: { isDeleted: false } }),
    deals: () => client_1.default.deal.findMany({ where: { isDeleted: false } }),
    ledger_entries: () => client_1.default.ledgerEntry.findMany(),
    transactions: () => client_1.default.transaction.findMany(),
    payments: () => client_1.default.payment.findMany(),
    tenant_payments: () => client_1.default.tenantPayment.findMany(),
    amenities: () => client_1.default.amenity.findMany(),
    dropdown_options: () => client_1.default.dropdownOption.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { category: true },
    }),
};
const supportedTables = Object.keys(tableQueries);
const moduleLabels = {
    properties: "properties",
    deals: "finance",
    ledger_entries: "finance",
    transactions: "finance",
    payments: "finance",
    tenant_payments: "tenant",
    amenities: "properties",
    dropdown_options: "admin",
};
const sanitize = (value) => {
    if (!value || typeof value !== 'object')
        return {};
    return JSON.parse(JSON.stringify(value));
};
const trySafeQuery = async (query) => {
    try {
        return await query();
    }
    catch (error) {
        const message = error?.message?.toLowerCase() || '';
        if (message.includes('does not exist') || message.includes('relation') || message.includes('table')) {
            console.warn('Schema mismatch detected in advanced options route:', error?.message);
            return [];
        }
        throw error;
    }
};
const getUserRoleName = async (req) => {
    if (!req.user)
        return undefined;
    const role = await client_1.default.role.findUnique({
        where: { id: req.user.roleId },
    });
    return role?.name;
};
const logAudit = async (req, data) => {
    const roleName = await getUserRoleName(req);
    await (0, audit_log_1.createAuditLog)({
        ...data,
        userId: req.user?.id,
        userName: req.user?.username,
        userRole: roleName || undefined,
        req,
    });
};
router.get('/dropdowns', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const categories = await trySafeQuery(() => client_1.default.dropdownCategory.findMany({
            include: {
                options: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
            orderBy: { name: 'asc' },
        }));
        res.json({ data: categories });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.post('/dropdowns', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { key, name, description } = req.body;
        if (!key || !name) {
            return res.status(400).json({ error: 'Key and name are required' });
        }
        const category = await client_1.default.dropdownCategory.create({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Central registry for all dropdowns (name, description, and defaults).
// This is the single source of truth for what categories should exist.
const DROPDOWN_REGISTRY = {
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
const DROPDOWN_USAGE = {
    'property.status': [
        async (value) => (await client_1.default.property.count({ where: { status: value } })) > 0,
    ],
    'property.type': [
        async (value) => (await client_1.default.property.count({ where: { type: value } })) > 0,
    ],
    'property.category': [
        async (value) => (await client_1.default.property.count({ where: { category: value } })) > 0,
    ],
    'property.size': [
        async (value) => (await client_1.default.property.count({ where: { size: value } })) > 0,
    ],
    'crm.deal.stage': [
        async (value) => (await client_1.default.deal.count({ where: { stage: value } })) > 0,
    ],
    'crm.deal.status': [
        async (value) => (await client_1.default.deal.count({ where: { status: value } })) > 0,
    ],
    'finance.payment.method': [
        async (value) => (await client_1.default.transaction.count({ where: { paymentMethod: value } })) > 0,
        async (value) => (await client_1.default.payroll.count({ where: { paymentMethod: value } })) > 0,
        async (value) => (await client_1.default.tenantPayment.count({ where: { method: value } })) > 0,
        async (value) => (await client_1.default.receipt.count({ where: { paymentMethod: value } })) > 0,
    ],
    'employee.hr.department': [
        async (value) => (await client_1.default.employee.count({ where: { department: value } })) > 0,
    ],
};
router.get('/dropdowns/:key([^/]+)', auth_1.authenticate, async (req, res) => {
    try {
        const key = decodeURIComponent(req.params.key);
        // Try to load existing category with active options
        let category = await client_1.default.dropdownCategory.findUnique({
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
                category = await client_1.default.dropdownCategory.create({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.post('/dropdowns/:key([^/]+)', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        // Decode the key in case it was URL encoded
        const key = decodeURIComponent(req.params.key);
        const { label, value, sortOrder, metadata, isActive } = req.body;
        if (!label || !value) {
            return res.status(400).json({ error: 'Label and value are required' });
        }
        const category = await client_1.default.dropdownCategory.findUnique({
            where: { key },
        });
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        const option = await client_1.default.dropdownOption.create({
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
            await client_1.default.department.upsert({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.put('/dropdowns/options/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const payload = sanitize(req.body);
        const existing = await client_1.default.dropdownOption.findUnique({
            where: { id },
            include: { category: true },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Option not found' });
        }
        // Prevent changing value if the option is in use
        if (payload.value && payload.value !== existing.value) {
            const usageCheckers = DROPDOWN_USAGE[existing.category.key] || [];
            const used = await Promise.all(usageCheckers.map(async (fn) => (await fn(existing.value)) === true)).then((results) => results.some(Boolean));
            if (used) {
                return res.status(400).json({
                    error: 'Option value is in use and cannot be changed. You can edit the label or disable it.',
                });
            }
        }
        const updated = await client_1.default.dropdownOption.update({
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
            const newIsActive = typeof payload.isActive === 'boolean' ? payload.isActive : existing.isActive;
            await client_1.default.department.upsert({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.delete('/dropdowns/options/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await client_1.default.dropdownOption.findUnique({
            where: { id },
            include: { category: true },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Option not found' });
        }
        const usageCheckers = DROPDOWN_USAGE[existing.category.key] || [];
        const used = await Promise.all(usageCheckers.map(async (fn) => (await fn(existing.value)) === true)).then((results) => results.some(Boolean));
        if (used) {
            // Enforce soft-disable instead of delete when in use
            const updated = await client_1.default.dropdownOption.update({
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
            await client_1.default.department.updateMany({
                where: { code: existing.value },
                data: { isActive: false },
            });
        }
        await client_1.default.dropdownOption.delete({ where: { id } });
        await logAudit(req, {
            entityType: 'dropdown_option',
            entityId: existing.id,
            action: 'delete',
            description: `Dropdown option "${existing.label}" removed`,
            oldValues: existing,
        });
        res.status(204).end();
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.get('/amenities', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const list = await trySafeQuery(() => client_1.default.amenity.findMany({
            orderBy: { name: 'asc' },
        }));
        res.json({ data: list });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.post('/amenities', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, isActive } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Amenity name is required' });
        }
        const amenity = await client_1.default.amenity.create({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.put('/amenities/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const payload = sanitize(req.body);
        const existing = await client_1.default.amenity.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Amenity not found' });
        }
        const updated = await client_1.default.amenity.update({
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.delete('/amenities/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await client_1.default.amenity.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Amenity not found' });
        }
        await client_1.default.amenity.delete({ where: { id } });
        await logAudit(req, {
            entityType: 'amenity',
            entityId: existing.id,
            action: 'delete',
            description: `Amenity "${existing.name}" removed`,
            oldValues: existing,
        });
        res.status(204).end();
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.post('/export', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { tables } = req.body;
        if (!Array.isArray(tables) || tables.length === 0) {
            return res.status(400).json({ error: 'At least one table must be specified' });
        }
        const requested = [];
        for (const table of tables) {
            if (supportedTables.includes(table)) {
                requested.push(table);
            }
        }
        if (requested.length === 0) {
            return res.status(400).json({ error: 'No supported tables were provided' });
        }
        const datasets = {};
        await Promise.all(requested.map(async (table) => {
            const records = await trySafeQuery(() => tableQueries[table]());
            datasets[table] = records.map((record) => sanitize(record));
        }));
        res.json({
            generatedAt: new Date().toISOString(),
            tables: datasets,
        });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
const importHelpers = {
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
router.post('/import', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { table, rows } = req.body;
        if (!table || !supportedTables.includes(table)) {
            return res.status(400).json({ error: 'Unsupported table name' });
        }
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Rows must be an array' });
        }
        const summary = {
            inserted: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        await client_1.default.$transaction(async (tx) => {
            for (const [index, row] of rows.entries()) {
                try {
                    await importHelpers[table](tx, row);
                    const identifier = row?.id || row?.name || `row-${index + 1}`;
                    if (row?.id) {
                        summary.updated += 1;
                    }
                    else {
                        summary.inserted += 1;
                    }
                }
                catch (error) {
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
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
const csvHeader = "module,table,payload";
router.get('/export/full-csv', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const rows = [csvHeader];
        for (const tableKey of supportedTables) {
            const dataset = await trySafeQuery(() => tableQueries[tableKey]());
            const moduleName = moduleLabels[tableKey] || "general";
            for (const record of dataset) {
                const payload = JSON.stringify(record)
                    .replace(/"/g, '""');
                rows.push(`${moduleName},${tableKey},"${payload}"`);
            }
        }
        const csv = rows.join("\n");
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="rems-full-backup.csv"');
        res.send(csv);
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
router.post('/import/full-csv', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { csv } = req.body;
        if (!csv || typeof csv !== 'string') {
            return res.status(400).json({ error: 'CSV payload required' });
        }
        const lines = csv.trim().split(/\r?\n/);
        if (!lines.length || lines[0] !== csvHeader) {
            return res.status(400).json({ error: 'Invalid CSV header' });
        }
        const summary = {
            inserted: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        await client_1.default.$transaction(async (tx) => {
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line)
                    continue;
                const firstComma = line.indexOf(',');
                const secondComma = line.indexOf(',', firstComma + 1);
                if (firstComma === -1 || secondComma === -1) {
                    summary.failed += 1;
                    summary.errors.push(`Line ${i + 1}: invalid format`);
                    continue;
                }
                const table = line.slice(firstComma + 1, secondComma);
                let payload = line.slice(secondComma + 1);
                if (payload.startsWith('"') && payload.endsWith('"')) {
                    payload = payload.slice(1, -1).replace(/""/g, '"');
                }
                try {
                    const parsed = JSON.parse(payload);
                    if (!supportedTables.includes(table)) {
                        summary.failed += 1;
                        summary.errors.push(`Line ${i + 1}: unsupported table ${table}`);
                        continue;
                    }
                    await importHelpers[table](tx, parsed);
                    if (parsed?.id) {
                        summary.updated += 1;
                    }
                    else {
                        summary.inserted += 1;
                    }
                }
                catch (error) {
                    summary.failed += 1;
                    summary.errors.push(`Line ${i + 1}: ${error?.message || 'JSON parse error'}`);
                }
            }
        });
        await logAudit(req, {
            entityType: 'export.full',
            entityId: 'full-csv',
            action: 'update',
            description: 'Imported full CSV backup',
            metadata: summary,
        });
        res.json({ success: true, summary });
    }
    catch (error) {
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=advanced-options.js.map