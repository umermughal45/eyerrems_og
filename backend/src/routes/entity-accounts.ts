import express, { Response } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/error-handler';
import { getSecureUploadDir } from '../utils/file-security';
import path from 'path';
import fs from 'fs/promises';
import { createAttachment as createAttachmentRecord, getAttachments as getEntityAttachments, deleteAttachment as softDeleteAttachment } from '../services/attachments';
import { createAuditLog, getAuditLogs } from '../services/audit-log';

// Helper function to build full account path
async function buildAccountPath(account: any): Promise<string> {
  const pathParts: string[] = [account.name];
  let current = account;

  while (current.parentId) {
    const parent = await prisma.account.findUnique({
      where: { id: current.parentId },
      select: { name: true, parentId: true },
    });
    if (parent) {
      pathParts.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }

  return pathParts.join(' > ');
}

const router = (express as any).Router();

// Validation Schemas
const bindAccountSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  accountId: z.string().uuid(),
});

const updateMetadataSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  notes: z.string().optional(),
  references: z.record(z.any()).optional(),
});

/**
 * POST /bind
 * Bind an entity to an account
 */
router.post('/bind', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, accountId } = bindAccountSchema.parse(req.body);

    logger.info(`[Bind Account] Starting bind operation: entityType=${entityType}, entityId=${entityId}, accountId=${accountId}, userId=${req.user?.id}`);

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, code: true, name: true, isActive: true }
    });

    if (!account) {
      logger.error(`[Bind Account] Account not found: ${accountId}`);
      return errorResponse(res, new Error('Account not found'), 404);
    }

    if (!account.isActive) {
      logger.warn(`[Bind Account] Attempting to bind inactive account: ${accountId}`);
    }

    logger.info(`[Bind Account] Account verified: ${account.code} - ${account.name}`);

    const binding = await prisma.entityAccountBinding.upsert({
      where: {
        entityType_entityId_accountId: {
          entityType,
          entityId,
          accountId,
        },
      },
      update: {
        updatedAt: new Date(),
        createdBy: req.user?.id,
      },
      create: {
        entityType,
        entityId,
        accountId,
        createdBy: req.user?.id,
      },
      include: {
        account: {
          include: {
            parent: true,
          },
        },
      },
    });

    logger.info(`[Bind Account] Binding created/updated successfully: bindingId=${binding.id}`);

    // Verify the binding was actually saved
    const verifyBinding = await prisma.entityAccountBinding.findUnique({
      where: { id: binding.id },
      include: { account: true }
    });

    if (!verifyBinding) {
      logger.error(`[Bind Account] Binding verification failed: bindingId=${binding.id}`);
      return errorResponse(res, new Error('Failed to verify binding creation'), 500);
    }

    logger.info(`[Bind Account] Binding verified in database: bindingId=${verifyBinding.id}, accountId=${verifyBinding.accountId}`);

    return successResponse(res, binding);
  } catch (error) {
    logger.error('[Bind Account] Error binding entity to account:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /bindings/:entityType/:entityId
 * Get bindings for an entity with account balances and expense/income totals
 */
router.get('/bindings/:entityType/:entityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    logger.info(`[Get Bindings] Fetching bindings for entityType=${entityType}, entityId=${entityId}`);

    const bindings = await prisma.entityAccountBinding.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        account: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.info(`[Get Bindings] Found ${bindings.length} bindings in database`);

    // Build full path and calculate balances for each account
    const bindingsWithPath = await Promise.all(
      bindings.map(async (binding) => {
        const fullPath = await buildAccountPath(binding.account);
        
        // Calculate account balance from ledger entries
        const [debitTotal, creditTotal] = await Promise.all([
          prisma.ledgerEntry.aggregate({
            where: { 
              debitAccountId: binding.accountId, 
              deletedAt: null 
            },
            _sum: { amount: true },
          }),
          prisma.ledgerEntry.aggregate({
            where: { 
              creditAccountId: binding.accountId, 
              deletedAt: null 
            },
            _sum: { amount: true },
          }),
        ]);

        const debitSum = debitTotal._sum.amount || 0;
        const creditSum = creditTotal._sum.amount || 0;

        // Calculate balance based on normal balance
        let balance = 0;
        if (binding.account.normalBalance === 'Debit') {
          balance = debitSum - creditSum;
        } else {
          balance = creditSum - debitSum;
        }

        // Calculate expense/income totals related to this entity
        // This would need to be customized based on how expenses are linked to entities
        // For now, we'll query ledger entries that reference this entity
        let entityExpenseTotal = 0;
        let entityIncomeTotal = 0;

        try {
          // Query ledger entries that might reference this entity
          // This is a simplified approach - you may need to adjust based on your data model
          const entityLedgerEntries = await prisma.ledgerEntry.findMany({
            where: {
              OR: [
                { debitAccountId: binding.accountId },
                { creditAccountId: binding.accountId },
              ],
              deletedAt: null,
              // Add entity reference if your ledger entries have entityType/entityId fields
              // Otherwise, this will need to be adjusted based on your schema
            },
            select: {
              amount: true,
              debitAccountId: true,
              creditAccountId: true,
            },
            take: 1000, // Limit to prevent performance issues
          });

          entityLedgerEntries.forEach((entry) => {
            if (entry.debitAccountId === binding.accountId) {
              // Debit to this account (expense for asset/expense accounts, income for liability/equity/revenue)
              if (binding.account.type?.toLowerCase() === 'expense' || 
                  binding.account.type?.toLowerCase() === 'asset') {
                entityExpenseTotal += entry.amount || 0;
              } else {
                entityIncomeTotal += entry.amount || 0;
              }
            } else if (entry.creditAccountId === binding.accountId) {
              // Credit to this account (income for liability/equity/revenue accounts)
              if (binding.account.type?.toLowerCase() === 'revenue' || 
                  binding.account.type?.toLowerCase() === 'liability' ||
                  binding.account.type?.toLowerCase() === 'equity') {
                entityIncomeTotal += entry.amount || 0;
              } else {
                entityExpenseTotal += entry.amount || 0;
              }
            }
          });
        } catch (expenseError) {
          logger.warn(`[Get Bindings] Error calculating expense/income totals: ${expenseError}`);
        }

        return {
          ...binding,
          account: {
            ...binding.account,
            fullPath,
            balance: Number(balance.toFixed(2)),
            debitTotal: Number(debitSum.toFixed(2)),
            creditTotal: Number(creditSum.toFixed(2)),
            entityExpenseTotal: Number(entityExpenseTotal.toFixed(2)),
            entityIncomeTotal: Number(entityIncomeTotal.toFixed(2)),
          },
        };
      })
    );

    logger.info(`[Get Bindings] Returning ${bindingsWithPath.length} bindings with balances`);

    return successResponse(res, bindingsWithPath);
  } catch (error) {
    logger.error('[Get Bindings] Error fetching entity bindings:', error);
    return errorResponse(res, error);
  }
});

