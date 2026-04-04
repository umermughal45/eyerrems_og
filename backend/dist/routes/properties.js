"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const activity_1 = require("../utils/activity");
const property_alerts_1 = require("../services/property-alerts");
const location_1 = require("../services/location");
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const pagination_1 = require("../utils/pagination");
const pdf_generator_1 = require("../utils/pdf-generator");
const id_generation_service_1 = require("../services/id-generation-service");
const code_generator_1 = require("../utils/code-generator");
const validation_1 = require("../middleware/validation");
const schemas_1 = require("../schemas");
// Configure multer for form-data handling
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Helper function to check if a column exists in a table
const columnExists = async (tableName, columnName) => {
    try {
        const rows = await client_1.default.$queryRaw `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND LOWER(table_name) = LOWER(${tableName})
          AND LOWER(column_name) = LOWER(${columnName})
      ) AS "exists";
    `;
        return Boolean(rows[0]?.exists);
    }
    catch (error) {
        logger_1.default.warn(`Error checking if column ${columnName} exists in ${tableName}:`, error);
        return false;
    }
};
const router = express_1.default.Router();
const getExistingColumns = async (tableName) => {
    try {
        const rows = await client_1.default.$queryRaw `
      SELECT LOWER(column_name) AS column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND LOWER(table_name) = LOWER(${tableName})
    `;
        return new Set((rows || []).map(r => r.column_name));
    }
    catch {
        return new Set();
    }
};
// Note: Validation schemas are now imported from '../schemas'
// The old inline schemas have been moved to server/src/schemas/property.ts
// This ensures validation logic exists in ONE place only.
/**
 * Get all properties with pagination and filtering
 * @route GET /api/properties
 * @access Private
 */
