"use strict";
/**
 * Soft Delete Service
 * Handles soft deletion of records and moves them to recycle bin
 * Records are kept indefinitely until manually removed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoftDeleteService = void 0;
exports.softDeleteRecord = softDeleteRecord;
exports.cleanupExpiredRecords = cleanupExpiredRecords;
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Soft delete a record - marks it as deleted and adds to recycle bin
 */
async function softDeleteRecord(options) {
    const { entityType, entityId, entityName, deletedBy, deletedByName } = options;
    const now = new Date();
    // Set expiresAt to far future date (year 2099) to keep records indefinitely
    // Records will only be deleted when manually removed
    const expiresAt = new Date('2099-12-31T23:59:59.999Z');
    await client_1.default.$transaction(async (tx) => {
        // Get the full record data before soft deleting
        let entityData = null;
        switch (entityType) {
            case 'lead':
                entityData = await tx.lead.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.lead.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'client':
                entityData = await tx.client.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.client.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'dealer':
                entityData = await tx.dealer.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.dealer.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'deal':
                entityData = await tx.deal.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.deal.update({
                        where: { id: entityId },
                        data: {
                            isDeleted: true,
                            deletedAt: now,
                            deletedBy: deletedBy,
                        },
                    });
                }
                break;
            case 'employee':
                entityData = await tx.employee.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.employee.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'property':
                entityData = await tx.property.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.property.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'unit':
                entityData = await tx.unit.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.unit.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'tenant':
                entityData = await tx.tenant.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.tenant.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'lease':
                entityData = await tx.lease.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.lease.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'communication':
                entityData = await tx.communication.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.communication.update({
                        where: { id: entityId },
                        data: { isDeleted: true },
                    });
                }
                break;
            case 'payment':
                entityData = await tx.payment.findUnique({ where: { id: entityId } });
                if (entityData) {
                    await tx.payment.update({
                        where: { id: entityId },
                        data: {
                            deletedAt: now,
                            deletedBy: deletedBy,
                        },
                    });
                }
                break;
            default:
                throw new Error(`Unsupported entity type for soft delete: ${entityType}`);
        }
        if (!entityData) {
            throw new Error(`${entityType} with id ${entityId} not found`);
        }
        // Add to recycle bin
        await tx.deletedRecord.create({
            data: {
                entityType,
                entityId,
                entityName,
                entityData,
                deletedBy,
                deletedByName,
                deletedAt: now,
                expiresAt,
            },
        });
        logger_1.default.info(`Soft deleted ${entityType}: ${entityId} (${entityName}) by user ${deletedBy}`);
    }, { timeout: 30000 }); // Increase timeout to 30 seconds
}
/**
 * Permanently delete expired records from recycle bin
 * DISABLED: Records are now kept indefinitely until manually removed
 * This function is kept for backward compatibility but does nothing
 */
async function cleanupExpiredRecords() {
    // Auto-cleanup is disabled - records are kept indefinitely
    // Records can only be deleted manually through the UI
    logger_1.default.info('Auto-cleanup is disabled. Records are kept indefinitely until manually removed.');
    return 0;
}
exports.SoftDeleteService = {
    softDeleteRecord,
    cleanupExpiredRecords,
};
//# sourceMappingURL=soft-delete-service.js.map