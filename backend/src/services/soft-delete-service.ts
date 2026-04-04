/**
 * Soft Delete Service
 * Handles soft deletion of records and moves them to recycle bin
 * Records are kept indefinitely until manually removed
 */

import prisma from '../prisma/client';
import logger from '../utils/logger';

interface SoftDeleteOptions {
  entityType: string;
  entityId: string;
  entityName: string;
  deletedBy?: string;
  deletedByName?: string;
}

/**
 * Soft delete a record - marks it as deleted and adds to recycle bin
 */
export async function softDeleteRecord(options: SoftDeleteOptions): Promise<void> {
  const { entityType, entityId, entityName, deletedBy, deletedByName } = options;
  
  const now = new Date();
  // Set expiresAt to far future date (year 2099) to keep records indefinitely
  // Records will only be deleted when manually removed
  const expiresAt = new Date('2099-12-31T23:59:59.999Z');

  await prisma.$transaction(async (tx) => {
    // Get the full record data before soft deleting
    let entityData: any = null;
    
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

    logger.info(`Soft deleted ${entityType}: ${entityId} (${entityName}) by user ${deletedBy}`);
  }, { timeout: 30000 }); // Increase timeout to 30 seconds
}

/**
 * Permanently delete expired records from recycle bin
 * DISABLED: Records are now kept indefinitely until manually removed
 * This function is kept for backward compatibility but does nothing
 */
export async function cleanupExpiredRecords(): Promise<number> {
  // Auto-cleanup is disabled - records are kept indefinitely
  // Records can only be deleted manually through the UI
  logger.info('Auto-cleanup is disabled. Records are kept indefinitely until manually removed.');
  return 0;
}

export const SoftDeleteService = {
  softDeleteRecord,
  cleanupExpiredRecords,
};