router.get('/', auth_1.authenticate, (0, validation_1.validateQuery)(schemas_1.propertyQuerySchema), async (req, res) => {
    try {
        const { status, type, location: locationQuery, locationId, search, page: pageParam, limit: limitParam } = req.query;
        // Use validated query params from schema (already transformed to numbers) or parsePaginationQuery as fallback
        // The schema validation ensures page and limit are valid numbers with defaults
        let page;
        let limit;
        // Prefer validated params from schema, fallback to parsePaginationQuery for additional validation
        if (typeof pageParam === 'number' && typeof limitParam === 'number') {
            page = pageParam;
            limit = limitParam;
            // Ensure limit doesn't exceed 100 (enforced by schema but double-check)
            if (limit > 100)
                limit = 100;
            if (page < 1)
                page = 1;
        }
        else {
            // Fallback to parsePaginationQuery if schema didn't transform them
            try {
                const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
                page = pagination.page;
                limit = pagination.limit;
            }
            catch (error) {
                if (error instanceof zod_1.z.ZodError) {
                    logger_1.default.warn('Invalid pagination parameters:', { query: req.query, errors: error.errors });
                    return (0, error_handler_1.errorResponse)(res, 'Invalid pagination parameters. Page and limit must be positive integers. Limit cannot exceed 100.', 400, error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })));
                }
                throw error;
            }
        }
        const skip = (page - 1) * limit;
        const where = {
            isDeleted: false,
        };
        if (status) {
            const statusStr = Array.isArray(status) ? status[0] : status;
            where.status = String(statusStr);
        }
        if (type) {
            const typeStr = Array.isArray(type) ? type[0] : type;
            where.type = String(typeStr);
        }
        if (locationQuery) {
            const locationStr = Array.isArray(locationQuery) ? locationQuery[0] : locationQuery;
            where.location = { contains: String(locationStr), mode: 'insensitive' };
        }
        if (locationId) {
            const locationFilterId = Array.isArray(locationId) ? locationId[0] : locationId;
            if (locationFilterId && typeof locationFilterId === 'string') {
                // Validate UUID format before calling getSubtreeIds
                try {
                    zod_1.z.string().uuid().parse(locationFilterId);
                }
                catch (error) {
                    logger_1.default.warn('Invalid locationId format:', { locationId: locationFilterId });
                    return (0, error_handler_1.errorResponse)(res, `Invalid locationId format. Expected a valid UUID, but received: ${locationFilterId}`, 400);
                }
                try {
                    const subtreeIds = await (0, location_1.getSubtreeIds)(locationFilterId);
                    if (subtreeIds.length === 0) {
                        // Location doesn't exist or has no subtree
                        logger_1.default.warn('Location not found or empty subtree:', { locationId: locationFilterId });
                        where.locationId = { in: [] }; // Return empty results
                    }
                    else {
                        where.locationId = { in: subtreeIds };
                    }
                }
                catch (error) {
                    logger_1.default.error('Error fetching subtree IDs:', { error, locationId: locationFilterId });
                    // If it's a database error, return 400; otherwise return 500
                    const statusCode = error?.code?.startsWith('P') ? 400 : 500;
                    return (0, error_handler_1.errorResponse)(res, `Failed to fetch location subtree: ${error?.message || 'Unknown error'}`, statusCode);
                }
            }
        }
        if (search) {
            const searchStr = Array.isArray(search) ? search[0] : search;
            where.OR = [
                { name: { contains: String(searchStr), mode: 'insensitive' } },
                { address: { contains: String(searchStr), mode: 'insensitive' } },
                { location: { contains: String(searchStr), mode: 'insensitive' } },
                // propertyCode search will work after migration
                // { propertyCode: { contains: String(searchStr), mode: 'insensitive' } },
            ];
        }
        // Build include object - try with locationNode first, fallback if P2022 error
        const baseInclude = {
            units: {
                where: { isDeleted: false },
                select: {
                    id: true,
                    unitName: true,
                    status: true,
                    monthlyRent: true,
                },
            },
            blocks: {
                where: { isDeleted: false },
            },
            _count: {
                select: {
                    units: { where: { isDeleted: false } },
                    blocks: { where: { isDeleted: false } },
                },
            },
        };
        let properties = [];
        let total = 0;
        const existingColumns = await getExistingColumns('Property');
        const tidColumnExists = existingColumns.has('tid');
        const subsidiaryOptionIdExists = existingColumns.has('subsidiaryoptionid');
        const scalarFieldsCandidate = [
            'id', 'name', 'type', 'address', 'location', 'status', 'imageurl', 'description', 'yearbuilt', 'totalarea', 'totalunits', 'dealerid', 'isdeleted', 'createdat', 'updatedat', 'propertycode', 'city', 'documents', 'ownername', 'ownerphone', 'previoustenants', 'rentamount', 'rentescalationpercentage', 'securitydeposit', 'size', 'title', 'locationid', 'manualuniqueid', 'tid', 'subsidiaryoptionid'
        ];
        const needsSelect = scalarFieldsCandidate.some(f => !existingColumns.has(f));
        // Helper function to build select fields
        const buildSelectFields = () => {
            const selectFields = {};
            if (existingColumns.has('id'))
                selectFields.id = true;
            if (existingColumns.has('name'))
                selectFields.name = true;
            if (existingColumns.has('type'))
                selectFields.type = true;
            if (existingColumns.has('address'))
                selectFields.address = true;
            if (existingColumns.has('location'))
                selectFields.location = true;
            if (existingColumns.has('status'))
                selectFields.status = true;
            if (existingColumns.has('imageurl'))
                selectFields.imageUrl = true;
            if (existingColumns.has('description'))
                selectFields.description = true;
            if (existingColumns.has('yearbuilt'))
                selectFields.yearBuilt = true;
            if (existingColumns.has('totalarea'))
                selectFields.totalArea = true;
            if (existingColumns.has('totalunits'))
                selectFields.totalUnits = true;
            if (existingColumns.has('dealerid'))
                selectFields.dealerId = true;
            if (existingColumns.has('isdeleted'))
                selectFields.isDeleted = true;
            if (existingColumns.has('createdat'))
                selectFields.createdAt = true;
            if (existingColumns.has('updatedat'))
                selectFields.updatedAt = true;
            if (existingColumns.has('propertycode'))
                selectFields.propertyCode = true;
            if (existingColumns.has('city'))
                selectFields.city = true;
            if (existingColumns.has('documents'))
                selectFields.documents = true;
            if (existingColumns.has('ownername'))
                selectFields.ownerName = true;
            if (existingColumns.has('ownerphone'))
                selectFields.ownerPhone = true;
            if (existingColumns.has('previoustenants'))
                selectFields.previousTenants = true;
            if (existingColumns.has('rentamount'))
                selectFields.rentAmount = true;
            if (existingColumns.has('rentescalationpercentage'))
                selectFields.rentEscalationPercentage = true;
            if (existingColumns.has('securitydeposit'))
                selectFields.securityDeposit = true;
            if (existingColumns.has('size'))
                selectFields.size = true;
            if (existingColumns.has('title'))
                selectFields.title = true;
            if (existingColumns.has('locationid'))
                selectFields.locationId = true;
            if (existingColumns.has('manualuniqueid'))
                selectFields.manualUniqueId = true;
            if (tidColumnExists)
                selectFields.tid = true;
            if (subsidiaryOptionIdExists)
                selectFields.subsidiaryOptionId = true;
            selectFields.units = baseInclude.units;
            selectFields.blocks = baseInclude.blocks;
            selectFields._count = baseInclude._count;
            return selectFields;
        };
        try {
            if (needsSelect) {
                // Use select if any columns are missing (silently handled - no need to log on every request)
                [properties, total] = await Promise.all([
                    client_1.default.property.findMany({
                        where,
                        select: buildSelectFields(),
                        orderBy: { createdAt: 'desc' },
                        skip,
                        take: limit,
                    }),
                    client_1.default.property.count({ where }),
                ]);
            }
            else {
                // Try with locationNode included (only if all columns exist)
                [properties, total] = await Promise.all([
                    client_1.default.property.findMany({
                        where,
                        include: {
                            ...baseInclude,
                            locationNode: true,
                        },
                        orderBy: { createdAt: 'desc' },
                        skip,
                        take: limit,
                    }),
                    client_1.default.property.count({ where }),
                ]);
            }
        }
        catch (error) {
            // If P2022 error (column not found), handle gracefully
            if (error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
                const errorMessage = error?.message || '';
                const isLocationError = errorMessage.includes('Location') || errorMessage.includes('locationNode');
                if (isLocationError && !needsSelect) {
                    // Try without locationNode (only if we haven't already used select)
                    logger_1.default.warn('LocationNode relation not available, fetching without it:', error.message);
                    try {
                        [properties, total] = await Promise.all([
                            client_1.default.property.findMany({
                                where,
                                include: baseInclude,
                                orderBy: { createdAt: 'desc' },
                                skip,
                                take: limit,
                            }),
                            client_1.default.property.count({ where }),
                        ]);
                    }
                    catch (retryError) {
                        // If still failing, fall back to select
                        logger_1.default.warn('Fallback to select after include failed:', retryError.message);
                        [properties, total] = await Promise.all([
                            client_1.default.property.findMany({
                                where,
                                select: buildSelectFields(),
                                orderBy: { createdAt: 'desc' },
                                skip,
                                take: limit,
                            }),
                            client_1.default.property.count({ where }),
                        ]);
                    }
                }
                else {
                    // Use select as fallback for any column error
                    logger_1.default.warn('Column error detected, using select to exclude missing columns:', error.message);
                    [properties, total] = await Promise.all([
                        client_1.default.property.findMany({
                            where,
                            select: buildSelectFields(),
                            orderBy: { createdAt: 'desc' },
                            skip,
                            take: limit,
                        }),
                        client_1.default.property.count({ where }),
                    ]);
                }
            }
            else {
                throw error;
            }
        }
        // Extract property IDs for batch queries
        const propertyIds = properties.map(p => p.id);
        // OPTIMIZED: Batch fetch all data instead of N+1 queries
        // Skip batch queries if no properties to avoid database errors with empty arrays
        const [unitCounts, revenueData, incomeTransactions, expenseTransactions, allInvoices, allPayments, completedSales, outstandingInvoices,] = propertyIds.length > 0 ? await Promise.all([
            // Count occupied units per property
            client_1.default.unit.groupBy({
                by: ['propertyId'],
                where: {
                    propertyId: { in: propertyIds },
                    status: 'Occupied',
                    isDeleted: false,
                },
                _count: true,
            }),
            // Aggregate revenue per property
            client_1.default.unit.groupBy({
                by: ['propertyId'],
                where: {
                    propertyId: { in: propertyIds },
                    status: 'Occupied',
                    isDeleted: false,
                },
                _sum: { monthlyRent: true },
            }),
            // Get all income transactions
            client_1.default.transaction.findMany({
                where: {
                    propertyId: { in: propertyIds },
                    transactionType: 'income',
                    status: 'completed',
                },
                include: { transactionCategory: true },
            }),
            // Get all expense transactions
            client_1.default.transaction.findMany({
                where: {
                    propertyId: { in: propertyIds },
                    transactionType: 'expense',
                    status: 'completed',
                },
            }),
            // Get all invoices
            client_1.default.invoice.findMany({
                where: { propertyId: { in: propertyIds } },
                select: { id: true, propertyId: true },
            }),
            // Get all payments
            client_1.default.tenantPayment.findMany({
                where: {
                    status: 'completed',
                },
                select: { id: true, invoiceId: true, amount: true },
            }),
            // Get all completed sales
            client_1.default.sale.findMany({
                where: {
                    propertyId: { in: propertyIds },
                    status: { in: ['Completed', 'completed'] },
                    isDeleted: false,
                },
                select: {
                    id: true,
                    propertyId: true,
                    saleValue: true,
                    actualPropertyValue: true,
                },
            }),
            // Get outstanding invoices
            client_1.default.invoice.findMany({
                where: {
                    propertyId: { in: propertyIds },
                    status: { in: ['unpaid', 'partial', 'overdue'] },
                },
                select: {
                    id: true,
                    propertyId: true,
                    remainingAmount: true,
                    totalAmount: true,
                },
            }),
        ]) : [[], [], [], [], [], [], [], []];
        // Create lookup maps for efficient access
        const unitCountMap = new Map(unitCounts.map(u => [u.propertyId, u._count]));
        const revenueMap = new Map(revenueData.map(r => [r.propertyId, r._sum.monthlyRent || 0]));
        const transactionMap = new Map();
        const expenseMap = new Map();
        const invoiceMap = new Map();
        const saleMap = new Map();
        const outstandingInvoiceMap = new Map();
        // Group transactions by property
        incomeTransactions.forEach(tx => {
            if (!transactionMap.has(tx.propertyId)) {
                transactionMap.set(tx.propertyId, []);
            }
            transactionMap.get(tx.propertyId).push(tx);
        });
        expenseTransactions.forEach(tx => {
            if (!expenseMap.has(tx.propertyId)) {
                expenseMap.set(tx.propertyId, []);
            }
            expenseMap.get(tx.propertyId).push(tx);
        });
        // Group invoices by property
        allInvoices.forEach(inv => {
            if (!invoiceMap.has(inv.propertyId)) {
                invoiceMap.set(inv.propertyId, []);
            }
            invoiceMap.get(inv.propertyId).push(inv);
        });
        // Group sales by property
        completedSales.forEach(sale => {
            if (!saleMap.has(sale.propertyId)) {
                saleMap.set(sale.propertyId, []);
            }
            saleMap.get(sale.propertyId).push(sale);
        });
        // Group outstanding invoices by property
        outstandingInvoices.forEach(inv => {
            if (!outstandingInvoiceMap.has(inv.propertyId)) {
                outstandingInvoiceMap.set(inv.propertyId, []);
            }
            outstandingInvoiceMap.get(inv.propertyId).push(inv);
        });
        // Create payment lookup by invoice ID
        const paymentMap = new Map();
        allPayments.forEach(payment => {
            if (payment.invoiceId) {
                if (!paymentMap.has(payment.invoiceId)) {
                    paymentMap.set(payment.invoiceId, []);
                }
                paymentMap.get(payment.invoiceId).push(payment);
            }
        });
        // Map results to properties (no additional queries)
        const propertiesWithStats = properties.map(property => {
            const rawDocuments = property.documents && typeof property.documents === 'object' ? property.documents : null;
            const salePrice = rawDocuments?.salePrice;
            const occupiedUnits = unitCountMap.get(property.id) || 0;
            const monthlyRevenueAmount = revenueMap.get(property.id) || 0;
            const yearlyRevenueAmount = monthlyRevenueAmount * 12;
            const propertyIncomeTransactions = transactionMap.get(property.id) || [];
            const propertyExpenseTransactions = expenseMap.get(property.id) || [];
            const propertyInvoices = invoiceMap.get(property.id) || [];
            const invoiceIds = propertyInvoices.map(inv => inv.id);
            const rentPayments = invoiceIds.flatMap(id => paymentMap.get(id) || []);
            // Calculate rent revenue from transactions (excluding sale-related)
            const rentRevenueTransactions = propertyIncomeTransactions.filter((tx) => {
                const categoryName = tx.transactionCategory?.name?.toLowerCase() || '';
                const description = tx.description?.toLowerCase() || '';
                const isSale = categoryName.includes('sale') ||
                    description.includes('sale') ||
                    description.includes('property sale');
                return !isSale;
            });
            const rentRevenueFromTransactions = rentRevenueTransactions.reduce((sum, tx) => sum + (tx.totalAmount || tx.amount || 0), 0);
            const rentRevenueFromPayments = rentPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
            const rentRevenue = rentRevenueFromTransactions + rentRevenueFromPayments;
            // Calculate sale revenue
            const propertySales = saleMap.get(property.id) || [];
            const saleRevenue = propertySales.reduce((sum, sale) => sum + (sale.saleValue || 0), 0);
            const totalPropertyCost = propertySales.reduce((sum, sale) => sum + (sale.actualPropertyValue || 0), 0);
            const saleProfit = saleRevenue - totalPropertyCost;
            // Calculate expenses
            const totalExpenses = propertyExpenseTransactions.reduce((sum, tx) => sum + (tx.totalAmount || tx.amount || 0), 0);
            const rentProfit = rentRevenue - totalExpenses;
            // Calculate outstanding invoices
            const propertyOutstandingInvoices = outstandingInvoiceMap.get(property.id) || [];
            const outstandingInvoicesAmount = propertyOutstandingInvoices.reduce((sum, inv) => sum + (Number(inv.remainingAmount ?? inv.totalAmount ?? 0)), 0);
            // Extract amenities
            let amenities = [];
            if (rawDocuments && Array.isArray(rawDocuments.amenities)) {
                amenities = rawDocuments.amenities;
            }
            return {
                ...property,
                ...(salePrice !== undefined ? { salePrice } : {}),
                amenities,
                occupied: occupiedUnits,
                units: property._count.units,
                revenue: monthlyRevenueAmount
                    ? `Rs ${monthlyRevenueAmount.toLocaleString()}`
                    : 'Rs 0',
                monthlyRevenue: monthlyRevenueAmount,
                yearlyRevenue: yearlyRevenueAmount,
                occupancyRate: property._count.units > 0
                    ? Math.round((occupiedUnits / property._count.units) * 100 * 10) / 10
                    : 0,
                rentRevenue,
                rentProfit,
                saleRevenue,
                saleProfit,
                totalExpenses,
                outstandingInvoices: propertyOutstandingInvoices.length,
                outstandingInvoicesAmount,
            };
        });
        const pagination = (0, pagination_1.calculatePagination)(page, limit, total);
        return (0, error_handler_1.successResponse)(res, propertiesWithStats, 200, pagination);
    }
    catch (error) {
        logger_1.default.error('Get properties error:', {
            error: error instanceof Error ? error.message : error,
            code: error?.code,
            meta: error?.meta,
            stack: error instanceof Error ? error.stack : undefined,
            query: req.query,
        });
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get property structure (floors with units) - MUST be before /:id route
router.get('/:id/structure', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
            select: {
                id: true,
                name: true,
                propertyCode: true,
            },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        const floors = await client_1.default.floor.findMany({
            where: {
                propertyId: id,
                isDeleted: false,
            },
            include: {
                units: {
                    where: { isDeleted: false },
                    select: {
                        id: true,
                        unitName: true,
                        status: true,
                        monthlyRent: true,
                        description: true, // Using description field for unitType temporarily
                        floorId: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                    orderBy: {
                        unitName: 'asc',
                    },
                },
                _count: {
                    select: {
                        units: { where: { isDeleted: false } },
                    },
                },
            },
            orderBy: {
                floorNumber: 'asc',
            },
        });
        return (0, error_handler_1.successResponse)(res, {
            property: {
                id: property.id,
                name: property.name,
                propertyCode: property.propertyCode,
            },
            floors: floors.map((floor) => ({
                id: floor.id,
                name: floor.name,
                floorNumber: floor.floorNumber,
                description: floor.description,
                units: floor.units,
                unitCount: floor._count.units,
            })),
            summary: {
                totalFloors: floors.length,
                totalUnits: floors.reduce((sum, floor) => sum + floor._count.units, 0),
                occupiedUnits: floors.reduce((sum, floor) => sum + floor.units.filter((u) => u.status === 'Occupied').length, 0),
                vacantUnits: floors.reduce((sum, floor) => sum + floor.units.filter((u) => u.status === 'Vacant').length, 0),
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get property structure error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Create floor for a property - MUST be before /:id route
router.post('/:id/floors', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, floorNumber, description } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return (0, error_handler_1.errorResponse)(res, 'Floor name is required', 400);
        }
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        const floor = await client_1.default.floor.create({
            data: {
                name: name.trim(),
                floorNumber: floorNumber !== undefined ? parseInt(floorNumber) : null,
                propertyId: id,
                description: description || null,
            },
            include: {
                units: true,
                property: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        return (0, error_handler_1.successResponse)(res, floor, 201);
    }
    catch (error) {
        logger_1.default.error('Create floor error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Serve property image - MUST be before /:id route to avoid route conflicts
// GET /api/properties/:id/image
router.get('/:id/image', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        // Get property with imageUrl
        const property = await client_1.default.property.findFirst({
            where: {
                id,
                isDeleted: false,
            },
            select: {
                id: true,
                imageUrl: true,
            },
        });
        if (!property || !property.imageUrl) {
            return res.status(404).json({ error: 'Property image not found' });
        }
        const imageUrl = property.imageUrl;
        // Handle different image URL formats
        // 1. Full HTTP/HTTPS URLs - redirect or proxy
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            // For external URLs, we could proxy them, but for now just return the URL
            // In production, you might want to proxy to avoid CORS issues
            return res.redirect(imageUrl);
        }
        // 2. Secure files path (/secure-files/... or /api/secure-files/...)
        if (imageUrl.startsWith('/secure-files/') || imageUrl.startsWith('/api/secure-files/')) {
            // Extract path components: /secure-files/entityType/entityId/filename
            // Remove /api prefix if present
            const cleanPath = imageUrl.replace(/^\/api/, '');
            const pathParts = cleanPath.split('/').filter(Boolean);
            if (pathParts.length >= 4) {
                const [, entityType, entityId, ...filenameParts] = pathParts;
                const filename = filenameParts.join('/');
                // Use secure-files route logic
                const { getSecureUploadDir } = await Promise.resolve().then(() => __importStar(require('../utils/file-security')));
                const uploadDir = await getSecureUploadDir();
                const filePath = path_1.default.join(uploadDir, entityType, entityId, filename);
                // Check if file exists
                try {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                    await fs.access(filePath);
                    // Get file stats and content type
                    const stats = await fs.stat(filePath);
                    const ext = path_1.default.extname(filename).toLowerCase();
                    const contentTypes = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                        '.svg': 'image/svg+xml',
                    };
                    const contentType = contentTypes[ext] || 'image/jpeg';
                    // Set headers
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', stats.size);
                    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
                    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                    // Stream file
                    const fileBuffer = await fs.readFile(filePath);
                    return res.send(fileBuffer);
                }
                catch (error) {
                    logger_1.default.warn(`Property image file not found: ${filePath} (from imageUrl: ${imageUrl})`);
                    return res.status(404).json({ error: 'Image file not found on server' });
                }
            }
        }
        // 3. Legacy /uploads path
        if (imageUrl.startsWith('/uploads/')) {
            const filePath = path_1.default.join(process.cwd(), 'public', imageUrl);
            try {
                const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                await fs.access(filePath);
                const stats = await fs.stat(filePath);
                const ext = path_1.default.extname(imageUrl).toLowerCase();
                const contentTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                };
                const contentType = contentTypes[ext] || 'image/jpeg';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Cache-Control', 'public, max-age=31536000');
                const fileBuffer = await fs.readFile(filePath);
                return res.send(fileBuffer);
            }
            catch (error) {
                logger_1.default.warn(`Legacy property image file not found: ${filePath}`);
                return res.status(404).json({ error: 'Image file not found' });
            }
        }
        // 4. Base64 data URLs - decode and serve
        if (imageUrl.startsWith('data:image/')) {
            const matches = imageUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (matches) {
                const [, imageType, base64Data] = matches;
                const imageBuffer = Buffer.from(base64Data, 'base64');
                const contentTypes = {
                    'jpeg': 'image/jpeg',
                    'jpg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                };
                const contentType = contentTypes[imageType.toLowerCase()] || 'image/jpeg';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', imageBuffer.length);
                res.setHeader('Cache-Control', 'public, max-age=31536000');
                return res.send(imageBuffer);
            }
        }
        // 5. Relative path starting with / - try as secure-files or legacy uploads
        if (imageUrl.startsWith('/')) {
            // Try secure-files first
            if (!imageUrl.startsWith('/secure-files/') && !imageUrl.startsWith('/uploads/')) {
                // Assume it's a property-specific path like /property/{id}
                // Try to find the image in secure-files/images/{userId} or similar
                // For now, return 404 with helpful message
                return res.status(404).json({
                    error: 'Image path format not recognized',
                    imageUrl: imageUrl,
                    hint: 'Image URL should be a full URL, /secure-files/... path, /uploads/... path, or base64 data URL'
                });
            }
        }
        return res.status(404).json({ error: 'Unsupported image URL format' });
    }
    catch (error) {
        logger_1.default.error('Property image serving error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get property by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const existingColumns = await getExistingColumns('Property');
        const tidExists = existingColumns.has('tid');
        const subsidiaryOptionIdExists = existingColumns.has('subsidiaryoptionid');
        const scalarFieldsCandidate = [
            'id', 'name', 'type', 'address', 'location', 'status', 'imageurl', 'description', 'yearbuilt', 'totalarea', 'totalunits', 'dealerid', 'isdeleted', 'createdat', 'updatedat', 'propertycode', 'city', 'documents', 'ownername', 'ownerphone', 'previoustenants', 'rentamount', 'rentescalationpercentage', 'securitydeposit', 'size', 'title', 'locationid', 'manualuniqueid', 'tid', 'subsidiaryoptionid'
        ];
        const allColumnsPresent = scalarFieldsCandidate.every(f => existingColumns.has(f));
        // Define the relations we want to include (as select objects)
        const relationSelects = {
            units: {
                where: { isDeleted: false },
                include: {
                    tenant: {
                        where: { isDeleted: false },
                    },
                    block: {
                        where: { isDeleted: false },
                    },
                    floor: {
                        where: { isDeleted: false },
                    },
                },
            },
            blocks: {
                where: { isDeleted: false },
            },
            floors: {
                where: { isDeleted: false },
                include: {
                    units: {
                        where: { isDeleted: false },
                        select: {
                            id: true,
                            unitName: true,
                            status: true,
                        },
                    },
                },
                orderBy: {
                    floorNumber: 'asc',
                },
            },
            sales: {
                where: { isDeleted: false },
                include: {
                    buyers: {
                        where: { isDeleted: false },
                    },
                },
            },
            deals: {
                where: { isDeleted: false },
                include: {
                    payments: true,
                    dealer: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            clientCode: true,
                            status: true,
                        },
                    },
                    paymentPlan: {
                        include: {
                            installments: {
                                where: { isDeleted: false },
                                orderBy: { dueDate: 'asc' },
                            },
                        },
                    },
                },
            },
            tenancies: {
                where: { isDeleted: false },
                include: {
                    tenant: true,
                    lease: true,
                },
            },
        };
        let property;
        if (allColumnsPresent) {
            // Safe to use standard include if all columns exist
            property = await client_1.default.property.findFirst({
                where: {
                    id,
                    isDeleted: false,
                },
                include: {
                    ...relationSelects,
                    // Only include this if we know the column exists, though strict logic would be in select
                    // But if subsidiaryOptionIdExists is true, the relation should be fine.
                    subsidiaryOption: {
                        select: {
                            id: true,
                            name: true,
                            propertySubsidiary: {
                                select: {
                                    id: true,
                                    name: true,
                                    logoPath: true,
                                },
                            },
                        },
                    },
                },
            });
        }
        else {
            // Fallback: Dynamically build select to exclude missing columns
            const select = {};
            if (existingColumns.has('id'))
                select.id = true;
            if (existingColumns.has('name'))
                select.name = true;
            if (existingColumns.has('type'))
                select.type = true;
            if (existingColumns.has('address'))
                select.address = true;
            if (existingColumns.has('location'))
                select.location = true;
            if (existingColumns.has('status'))
                select.status = true;
            if (existingColumns.has('imageurl'))
                select.imageUrl = true;
            if (existingColumns.has('description'))
                select.description = true;
            if (existingColumns.has('yearbuilt'))
                select.yearBuilt = true;
            if (existingColumns.has('totalarea'))
                select.totalArea = true;
            if (existingColumns.has('totalunits'))
                select.totalUnits = true;
            if (existingColumns.has('dealerid'))
                select.dealerId = true;
            if (existingColumns.has('isdeleted'))
                select.isDeleted = true;
            if (existingColumns.has('createdat'))
                select.createdAt = true;
            if (existingColumns.has('updatedat'))
                select.updatedAt = true;
            if (existingColumns.has('propertycode'))
                select.propertyCode = true;
            if (existingColumns.has('city'))
                select.city = true;
            if (existingColumns.has('documents'))
                select.documents = true;
            if (existingColumns.has('ownername'))
                select.ownerName = true;
            if (existingColumns.has('ownerphone'))
                select.ownerPhone = true;
            if (existingColumns.has('previoustenants'))
                select.previousTenants = true;
            if (existingColumns.has('rentamount'))
                select.rentAmount = true;
            if (existingColumns.has('rentescalationpercentage'))
                select.rentEscalationPercentage = true;
            if (existingColumns.has('securitydeposit'))
                select.securityDeposit = true;
            if (existingColumns.has('size'))
                select.size = true;
            if (existingColumns.has('title'))
                select.title = true;
            if (existingColumns.has('locationid'))
                select.locationId = true;
            if (existingColumns.has('manualuniqueid'))
                select.manualUniqueId = true;
            if (tidExists)
                select.tid = true;
            if (subsidiaryOptionIdExists)
                select.subsidiaryOptionId = true;
            // Add relations
            Object.assign(select, relationSelects);
            // Conditional relation
            if (subsidiaryOptionIdExists) {
                select.subsidiaryOption = {
                    select: {
                        id: true,
                        name: true,
                        propertySubsidiary: {
                            select: {
                                id: true,
                                name: true,
                                logoPath: true,
                            },
                        },
                    },
                };
            }
            property = await client_1.default.property.findFirst({
                where: {
                    id,
                    isDeleted: false,
                },
                select,
            });
        }
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        const rawDocuments = property.documents && typeof property.documents === 'object'
            ? property.documents
            : null;
        const salePrice = rawDocuments?.salePrice;
        // Active deals with payment progress
        const activeDeals = (property.deals || []).filter((deal) => !deal.isDeleted &&
            (deal.status || '').toLowerCase() !== 'closed' &&
            (deal.status || '').toLowerCase() !== 'lost' &&
            (deal.status || '').toLowerCase() !== 'cancelled');
        const dealSummaries = activeDeals.map((deal) => {
            const received = (deal.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const pending = Math.max(0, (deal.dealAmount || 0) - received);
            return {
                id: deal.id,
                title: deal.title,
                amount: deal.dealAmount || 0,
                received,
                pending,
                status: deal.status,
                stage: deal.stage,
                dealerName: deal.dealer?.name,
                clientName: deal.client?.name,
                createdAt: deal.createdAt,
            };
        });
        const totalDealReceived = dealSummaries.reduce((sum, d) => sum + d.received, 0);
        const totalDealPending = dealSummaries.reduce((sum, d) => sum + d.pending, 0);
        // Get deal IDs for this property
        const dealIds = property.deals?.map((d) => d.id) || [];
        // Finance summary (aggregated) and latest finance entries - query through Deal relationship
        const [incomeAgg, expenseAgg, financeEntries] = await Promise.all([
            client_1.default.financeLedger.aggregate({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false,
                    category: 'credit'
                },
                _sum: { amount: true },
            }),
            client_1.default.financeLedger.aggregate({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false,
                    category: 'debit'
                },
                _sum: { amount: true },
            }),
            client_1.default.financeLedger.findMany({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false
                },
                orderBy: { date: 'desc' },
                take: 10,
            }),
        ]);
        const ledgerIncome = incomeAgg._sum?.amount || 0;
        const ledgerExpenses = expenseAgg._sum?.amount || 0;
        const financeRecords = financeEntries.map((entry) => ({
            id: entry.id,
            amount: entry.amount,
            transactionType: entry.category,
            purpose: entry.description || entry.notes || '',
            referenceType: entry.referenceType,
            description: entry.description,
            date: entry.date,
        }));
        // Get dealer ledger data if property has a dealer
        let dealerLedger = [];
        if (property.dealerId) {
            // Get dealer ledger entries for this property's dealer
            try {
                const dealerLedgerEntries = await client_1.default.dealerLedger.findMany({
                    where: {
                        dealerId: property.dealerId,
                    },
                    orderBy: { date: 'desc' },
                    take: 20, // Limit to recent 20 entries
                });
                dealerLedger = dealerLedgerEntries.map((entry) => ({
                    id: entry.id,
                    date: entry.date,
                    description: entry.description || '',
                    // Use debit/credit if available, otherwise use amount
                    debit: entry.debit || 0,
                    credit: entry.credit || 0,
                    balance: entry.balance || entry.amount || 0,
                }));
            }
            catch (err) {
                // Dealer ledger table might not exist or have different structure
                console.warn('Dealer ledger not available:', err);
                dealerLedger = [];
            }
        }
        // Calculate stats
        const occupiedUnits = await client_1.default.unit.count({
            where: {
                propertyId: property.id,
                status: 'Occupied',
                isDeleted: false,
            },
        });
        const totalTenants = await client_1.default.tenant.count({
            where: {
                unit: {
                    propertyId: property.id,
                    isDeleted: false,
                },
                isDeleted: false,
            },
        });
        const monthlyRevenue = await client_1.default.unit.aggregate({
            where: {
                propertyId: property.id,
                status: 'Occupied',
                isDeleted: false,
            },
            _sum: {
                monthlyRent: true,
            },
        });
        const monthlyRevenueAmount = monthlyRevenue._sum.monthlyRent || 0;
        const yearlyRevenueAmount = monthlyRevenueAmount * 12;
        const totalUnits = property.units?.length || 0;
        const occupancyRate = totalUnits > 0
            ? Math.round((occupiedUnits / totalUnits) * 100 * 10) / 10
            : 0;
        // Extract amenities from documents field if stored there
        let amenities = [];
        if (property.documents && typeof property.documents === 'object') {
            const docs = property.documents;
            if (Array.isArray(docs.amenities)) {
                amenities = docs.amenities;
            }
        }
        // Calculate Total Due and Total Outstanding from payment plans
        let totalDue = 0;
        let totalOutstanding = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        for (const deal of property.deals || []) {
            if (deal.paymentPlan) {
                for (const installment of deal.paymentPlan.installments) {
                    const installmentRemaining = installment.amount - (installment.paidAmount || 0);
                    totalOutstanding += installmentRemaining;
                    if (installment.dueDate <= today && installment.status !== 'Paid') {
                        totalDue += installmentRemaining;
                    }
                }
            }
            else {
                // Fallback for deals without a payment plan (should not happen if plans are mandatory)
                const dealTotalPaid = (deal.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                const dealRemaining = Math.max(0, (deal.dealAmount || 0) - dealTotalPaid);
                totalOutstanding += dealRemaining;
                // For simplicity, if no payment plan, consider all remaining as due if deal is active
                if (deal.status !== 'closed' && deal.status !== 'lost' && deal.status !== 'cancelled') {
                    totalDue += dealRemaining;
                }
            }
        }
        // Fetch dealer information if dealerId exists
        let dealer = null;
        if (property.dealerId) {
            try {
                const dealerData = await client_1.default.dealer.findUnique({
                    where: { id: property.dealerId },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        company: true,
                        commissionRate: true,
                    },
                });
                dealer = dealerData;
            }
            catch (err) {
                console.warn('Failed to fetch dealer for property:', err);
            }
        }
        return (0, error_handler_1.successResponse)(res, {
            ...property,
            dealer, // Include dealer information
            dealerName: dealer?.name || null, // Map dealer name for frontend compatibility
            dealerContact: dealer?.phone || null, // Map dealer contact for frontend compatibility
            ...(salePrice !== undefined ? { salePrice } : {}),
            amenities, // Add amenities to response
            occupied: occupiedUnits,
            totalTenants,
            revenue: monthlyRevenueAmount,
            monthlyRevenue: monthlyRevenueAmount,
            yearlyRevenue: yearlyRevenueAmount,
            occupancyRate,
            financeSummary: {
                totalReceived: ledgerIncome + totalDealReceived,
                totalExpenses: ledgerExpenses,
                pendingAmount: totalDealPending,
                entryCount: financeRecords.length,
                totalDue,
                totalOutstanding,
            },
            financeRecords,
            activeDeals: dealSummaries,
            dealerLedger,
        });
    }
    catch (error) {
        logger_1.default.error('Get property error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Get property dashboard
 * @route GET /api/properties/:id/dashboard
 * @access Private
 */
router.get('/:id/dashboard', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { getPropertyDashboard } = await Promise.resolve().then(() => __importStar(require('../services/analytics')));
        const dashboard = await getPropertyDashboard(id);
        return (0, error_handler_1.successResponse)(res, dashboard);
    }
    catch (error) {
        logger_1.default.error('Get property dashboard error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Upload property document
 * @route POST /api/property/upload-document
 * @access Private
 */
router.post('/upload-document', auth_1.authenticate, async (req, res) => {
    try {
        const { file, filename } = req.body;
        const queryPropertyId = req.query.propertyId;
        const propertyId = req.body.propertyId || (typeof queryPropertyId === 'string' ? queryPropertyId : Array.isArray(queryPropertyId) ? queryPropertyId[0] : undefined);
        if (!file || !propertyId) {
            return res.status(400).json({
                success: false,
                error: 'File data and propertyId are required',
            });
        }
        const dataUrlMatch = file.match(/^data:(.+);base64,(.+)$/);
        if (!dataUrlMatch) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file format. Expected base64 data URL.',
            });
        }
        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];
        const buffer = Buffer.from(base64Data, 'base64');
        // Validate file type (PDF, JPG, PNG, GIF, WEBP)
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(mimeType.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Only PDF, JPG, PNG, GIF, and WEBP files are allowed',
            });
        }
        // Validate file using security utilities
        const { validateFileUpload } = await Promise.resolve().then(() => __importStar(require('../utils/file-security')));
        const validation = await validateFileUpload(buffer, mimeType, filename);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error || 'File validation failed',
            });
        }
        // Save file securely
        const { saveFileSecurely } = await Promise.resolve().then(() => __importStar(require('../utils/file-security')));
        const { relativePath, filename: secureFilename } = await saveFileSecurely(buffer, filename || `property-document-${Date.now()}.${mimeType.split('/')[1]}`, 'properties', propertyId);
        // Normalize path (ensure forward slashes, no /api prefix)
        const normalizedPath = relativePath.replace(/\\/g, '/');
        // Store attachment metadata in database
        const attachment = await client_1.default.attachment.create({
            data: {
                fileName: secureFilename,
                fileUrl: normalizedPath,
                fileType: mimeType,
                fileSize: buffer.length,
                entityType: 'property',
                entityId: propertyId,
                propertyId: propertyId,
                uploadedBy: req.user.id,
                description: `Property document: ${filename || secureFilename}`,
            },
        });
        res.json({
            success: true,
            data: {
                id: attachment.id,
                url: normalizedPath,
                filename: secureFilename,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Upload property document error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload document',
        });
    }
});
/**
 * Get property documents
 * @route GET /api/property/documents/:propertyId
 * @access Private
 */
