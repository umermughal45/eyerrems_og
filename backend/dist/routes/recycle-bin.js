"use strict";
/**
 * Recycle Bin Routes
 * System-wide recycle bin for soft-deleted records
 * Records are kept indefinitely until manually removed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = __importDefault(require("../prisma/client"));
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
const pagination_1 = require("../utils/pagination");
const error_handler_1 = require("../utils/error-handler");
const router = express_1.default.Router();
// Get all deleted records with pagination and filtering
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
        const skip = (page - 1) * limit;
        const { entityType, search } = req.query;
        const where = {};
        // Filter by entity type if provided
        if (entityType && entityType !== 'all') {
            where.entityType = entityType;
        }
        // Search by entity name
        if (search) {
            where.entityName = {
                contains: search,
                mode: 'insensitive',
            };
        }
        const [records, total] = await Promise.all([
            client_1.default.deletedRecord.findMany({
                where,
                orderBy: { deletedAt: 'desc' },
                skip,
                take: limit,
            }),
            client_1.default.deletedRecord.count({ where }),
        ]);
        // Records are kept indefinitely - no expiry calculation needed
        const recordsWithDays = records.map((record) => {
            return {
                ...record,
                remainingDays: null, // No expiry - records kept indefinitely
                entityData: undefined, // Don't send full data in list view
            };
        });
        const pagination = (0, pagination_1.calculatePagination)(page, limit, total);
        return (0, error_handler_1.successResponse)(res, recordsWithDays, 200, pagination);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch deleted records:', error);
        res.status(500).json({ error: 'Failed to fetch deleted records' });
    }
});
// Get available entity types for filtering
router.get('/entity-types', auth_1.authenticate, async (req, res) => {
    try {
        const types = await client_1.default.deletedRecord.groupBy({
            by: ['entityType'],
            _count: { entityType: true },
        });
        const entityTypes = types.map((t) => ({
            type: t.entityType,
            count: t._count.entityType,
            label: getEntityTypeLabel(t.entityType),
        }));
        res.json({ success: true, data: entityTypes });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch entity types:', error);
        res.status(500).json({ error: 'Failed to fetch entity types' });
    }
});
// Restore a deleted record
router.post('/:id/restore', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedRecord = await client_1.default.deletedRecord.findUnique({
            where: { id },
        });
        if (!deletedRecord) {
            return res.status(404).json({ error: 'Deleted record not found' });
        }
        // Records are kept indefinitely - no expiry check needed
        const entityData = deletedRecord.entityData;
        // Restore the record based on entity type
        let restoredRecord = null;
        await client_1.default.$transaction(async (tx) => {
            switch (deletedRecord.entityType) {
                case 'lead':
                    restoredRecord = await tx.lead.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'client':
                    restoredRecord = await tx.client.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'dealer':
                    restoredRecord = await tx.dealer.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'deal':
                    restoredRecord = await tx.deal.update({
                        where: { id: deletedRecord.entityId },
                        data: {
                            isDeleted: false,
                            deletedAt: null,
                            deletedBy: null,
                        },
                    });
                    break;
                case 'employee':
                    restoredRecord = await tx.employee.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'property':
                    restoredRecord = await tx.property.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'unit':
                    restoredRecord = await tx.unit.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'tenant':
                    restoredRecord = await tx.tenant.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'lease':
                    restoredRecord = await tx.lease.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                case 'communication':
                    restoredRecord = await tx.communication.update({
                        where: { id: deletedRecord.entityId },
                        data: { isDeleted: false },
                    });
                    break;
                default:
                    throw new Error(`Unsupported entity type: ${deletedRecord.entityType}`);
            }
            // Remove from recycle bin after successful restore
            await tx.deletedRecord.delete({
                where: { id },
            });
        });
        logger_1.default.info(`Record restored: ${deletedRecord.entityType} - ${deletedRecord.entityId} by user ${req.user?.id}`);
        res.json({
            success: true,
            message: `${getEntityTypeLabel(deletedRecord.entityType)} "${deletedRecord.entityName}" has been restored`,
            data: restoredRecord,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to restore record:', error);
        res.status(500).json({
            error: 'Failed to restore record',
            message: error.message,
        });
    }
});
// Get single deleted record details (for preview)
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const record = await client_1.default.deletedRecord.findUnique({
            where: { id },
        });
        if (!record) {
            return res.status(404).json({ error: 'Deleted record not found' });
        }
        // Records are kept indefinitely - no expiry calculation needed
        res.json({
            success: true,
            data: {
                ...record,
                remainingDays: null, // No expiry - records kept indefinitely
            },
        });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch deleted record:', error);
        res.status(500).json({ error: 'Failed to fetch deleted record' });
    }
});
// Helper function to get human-readable entity type labels
function getEntityTypeLabel(entityType) {
    const labels = {
        lead: 'Lead',
        client: 'Client',
        dealer: 'Dealer',
        deal: 'Deal',
        employee: 'Employee',
        property: 'Property',
        unit: 'Unit',
        tenant: 'Tenant',
        lease: 'Lease',
        communication: 'Communication',
        sale: 'Sale',
        attendance: 'Attendance',
        payroll: 'Payroll',
        leaveRequest: 'Leave Request',
    };
    return labels[entityType] || entityType.charAt(0).toUpperCase() + entityType.slice(1);
}
exports.default = router;
//# sourceMappingURL=recycle-bin.js.map