/**
 * DELETE /bindings/:entityType/:entityId/:accountId
 * Unbind an account from an entity
 */
router.delete('/bindings/:entityType/:entityId/:accountId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, accountId } = req.params;

    logger.info(`[Unbind Account] Starting unbind operation: entityType=${entityType}, entityId=${entityId}, accountId=${accountId}, userId=${req.user?.id}`);

    // Verify binding exists before deletion
    const existingBinding = await prisma.entityAccountBinding.findUnique({
      where: {
        entityType_entityId_accountId: {
          entityType,
          entityId,
          accountId,
        },
      },
      include: {
        account: {
          select: { code: true, name: true }
        }
      }
    });

    if (!existingBinding) {
      logger.warn(`[Unbind Account] Binding not found: entityType=${entityType}, entityId=${entityId}, accountId=${accountId}`);
      return errorResponse(res, new Error('Binding not found'), 404);
    }

    logger.info(`[Unbind Account] Binding found: account=${existingBinding.account.code} - ${existingBinding.account.name}`);

    const deleted = await prisma.entityAccountBinding.delete({
      where: {
        entityType_entityId_accountId: {
          entityType,
          entityId,
          accountId,
        },
      },
    });

    logger.info(`[Unbind Account] Binding deleted successfully: bindingId=${deleted.id}`);

    return successResponse(res, deleted);
  } catch (error) {
    logger.error('[Unbind Account] Error unbinding account:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /metadata
 * Update metadata for an entity
 */
router.post('/metadata', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId, notes, references } = updateMetadataSchema.parse(req.body);

    const metadata = await prisma.entityMetadata.upsert({
      where: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
      update: {
        notes,
        references: references || undefined,
        updatedAt: new Date(),
      },
      create: {
        entityType,
        entityId,
        notes,
        references,
      },
    });

    return successResponse(res, metadata);
  } catch (error) {
    logger.error('Error updating entity metadata:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /metadata/:entityType/:entityId
 * Get metadata for an entity
 */
router.get('/metadata/:entityType/:entityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    const metadata = await prisma.entityMetadata.findUnique({
      where: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
    });

    return successResponse(res, metadata || null);
  } catch (error) {
    logger.error('Error fetching entity metadata:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /history/:entityType/:entityId
 * Get transaction history for an entity via its bound account
 */
router.get('/history/:entityType/:entityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    // First get the bound accounts
    const bindings = await prisma.entityAccountBinding.findMany({
      where: {
        entityType,
        entityId,
      },
    });

    if (!bindings.length) {
      return successResponse(res, []);
    }

    const accountIds = bindings.map(b => b.accountId);

    // Then fetch transactions for those accounts
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { debitAccountId: { in: accountIds } },
          { creditAccountId: { in: accountIds } },
        ],
      },
      include: {
        debitAccount: { select: { name: true, code: true } },
        creditAccount: { select: { name: true, code: true } },
      },
      orderBy: {
        date: 'desc',
      },
      take: 100,
    });

    return successResponse(res, transactions);
  } catch (error) {
    logger.error('Error fetching entity history:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /audit/:entityType/:entityId
 * Get change history (audit logs) for an entity
 */
router.get('/audit/:entityType/:entityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const logs = await getAuditLogs(entityType, entityId, 100);
    return successResponse(res, logs);
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /audit
 * Add an audit log entry
 */
router.post('/audit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      entityType: z.string(),
      entityId: z.string(),
      action: z.string(),
      oldValue: z.string().optional(),
      newValue: z.string().optional(),
      description: z.string().optional(),
    });
    const { entityType, entityId, action, oldValue, newValue, description } = schema.parse(req.body);
    const log = await createAuditLog({
      entityType,
      entityId,
      action: action as any,
      userId: req.user?.id,
      userName: req.user?.username,
      description,
      oldValues: oldValue ? { value: oldValue } : undefined,
      newValues: newValue ? { value: newValue } : undefined,
      req,
    });
    return successResponse(res, log);
  } catch (error) {
    logger.error('Error creating audit log:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /attachments/:entityType/:entityId
 * List attachments for an entity
 */
router.get('/attachments/:entityType/:entityId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const attachments = await getEntityAttachments(entityType, entityId);
    return successResponse(res, attachments);
  } catch (error) {
    logger.error('Error fetching attachments:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /attachments
 * Upload attachment (base64) for an entity
 */
router.post('/attachments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      entityType: z.string(),
      entityId: z.string(),
      file: z.string(),
      filename: z.string(),
      fileType: z.string().optional(),
      description: z.string().optional(),
    });
    const { entityType, entityId, file, filename, fileType, description } = schema.parse(req.body);

    const base64Data = file.split(',')[1] || file;
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadRoot = await getSecureUploadDir();
    const entityDir = path.join(uploadRoot, entityType, entityId);
    await fs.mkdir(entityDir, { recursive: true });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${safeName}`;
    const filePath = path.join(entityDir, uniqueName);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/secure-files/${entityType}/${entityId}/${uniqueName}`;
    const created = await createAttachmentRecord({
      fileName: uniqueName,
      fileUrl,
      fileType,
      fileSize: buffer.length,
      entityType,
      entityId,
      uploadedBy: req.user?.id,
      description,
    });

    return successResponse(res, created);
  } catch (error) {
    logger.error('Error uploading attachment:', error);
    return errorResponse(res, error);
  }
});

/**
 * DELETE /attachments/:id
 * Soft delete an attachment and remove physical file
 */
router.delete('/attachments/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await softDeleteAttachment(id);
    return successResponse(res, deleted);
  } catch (error) {
    logger.error('Error deleting attachment:', error);
    return errorResponse(res, error);
  }
});

export default router;