router.get('/documents/:propertyId', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const documents = await client_1.default.attachment.findMany({
            where: {
                entityType: 'property',
                entityId: propertyId,
                propertyId: propertyId,
                isDeleted: false,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            data: documents,
        });
    }
    catch (error) {
        logger_1.default.error('Get property documents error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get documents',
        });
    }
});
// Generate PDF report for a property
router.get('/:id/report', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
            include: {
                units: { where: { isDeleted: false } },
                deals: {
                    where: { isDeleted: false, deletedAt: null },
                    include: {
                        payments: true,
                        dealer: true,
                        client: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                clientCode: true,
                                status: true,
                            },
                        },
                    },
                },
                sales: {
                    where: { isDeleted: false },
                    include: { buyers: true, dealer: true },
                },
            },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        const rawDocuments = property.documents && typeof property.documents === 'object'
            ? property.documents
            : null;
        const salePrice = rawDocuments?.salePrice ?? undefined;
        const dealer = property.dealerId
            ? await client_1.default.dealer.findUnique({
                where: { id: property.dealerId },
                select: { name: true, email: true, phone: true },
            })
            : null;
        // Get deal IDs for this property
        const propertyDeals = await client_1.default.deal.findMany({
            where: { propertyId: id, isDeleted: false },
            select: { id: true },
        });
        const dealIds = propertyDeals.map((d) => d.id);
        // Finance data (aggregated + recent entries) - query through Deal relationship
        const [incomeAgg, expenseAgg, financeEntries] = await Promise.all([
            client_1.default.financeLedger.aggregate({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false,
                    category: 'credit'
                },
                _sum: { amount: true },
            }),
            client_1.default.financeLedger.aggregate({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false,
                    category: 'debit'
                },
                _sum: { amount: true },
            }),
            client_1.default.financeLedger.findMany({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false
                },
                orderBy: { date: 'desc' },
                take: 20,
            }),
        ]);
        const ledgerIncome = incomeAgg._sum?.amount || 0;
        const ledgerExpenses = expenseAgg._sum?.amount || 0;
        const financeRecords = financeEntries.map((entry) => ({
            id: entry.id,
            amount: entry.amount,
            transactionType: entry.category,
            purpose: entry.description || entry.notes || '',
            referenceType: entry.referenceType,
            description: entry.description,
            date: entry.date,
        }));
        // Deals
        const activeDeals = (property.deals || []).filter((deal) => !deal.isDeleted &&
            (deal.status || '').toLowerCase() !== 'closed' &&
            (deal.status || '').toLowerCase() !== 'lost' &&
            (deal.status || '').toLowerCase() !== 'cancelled');
        const dealSummaries = activeDeals.map((deal) => {
            const received = (deal.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const pending = Math.max(0, (deal.dealAmount || 0) - received);
            return {
                id: deal.id,
                title: deal.title,
                amount: deal.dealAmount || 0,
                received,
                pending,
                status: deal.status,
                stage: deal.stage,
                dealerName: deal.dealer?.name,
                clientName: deal.client?.name,
                createdAt: deal.createdAt,
            };
        });
        const totalDealReceived = dealSummaries.reduce((sum, d) => sum + d.received, 0);
        const totalDealPending = dealSummaries.reduce((sum, d) => sum + d.pending, 0);
        // Fetch payment plans for all active deals
        const paymentPlans = [];
        for (const deal of activeDeals) {
            try {
                const paymentPlan = await client_1.default.paymentPlan.findUnique({
                    where: { dealId: deal.id },
                    include: {
                        installments: {
                            where: { isDeleted: false },
                            orderBy: { installmentNumber: 'asc' },
                        },
                        client: {
                            select: { name: true, clientCode: true },
                        },
                    },
                });
                if (paymentPlan) {
                    paymentPlans.push({
                        dealId: deal.id,
                        dealTitle: deal.title,
                        clientName: paymentPlan.client?.name || deal.client?.name || 'N/A',
                        installments: paymentPlan.installments.map((inst) => ({
                            installmentNumber: inst.installmentNumber,
                            amount: inst.amount,
                            dueDate: inst.dueDate,
                            paidAmount: inst.paidAmount || 0,
                            status: inst.status,
                            paidDate: inst.paidDate,
                            remainingBalance: Math.max(0, inst.amount - (inst.paidAmount || 0)),
                        })),
                    });
                }
            }
            catch (err) {
                console.warn(`Failed to fetch payment plan for deal ${deal.id}:`, err);
            }
        }
        // Sales / booking details
        const saleEntries = (property.sales || []).map((sale) => ({
            id: sale.id,
            saleValue: sale.saleValue || sale.salePrice || sale.amount || null,
            saleDate: sale.saleDate,
            buyerName: sale.buyers && sale.buyers.length > 0 ? sale.buyers.map((b) => b.name).join(', ') : undefined,
            dealerName: sale.dealer?.name,
            status: sale.status,
            profit: sale.profit,
        }));
        const totalUnits = property.units?.length || 0;
        const occupiedUnits = property.units?.filter((u) => u.status === 'Occupied').length || 0;
        (0, pdf_generator_1.generatePropertyReportPDF)({
            property: {
                name: property.name,
                propertyCode: property.propertyCode,
                manualUniqueId: property.manualUniqueId,
                type: property.type,
                status: property.status,
                address: property.address,
                location: property.location,
                dealerName: dealer?.name || null,
                salePrice: salePrice ?? null,
                totalUnits,
                occupied: occupiedUnits,
                totalArea: property.totalArea || null,
                yearBuilt: property.yearBuilt || null,
                ownerName: property.ownerName || null,
                ownerPhone: property.ownerPhone || null,
            },
            financeSummary: {
                totalReceived: ledgerIncome + totalDealReceived,
                totalExpenses: ledgerExpenses,
                pendingAmount: totalDealPending,
                entryCount: financeRecords.length,
            },
            financeRecords,
            deals: dealSummaries,
            sales: saleEntries,
            paymentPlans,
        }, res);
    }
    catch (error) {
        logger_1.default.error('Generate property report error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Get full property ledger (finance + payments) for a property
 * @route GET /api/properties/:id/ledger
 * @access Private
 */
router.get('/:id/ledger', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
            select: { id: true, name: true, dealerId: true },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        // Get deal IDs for this property
        const propertyDeals = await client_1.default.deal.findMany({
            where: { propertyId: id, isDeleted: false },
            select: { id: true },
        });
        const dealIds = propertyDeals.map((d) => d.id);
        const [financeEntries, dealPayments] = await Promise.all([
            client_1.default.financeLedger.findMany({
                where: {
                    dealId: { in: dealIds },
                    isDeleted: false
                },
                orderBy: { date: 'desc' },
            }),
            client_1.default.payment.findMany({
                where: {
                    deal: { propertyId: id, isDeleted: false, deletedAt: null },
                    deletedAt: null,
                },
                orderBy: { date: 'desc' },
                include: {
                    deal: { select: { id: true, title: true, dealAmount: true } },
                    createdBy: { select: { id: true, username: true, email: true } },
                },
            }),
        ]);
        const normalizedFinance = financeEntries.map((entry) => ({
            id: entry.id,
            date: entry.date,
            transactionType: entry.category,
            purpose: entry.description || entry.notes || '',
            amount: entry.amount,
            referenceType: entry.referenceType,
            description: entry.description,
            type: entry.category === 'debit' ? 'expense' : 'income',
        }));
        const normalizedPayments = dealPayments.map((payment) => ({
            id: payment.id,
            date: payment.date,
            amount: payment.amount,
            paymentMode: payment.paymentMode,
            paymentType: payment.paymentType,
            dealId: payment.dealId,
            dealTitle: payment.deal?.title,
            recordedBy: payment.createdBy?.username || payment.createdBy?.email || 'System',
            type: 'payment',
        }));
        const totalIncome = normalizedFinance
            .filter((f) => f.type === 'income')
            .reduce((sum, f) => sum + (f.amount || 0), 0);
        const totalExpenses = normalizedFinance
            .filter((f) => f.type === 'expense')
            .reduce((sum, f) => sum + (f.amount || 0), 0);
        const totalPayments = normalizedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return (0, error_handler_1.successResponse)(res, {
            summary: {
                totalIncome,
                totalExpenses,
                totalPayments,
                net: totalIncome - totalExpenses,
            },
            financeEntries: normalizedFinance,
            payments: normalizedPayments,
            property: {
                id: property.id,
                name: property.name,
                dealerId: property.dealerId,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get property ledger error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Create property
 * @route POST /api/properties
 * @access Private
 */
router.post('/', auth_1.authenticate, upload.any(), (0, validation_1.validateBody)(schemas_1.createPropertySchema), async (req, res) => {
    try {
        logger_1.default.debug('Create property request body:', JSON.stringify(req.body, null, 2));
        if (req.files) {
            logger_1.default.debug('Create property request files:', req.files);
        }
        // Request body is already validated by middleware (but now all fields are optional)
        const data = req.body;
        // TID validation is optional - only validate if provided, and don't block on errors
        if (data.tid && data.tid.trim()) {
            const tidColumnExists = await columnExists('Property', 'tid');
            if (tidColumnExists) {
                try {
                    await (0, id_generation_service_1.validateTID)(data.tid.trim());
                }
                catch (tidError) {
                    // Log but don't block - allow duplicate TIDs or other validation errors
                    logger_1.default.warn('TID validation failed (non-blocking):', {
                        tid: data.tid,
                        error: tidError?.message || tidError,
                    });
                    // Continue without TID validation - allow the property to be created anyway
                }
            }
        }
        // Generate unique property code (only if column exists)
        let propertyCode;
        try {
            const propertyCodeColumnExists = await columnExists('Property', 'propertyCode');
            if (propertyCodeColumnExists) {
                propertyCode = await (0, code_generator_1.generatePropertyCode)();
            }
        }
        catch (err) {
            logger_1.default.warn('Failed to generate property code:', err);
            // Continue without property code if generation fails
        }
        // Store extra attributes in documents field (keeps schema unchanged)
        let documentsData = null;
        // Only store non-schema fields in documents now
        // salePrice and amenities are now direct fields
        // Check if columns exist before including them
        const tidColumnExists = await columnExists('Property', 'tid');
        const subsidiaryOptionIdExists = await columnExists('Property', 'subsidiaryOptionId');
        // Handle file uploads
        const files = req.files || [];
        const photoFile = files.find(f => f.fieldname === 'photo');
        const attachmentFiles = files.filter(f => f.fieldname === 'attachments');
        // Build create data object - all fields optional, use defaults for missing required DB fields
        // Note: name, type, address, status, totalUnits are NOT NULL in database, so provide defaults
        const createData = {
            name: data.name || 'Unnamed Property',
            type: data.type || 'Unknown',
            address: data.address || 'Not specified',
            location: data.location || null,
            status: data.status || 'Active',
            imageUrl: data.imageUrl || null, // Will be updated after creation if file exists
            description: data.description || null,
            yearBuilt: data.yearBuilt || null,
            totalArea: data.totalArea || null,
            totalUnits: data.totalUnits ?? 0,
            dealerId: data.dealerId || null,
            locationId: data.locationId ?? null,
            salePrice: data.salePrice || null,
            amenities: Array.isArray(data.amenities) ? data.amenities : (data.amenities ? [data.amenities] : []),
        };
        // Only include columns that exist in the database
        if (subsidiaryOptionIdExists) {
            createData.subsidiaryOptionId = data.subsidiaryOptionId ?? null;
        }
        if (tidColumnExists && data.tid) {
            createData.tid = (data.tid || '').trim() || null;
        }
        if (propertyCode) {
            createData.propertyCode = propertyCode;
        }
        if (documentsData && Object.keys(documentsData).length > 0) {
            createData.documents = documentsData;
        }
        // Note: Property model does NOT have propertySubsidiaryId column
        // It has subsidiaryOptionId instead. propertySubsidiaryId exists on SubsidiaryOption model.
        // Try to create property, handle column errors gracefully
        let property;
        try {
            // Ensure propertySubsidiaryId is never in createData (it doesn't exist on Property)
            if ('propertySubsidiaryId' in createData) {
                delete createData.propertySubsidiaryId;
            }
            // Use select instead of include to avoid relation issues with missing columns
            const selectFields = {
                id: true,
                name: true,
                type: true,
                address: true,
                location: true,
                status: true,
                imageUrl: true,
                description: true,
                yearBuilt: true,
                totalArea: true,
                totalUnits: true,
                dealerId: true,
                locationId: true,
                createdAt: true,
                updatedAt: true,
                propertyCode: true,
                units: {
                    select: {
                        id: true,
                        unitName: true,
                    },
                },
                blocks: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            };
            // Only include optional columns if they exist
            if (tidColumnExists)
                selectFields.tid = true;
            if (subsidiaryOptionIdExists)
                selectFields.subsidiaryOptionId = true;
            property = await client_1.default.property.create({
                data: createData,
                select: selectFields,
            });
            // Handle file uploads (Video/Image/Attachments) using property.id
            if (photoFile) {
                try {
                    const { saveFileSecurely } = await Promise.resolve().then(() => __importStar(require('../utils/file-security')));
                    const path = await Promise.resolve().then(() => __importStar(require('path')));
                    const { relativePath } = await saveFileSecurely(photoFile.buffer, photoFile.originalname, 'properties', property.id);
                    // Store relative path as-is (without /api prefix)
                    // Frontend will construct full URL: /api/secure-files/...
                    const normalizedPath = relativePath.replace(/\\/g, '/');
                    // Update property with imageUrl
                    property = await client_1.default.property.update({
                        where: { id: property.id },
                        data: { imageUrl: normalizedPath },
                        select: selectFields,
                    });
                }
                catch (err) {
                    logger_1.default.error('Failed to save property photo:', err);
                }
            }
            // Save attachments if any
            if (attachmentFiles.length > 0) {
                try {
                    const { saveFileSecurely } = await Promise.resolve().then(() => __importStar(require('../utils/file-security')));
                    const path = await Promise.resolve().then(() => __importStar(require('path')));
                    await Promise.all(attachmentFiles.map(async (file) => {
                        const { relativePath, filename: secureFilename } = await saveFileSecurely(file.buffer, file.originalname, 'properties', property.id);
                        // Store relative path as-is (without /api prefix)
                        // Format: /secure-files/properties/{entityId}/{filename}
                        const normalizedPath = relativePath.replace(/\\/g, '/');
                        await client_1.default.attachment.create({
                            data: {
                                fileName: secureFilename,
                                fileUrl: normalizedPath,
                                fileType: file.mimetype,
                                fileSize: file.size,
                                entityType: 'property',
                                entityId: property.id,
                                propertyId: property.id,
                                uploadedBy: req.user.id,
                                description: `Property document: ${file.originalname}`,
                            },
                        });
                    }));
                }
                catch (attachErr) {
                    logger_1.default.error('Failed to save property attachments:', attachErr);
                    // Don't fail the request if attachments fail, but log it
                }
            }
        }
        catch (createError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'properties.ts:createError', message: 'Property create error caught', data: { code: createError?.code, message: createError?.message, meta: createError?.meta, createDataKeys: Object.keys(createData) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
            // #endregion
            // If error is about missing column, try again with minimal fields
            if (createError?.code === 'P2022' ||
                createError?.message?.includes('column') ||
                createError?.message?.includes('does not exist')) {
                logger_1.default.warn('Column error during property create, retrying with minimal fields:', createError.message);
                // Create with only essential fields that definitely exist
                const minimalData = {
                    name: data.name,
                    type: data.type,
                    address: data.address,
                    status: data.status || 'Active',
                    totalUnits: data.totalUnits || 0,
                };
                // Add optional fields that are safe
                if (data.location)
                    minimalData.location = data.location;
                if (data.imageUrl)
                    minimalData.imageUrl = data.imageUrl;
                if (data.description)
                    minimalData.description = data.description;
                if (data.yearBuilt)
                    minimalData.yearBuilt = data.yearBuilt;
                if (data.totalArea)
                    minimalData.totalArea = data.totalArea;
                if (data.dealerId)
                    minimalData.dealerId = data.dealerId;
                if (data.locationId)
                    minimalData.locationId = data.locationId;
                if (tidColumnExists && data.tid)
                    minimalData.tid = data.tid.trim();
                if (subsidiaryOptionIdExists && data.subsidiaryOptionId)
                    minimalData.subsidiaryOptionId = data.subsidiaryOptionId;
                if (propertyCode)
                    minimalData.propertyCode = propertyCode;
                if (data.salePrice)
                    minimalData.salePrice = data.salePrice;
                if (data.amenities)
                    minimalData.amenities = data.amenities;
                if (documentsData && Object.keys(documentsData).length > 0)
                    minimalData.documents = documentsData;
                // Note: propertySubsidiaryId does not exist on Property model - it's on SubsidiaryOption model
                property = await client_1.default.property.create({
                    data: minimalData,
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        address: true,
                        location: true,
                        status: true,
                        imageUrl: true,
                        description: true,
                        yearBuilt: true,
                        totalArea: true,
                        totalUnits: true,
                        dealerId: true,
                        locationId: true,
                        createdAt: true,
                        updatedAt: true,
                        propertyCode: true,
                        salePrice: true,
                        amenities: true,
                        ...(tidColumnExists && { tid: true }),
                        ...(subsidiaryOptionIdExists && { subsidiaryOptionId: true }),
                        units: {
                            select: {
                                id: true,
                                unitName: true,
                            },
                        },
                        blocks: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                });
            }
            else {
                throw createError;
            }
        }
        // Log activity
        await (0, activity_1.createActivity)({
            type: 'property',
            action: 'created',
            entityId: property.id,
            entityName: property.name,
            message: `Property "${property.name}" was added`,
            userId: req.user?.id,
            metadata: {
                propertyId: property.id,
                propertyName: property.name,
                status: property.status,
                type: property.type,
            },
        });
        // Attach salePrice and amenities on response for client convenience
        return (0, error_handler_1.successResponse)(res, property, 201);
    }
    catch (error) {
        logger_1.default.error('Create property error:', {
            error: error?.message || error,
            stack: error?.stack,
            body: req.body,
            code: error?.code,
        });
        // Handle Zod validation errors specifically
        if (error instanceof zod_1.ZodError) {
            return (0, error_handler_1.errorResponse)(res, 'Validation error', 400, error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })));
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
/**
 * Update property
 * @route PUT /api/properties/:id
 * @access Private
 */
router.put('/:id', auth_1.authenticate, upload.any(), (0, validation_1.validateBody)(schemas_1.updatePropertySchema), async (req, res) => {
    try {
        const { id } = req.params;
        // Log request for debugging
        logger_1.default.debug(`Update property ${id} request body:`, {
            ...req.body,
            imageUrl: req.body.imageUrl ? (req.body.imageUrl.substring(0, 50) + '...') : undefined
        });
        // Request body is already validated by middleware
        const data = req.body;
        // Check if property exists
        const existingProperty = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
        });
        if (!existingProperty) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        // Handle amenities and sale price in update - now direct fields
        const updateData = {
            ...data,
            salePrice: data.salePrice,
            amenities: data.amenities,
        };
        // Check if columns exist before including them in update
        const subsidiaryOptionIdExists = await columnExists('Property', 'subsidiaryOptionId');
        const tidColumnExists = await columnExists('Property', 'tid');
        // Handle locationId separately since it's a direct field
        const finalUpdateData = {
            ...updateData,
            imageUrl: data.imageUrl !== undefined ? (data.imageUrl || null) : undefined,
        };
        // Remove subsidiaryOptionId and tid from update if columns don't exist
        if (!subsidiaryOptionIdExists && 'subsidiaryOptionId' in finalUpdateData) {
            delete finalUpdateData.subsidiaryOptionId;
        }
        if (!tidColumnExists && 'tid' in finalUpdateData) {
            delete finalUpdateData.tid;
        }
        if ('locationId' in data) {
            finalUpdateData.locationId = data.locationId ?? null;
        }
        // Try to update with locationNode, fallback if P2022 error
        let property;
        try {
            property = await client_1.default.property.update({
                where: { id },
                data: finalUpdateData,
                include: {
                    units: {
                        where: { isDeleted: false },
                    },
                    blocks: {
                        where: { isDeleted: false },
                    },
                    locationNode: true,
                },
            });
        }
        catch (error) {
            // If P2022 error (column not found), retry without locationNode
            if (error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('Location')) {
                logger_1.default.warn('LocationNode relation not available in update, fetching without it:', error.message);
                property = await client_1.default.property.update({
                    where: { id },
                    data: finalUpdateData,
                    include: {
                        units: {
                            where: { isDeleted: false },
                        },
                        blocks: {
                            where: { isDeleted: false },
                        },
                    },
                });
            }
            else {
                throw error;
            }
        }
        // Extract amenities and salePrice from response (now direct fields)
        return (0, error_handler_1.successResponse)(res, property);
    }
    catch (error) {
        logger_1.default.error('Update property error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Delete property (soft delete)
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
            include: {
                units: { where: { isDeleted: false } },
                blocks: { where: { isDeleted: false } },
                floors: { where: { isDeleted: false } },
                tenancies: { where: { status: 'active' } },
            },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        // Use transaction to ensure all deletions happen together
        await client_1.default.$transaction(async (tx) => {
            // Soft delete all units related to this property
            await tx.unit.updateMany({
                where: {
                    propertyId: id,
                    isDeleted: false,
                },
                data: {
                    isDeleted: true,
                    status: 'Vacant', // Also set status to Vacant
                },
            });
            // Soft delete all blocks related to this property
            await tx.block.updateMany({
                where: {
                    propertyId: id,
                    isDeleted: false,
                },
                data: { isDeleted: true },
            });
            // Soft delete all floors related to this property
            await tx.floor.updateMany({
                where: {
                    propertyId: id,
                    isDeleted: false,
                },
                data: { isDeleted: true },
            });
            // Soft delete property
            await tx.property.update({
                where: { id },
                data: { isDeleted: true },
            });
            // Update all units to Vacant status if they were occupied (already done above, but keeping for clarity)
            // This is redundant now but kept for backward compatibility
            // End all active tenancies
            await tx.tenancy.updateMany({
                where: {
                    propertyId: id,
                    status: 'active',
                },
                data: { status: 'ended' },
            });
        });
        // Log activity
        await (0, activity_1.createActivity)({
            type: 'property',
            action: 'deleted',
            entityId: property.id,
            entityName: property.name,
            message: `Property "${property.name}" was deleted along with ${property.units.length} units, ${property.blocks.length} blocks, and ${property.floors.length} floors`,
            userId: req.user?.id,
            metadata: {
                propertyId: property.id,
                propertyName: property.name,
                unitsDeleted: property.units.length,
                blocksDeleted: property.blocks.length,
                floorsDeleted: property.floors.length,
                tenanciesEnded: property.tenancies.length,
            },
        });
        return (0, error_handler_1.successResponse)(res, {
            unitsDeleted: property.units.length,
            blocksDeleted: property.blocks.length,
            floorsDeleted: property.floors.length,
            tenanciesEnded: property.tenancies.length,
        });
    }
    catch (error) {
        logger_1.default.error('Delete property error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get property alerts (maintenance due + lease expiry)
router.get('/:id/alerts', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const property = await client_1.default.property.findFirst({
            where: { id, isDeleted: false },
        });
        if (!property) {
            return (0, error_handler_1.errorResponse)(res, 'Property not found', 404);
        }
        const alerts = await (0, property_alerts_1.getAllPropertyAlerts)(id);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get property alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get all maintenance due alerts
router.get('/alerts/maintenance', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId } = req.query;
        const alerts = await (0, property_alerts_1.getMaintenanceDueAlerts)(propertyId ? propertyId : undefined);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get maintenance alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Get all lease expiry alerts
router.get('/alerts/lease-expiry', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId } = req.query;
        const alerts = await (0, property_alerts_1.getLeaseExpiryAlerts)(propertyId ? propertyId : undefined);
        return (0, error_handler_1.successResponse)(res, alerts);
    }
    catch (error) {
        logger_1.default.error('Get lease expiry alerts error:', error);
        return (0, error_handler_1.errorResponse)(res, error);
    }
});
// Generate Properties Report PDF with Subsidiary Logo Watermarks
router.get('/report/pdf', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyIds } = req.query;
        // Build where clause
        const where = { isDeleted: false };
        // Filter by property IDs if provided
        if (propertyIds) {
            const ids = Array.isArray(propertyIds) ? propertyIds : [propertyIds];
            where.id = { in: ids.map(id => String(id)) };
        }
        // Fetch properties with subsidiary information
        const properties = await client_1.default.property.findMany({
            where,
            select: {
                id: true,
                name: true,
                propertyCode: true,
                type: true,
                address: true,
                salePrice: true,
                subsidiaryOption: {
                    select: {
                        id: true,
                        name: true,
                        propertySubsidiary: {
                            select: {
                                id: true,
                                name: true,
                                logoPath: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (properties.length === 0) {
            return (0, error_handler_1.errorResponse)(res, 'No properties found', 404);
        }
        // Generate PDF report
        await (0, pdf_generator_1.generatePropertiesReportPDF)({
            properties: properties.map(p => ({
                id: p.id,
                name: p.name,
                propertyCode: p.propertyCode,
                type: p.type,
                address: p.address,
                salePrice: p.salePrice,
                subsidiaryOption: p.subsidiaryOption ? {
                    id: p.subsidiaryOption.id,
                    name: p.subsidiaryOption.name,
                    propertySubsidiary: p.subsidiaryOption.propertySubsidiary ? {
                        id: p.subsidiaryOption.propertySubsidiary.id,
                        name: p.subsidiaryOption.propertySubsidiary.name,
                        logoPath: p.subsidiaryOption.propertySubsidiary.logoPath,
                    } : null,
                } : null,
            })),
            generatedAt: new Date(),
        }, res);
    }
    catch (error) {
        logger_1.default.error('Generate properties report PDF error:', error);
        if (!res.headersSent) {
            return (0, error_handler_1.errorResponse)(res, error);
        }
    }
});
exports.default = router;
//# sourceMappingURL=properties.js.map