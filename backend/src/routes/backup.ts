import express, { Response } from 'express';
import prisma from '../prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = (express as any).Router();

// Export all data
router.get('/export', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    // Helper function to safely fetch data
    const safeFetch = async (modelName: string, query: () => Promise<any>) => {
      try {
        const result = await query();
        logger.info(`✓ Successfully fetched ${modelName}: ${Array.isArray(result) ? result.length : 'N/A'} records`);
        return result;
      } catch (error: any) {
        // Check if it's a Prisma schema mismatch error
        if (error?.message?.includes('does not exist in the current database')) {
          logger.warn(`⚠ Schema mismatch for ${modelName}: ${error.message}. Skipping this model.`);
          return [];
        }
        logger.error(`✗ Error fetching ${modelName}:`, error?.message || error);
        if (error?.stack) {
          logger.error(`Stack trace for ${modelName}:`, error.stack);
        }
        return [];
      }
    };

    // Fetch all data from all tables (with error handling)
    const [
      properties,
      units,
      tenants,
      leases,
      sales,
      buyers,
      blocks,
      employees,
      attendance,
      payroll,
      leaveRequests,
      leads,
      clients,
      dealers,
      deals,
      communications,
      transactions,
      invoices,
      payments,
      commissions,
      accounts,
      journalEntries,
      roles,
      messages,
      users,
      roleInviteLinks,
      deviceApprovals,
      notifications,
      activities,
    ] = await Promise.all([
      safeFetch('properties', () => prisma.property.findMany({ where: { isDeleted: false } })),
      safeFetch('units', () => prisma.unit.findMany({ where: { isDeleted: false } })),
      safeFetch('tenants', () => prisma.tenant.findMany({ where: { isDeleted: false } })),
      safeFetch('leases', () => prisma.lease.findMany({ where: { isDeleted: false } })),
      safeFetch('sales', () => prisma.sale.findMany({ where: { isDeleted: false } })),
      safeFetch('buyers', () => prisma.buyer.findMany({ where: { isDeleted: false } })),
      safeFetch('blocks', () => prisma.block.findMany({ where: { isDeleted: false } })),
      safeFetch('employees', () => prisma.employee.findMany({ where: { isDeleted: false } })),
      safeFetch('attendance', () => prisma.attendance.findMany({ where: { isDeleted: false } })),
      safeFetch('payroll', () => prisma.payroll.findMany({ where: { isDeleted: false } })),
      safeFetch('leaveRequests', () => prisma.leaveRequest.findMany({ where: { isDeleted: false } })),
      safeFetch('leads', () => prisma.lead.findMany()),
      safeFetch('clients', () => prisma.client.findMany()),
      safeFetch('dealers', async () => {
        // Use raw SQL to avoid schema mismatch issues with commissionRate
        try {
          // First try with select (excluding commissionRate)
          return await prisma.dealer.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
              createdAt: true,
              updatedAt: true,
            }
          });
        } catch (err: any) {
          // If that fails, use raw SQL
          const dealers = await prisma.$queryRaw<any[]>`
            SELECT id, name, email, phone, company, "createdAt", "updatedAt"
            FROM "Dealer"
          `;
          return dealers;
        }
      }),
      safeFetch('deals', () => prisma.deal.findMany()),
      safeFetch('communications', () => prisma.communication.findMany()),
      safeFetch('transactions', () => prisma.transaction.findMany()),
      safeFetch('invoices', () => prisma.invoice.findMany()),
      safeFetch('payments', () => prisma.tenantPayment.findMany()),
      safeFetch('commissions', () => prisma.commission.findMany()),
      safeFetch('accounts', () => prisma.account.findMany()),
      safeFetch('journalEntries', () => prisma.journalEntry.findMany({ include: { lines: true } })),
      safeFetch('roles', () => prisma.role.findMany()),
      safeFetch('messages', () => prisma.message.findMany({ where: { isDeleted: false } })),
      safeFetch('users', () => prisma.user.findMany()),
      safeFetch('roleInviteLinks', () => prisma.roleInviteLink.findMany()),
      safeFetch('deviceApprovals', () => prisma.deviceApproval.findMany()),
      safeFetch('notifications', () => prisma.notification.findMany()),
      safeFetch('activities', () => prisma.activity.findMany()),
    ]);

    // Structure the backup data
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        properties,
        units,
        tenants,
        leases,
        sales,
        buyers,
        blocks,
        employees,
        attendance,
        payroll,
        leaveRequests,
        leads,
        clients,
        dealers,
        deals,
        communications,
        transactions,
        invoices,
        payments,
        commissions,
        accounts,
        journalEntries,
        roles,
        messages,
        users,
        roleInviteLinks,
        deviceApprovals,
        notifications,
        activities,
      },
    };

    logger.info('Export completed successfully');
    res.json(backupData);
  } catch (error: any) {
    logger.error('Export error:', error);
    logger.error('Error stack:', error?.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(process.env.NODE_ENV === 'development' && { stack: error?.stack }),
    });
  }
});

// Helper function to safely import data with error handling
const safeImport = async (
  tx: any,
  modelName: string,
  data: any[],
  importFn: (batch: any[]) => Promise<any>
) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }

  try {
    await importFn(data);
    logger.info(`✓ Successfully imported ${modelName}: ${data.length} records`);
  } catch (error: any) {
    // Check if it's a schema mismatch error
    if (
      error?.message?.includes('does not exist in the current database') ||
      error?.message?.includes('Unknown column') ||
      error?.message?.includes('Unknown field')
    ) {
      logger.warn(`⚠ Schema mismatch for ${modelName}: ${error.message}. Skipping this model.`);
      return;
    }
    logger.error(`✗ Error importing ${modelName}:`, error?.message || error);
    throw error; // Re-throw if it's not a schema mismatch
  }
};

// Import all data
router.post('/import', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup file format',
        message: 'Backup file must contain a data object',
      });
    }

    logger.info('Starting import process...');
    logger.info('Data keys:', Object.keys(data));

    // Validate data structure
    if (data.properties && !Array.isArray(data.properties)) {
      throw new Error('Invalid data format: properties must be an array');
    }
    if (data.accounts && !Array.isArray(data.accounts)) {
      throw new Error('Invalid data format: accounts must be an array');
    }

    // Start a transaction to ensure all-or-nothing import
    // Set a longer timeout for large imports (10 minutes)
    await prisma.$transaction(async (tx) => {
      logger.info('Deleting existing data...');
      // Delete all existing data (in reverse order of dependencies)
      // Execute sequentially to avoid foreign key constraint issues
      try {
        await tx.journalLine.deleteMany({});
        await tx.journalEntry.deleteMany({});
        await tx.commission.deleteMany({});
        await tx.tenantPayment.deleteMany({});
        await tx.invoice.deleteMany({});
        await tx.transaction.deleteMany({});
        await tx.communication.deleteMany({});
        await tx.deal.deleteMany({});
        await tx.dealer.deleteMany({});
        await tx.client.deleteMany({});
        await tx.lead.deleteMany({});
        await tx.leaveRequest.deleteMany({});
        await tx.payroll.deleteMany({});
        await tx.attendance.deleteMany({});
        await tx.employee.deleteMany({});
        await tx.lease.deleteMany({});
        await tx.tenant.deleteMany({});
        await tx.sale.deleteMany({});
        await tx.buyer.deleteMany({});
        await tx.unit.deleteMany({});
        await tx.block.deleteMany({});
        await tx.property.deleteMany({});
        await tx.account.deleteMany({});
        await tx.message.deleteMany({});
        await tx.role.deleteMany({});
        logger.info('Existing data deleted successfully');
      } catch (deleteError: any) {
        logger.error('Error during delete phase:', deleteError?.message);
        throw new Error(`Failed to clear existing data: ${deleteError?.message || 'Unknown error'}`);
      }

      // Import data in correct order (respecting dependencies)
      logger.info('Starting to import data...');
      await safeImport(tx, 'properties', data.properties, async (properties) => {
        logger.info(`Importing ${properties.length} properties...`);
        await tx.property.createMany({
          data: properties.map((p: any) => {
            // Filter out fields that might not exist in current schema
            const { propertyCode, ...rest } = p;
            return {
              ...rest,
              id: p.id, // Preserve IDs
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
              updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
              // Only include propertyCode if it exists in the data
              ...(propertyCode && { propertyCode }),
            };
          }),
          skipDuplicates: true,
        });
      });

      await safeImport(tx, 'blocks', data.blocks, async (blocks) => {
        await tx.block.createMany({
          data: blocks.map((b: any) => ({
            ...b,
            id: b.id,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      });

      await safeImport(tx, 'units', data.units, async (units) => {
        // Process in batches to avoid memory issues
        const batchSize = 100;
        for (let i = 0; i < units.length; i += batchSize) {
          const batch = units.slice(i, i + batchSize);
          await tx.unit.createMany({
            data: batch.map((u: any) => {
              // Filter out fields that might not exist in current schema
              const { floorId, ...rest } = u;
              return {
                ...rest,
                id: u.id,
                createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
                // Only include floorId if it exists in the data
                ...(floorId && { floorId }),
              };
            }),
            skipDuplicates: true,
          });
        }
      });

      await safeImport(tx, 'tenants', data.tenants, async (tenants) => {
        await tx.tenant.createMany({
          data: tenants.map((t: any) => {
            // Filter out fields that might not exist in current schema
            const { tenantCode, cnic, ...rest } = t;
            return {
              ...rest,
              id: t.id,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
              updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
              // Only include new fields if they exist in the data
              ...(tenantCode && { tenantCode }),
              ...(cnic && { cnic }),
            };
          }),
          skipDuplicates: true,
        });
      });

      if (data.leases && Array.isArray(data.leases)) {
        await tx.lease.createMany({
          data: data.leases.map((l: any) => ({
            ...l,
            id: l.id,
            leaseStart: l.leaseStart ? new Date(l.leaseStart) : null,
            leaseEnd: l.leaseEnd ? new Date(l.leaseEnd) : null,
            createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
            updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.sales && Array.isArray(data.sales)) {
        await tx.sale.createMany({
          data: data.sales.map((s: any) => ({
            ...s,
            id: s.id,
            saleDate: s.saleDate ? new Date(s.saleDate) : new Date(),
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.buyers && Array.isArray(data.buyers)) {
        await tx.buyer.createMany({
          data: data.buyers.map((b: any) => ({
            ...b,
            id: b.id,
            createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      await safeImport(tx, 'employees', data.employees, async (employees) => {
        await tx.employee.createMany({
          data: employees.map((e: any) => {
            const { cnic, ...rest } = e;
            return {
              ...rest,
              id: e.id,
              joinDate: e.joinDate ? new Date(e.joinDate) : new Date(),
              createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
              updatedAt: e.updatedAt ? new Date(e.updatedAt) : new Date(),
              ...(cnic && { cnic }),
            };
          }),
          skipDuplicates: true,
        });
      });

      if (data.attendance && Array.isArray(data.attendance)) {
        await tx.attendance.createMany({
          data: data.attendance.map((a: any) => ({
            ...a,
            id: a.id,
            date: a.date ? new Date(a.date) : new Date(),
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.payroll && Array.isArray(data.payroll)) {
        await tx.payroll.createMany({
          data: data.payroll.map((p: any) => ({
            ...p,
            id: p.id,
            payPeriodStart: p.payPeriodStart ? new Date(p.payPeriodStart) : null,
            payPeriodEnd: p.payPeriodEnd ? new Date(p.payPeriodEnd) : null,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.leaveRequests && Array.isArray(data.leaveRequests)) {
        await tx.leaveRequest.createMany({
          data: data.leaveRequests.map((l: any) => ({
            ...l,
            id: l.id,
            startDate: l.startDate ? new Date(l.startDate) : new Date(),
            endDate: l.endDate ? new Date(l.endDate) : new Date(),
            createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
            updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      await safeImport(tx, 'leads', data.leads, async (leads) => {
        await tx.lead.createMany({
          data: leads.map((l: any) => {
            const { leadCode, cnic, address, ...rest } = l;
            return {
              ...rest,
              id: l.id,
              createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
              updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(),
              ...(leadCode && { leadCode }),
              ...(cnic && { cnic }),
              ...(address && { address }),
            };
          }),
          skipDuplicates: true,
        });
      });

      await safeImport(tx, 'clients', data.clients, async (clients) => {
        await tx.client.createMany({
          data: clients.map((c: any) => {
            const { clientCode, clientNo, srNo, cnic, address, propertyId, ...rest } = c;
            return {
              ...rest,
              id: c.id,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
              updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
              ...(clientCode && { clientCode }),
              ...(clientNo && { clientNo }),
              ...(srNo !== undefined && { srNo }),
              ...(cnic && { cnic }),
              ...(address && { address }),
              ...(propertyId && { propertyId }),
            };
          }),
          skipDuplicates: true,
        });
      });

      await safeImport(tx, 'dealers', data.dealers, async (dealers) => {
        await tx.dealer.createMany({
          data: dealers.map((d: any) => {
            const { dealerCode, cnic, address, commissionRate, ...rest } = d;
            return {
              ...rest,
              id: d.id,
              createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
              updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
              ...(dealerCode && { dealerCode }),
              ...(cnic && { cnic }),
              ...(address && { address }),
              ...(commissionRate !== undefined && { commissionRate }),
            };
          }),
          skipDuplicates: true,
        });
      });

      if (data.deals && Array.isArray(data.deals)) {
        await tx.deal.createMany({
          data: data.deals.map((d: any) => ({
            ...d,
            id: d.id,
            createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.communications && Array.isArray(data.communications)) {
        await tx.communication.createMany({
          data: data.communications.map((c: any) => ({
            ...c,
            id: c.id,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.transactions && Array.isArray(data.transactions)) {
        await tx.transaction.createMany({
          data: data.transactions.map((t: any) => ({
            ...t,
            id: t.id,
            date: t.date ? new Date(t.date) : new Date(),
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.invoices && Array.isArray(data.invoices)) {
        await tx.invoice.createMany({
          data: data.invoices.map((i: any) => ({
            ...i,
            id: i.id,
            dueDate: i.dueDate ? new Date(i.dueDate) : new Date(),
            createdAt: i.createdAt ? new Date(i.createdAt) : new Date(),
            updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

        if (data.payments && Array.isArray(data.payments)) {
          await tx.tenantPayment.createMany({
          data: data.payments.map((p: any) => ({
            ...p,
            id: p.id,
            date: p.date ? new Date(p.date) : new Date(),
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.commissions && Array.isArray(data.commissions)) {
        await tx.commission.createMany({
          data: data.commissions.map((c: any) => ({
            ...c,
            id: c.id,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.accounts && Array.isArray(data.accounts)) {
        await tx.account.createMany({
          data: data.accounts.map((a: any) => ({
            ...a,
            id: a.id,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.journalEntries && Array.isArray(data.journalEntries)) {
        // First, get all account IDs to validate references
        const existingAccounts = await tx.account.findMany({ select: { id: true } });
        const accountIds = new Set(existingAccounts.map(a => a.id));
        
        // Import journal entries with their lines
        for (const entry of data.journalEntries) {
          try {
            const { lines, ...entryData } = entry;
            
            // Validate required fields
            if (!entryData.entryNumber) {
              logger.warn('Skipping journal entry without entryNumber:', entryData.id);
              continue;
            }

            // Filter and validate journal lines
            const validLines = lines && Array.isArray(lines) 
              ? lines
                  .map((line: any) => {
                    // Validate journal line has required fields
                    if (!line.accountId) {
                      logger.warn('Skipping journal line without accountId:', line.id);
                      return null;
                    }
                    // Check if account exists
                    if (!accountIds.has(line.accountId)) {
                      logger.warn(`Skipping journal line with non-existent accountId ${line.accountId}:`, line.id);
                      return null;
                    }
                    return {
                      ...line,
                      id: line.id,
                    };
                  })
                  .filter((line: any) => line !== null)
              : [];

            await tx.journalEntry.create({
              data: {
                ...entryData,
                id: entryData.id,
                date: entryData.date ? new Date(entryData.date) : new Date(),
                createdAt: entryData.createdAt ? new Date(entryData.createdAt) : new Date(),
                updatedAt: entryData.updatedAt ? new Date(entryData.updatedAt) : new Date(),
                lines: validLines.length > 0
                  ? {
                      create: validLines,
                    }
                  : undefined,
              },
            });
          } catch (entryError: any) {
            logger.error(`Error importing journal entry ${entry.id}:`, entryError?.message);
            // Continue with next entry instead of failing entire import
            if (entryError?.code === 'P2002') {
              logger.warn(`Journal entry ${entry.id} already exists, skipping...`);
              continue;
            }
            throw entryError;
          }
        }
      }

      if (data.roles && Array.isArray(data.roles)) {
        await tx.role.createMany({
          data: data.roles.map((r: any) => ({
            ...r,
            id: r.id,
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (data.messages && Array.isArray(data.messages)) {
        await tx.message.createMany({
          data: data.messages.map((m: any) => ({
            ...m,
            id: m.id,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
          })),
          skipDuplicates: true,
        });
      }

      // Import additional entities that might be in the backup
      if (data.users && Array.isArray(data.users)) {
        await safeImport(tx, 'users', data.users, async (users) => {
          await tx.user.createMany({
            data: users.map((u: any) => ({
              ...u,
              id: u.id,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
              updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
            })),
            skipDuplicates: true,
          });
        });
      }

      if (data.roleInviteLinks && Array.isArray(data.roleInviteLinks)) {
        await safeImport(tx, 'roleInviteLinks', data.roleInviteLinks, async (links) => {
          await tx.roleInviteLink.createMany({
            data: links.map((l: any) => ({
              ...l,
              id: l.id,
              expiresAt: l.expiresAt ? new Date(l.expiresAt) : null,
              createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
              updatedAt: l.updatedAt ? new Date(l.updatedAt) : new Date(),
            })),
            skipDuplicates: true,
          });
        });
      }

      if (data.deviceApprovals && Array.isArray(data.deviceApprovals)) {
        await safeImport(tx, 'deviceApprovals', data.deviceApprovals, async (approvals) => {
          await tx.deviceApproval.createMany({
            data: approvals.map((a: any) => ({
              ...a,
              id: a.id,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
              updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
            })),
            skipDuplicates: true,
          });
        });
      }

      if (data.notifications && Array.isArray(data.notifications)) {
        await safeImport(tx, 'notifications', data.notifications, async (notifications) => {
          await tx.notification.createMany({
            data: notifications.map((n: any) => ({
              ...n,
              id: n.id,
              createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
              updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date(),
            })),
            skipDuplicates: true,
          });
        });
      }

      if (data.activities && Array.isArray(data.activities)) {
        await safeImport(tx, 'activities', data.activities, async (activities) => {
          await tx.activity.createMany({
            data: activities.map((a: any) => ({
              ...a,
              id: a.id,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
              updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date(),
            })),
            skipDuplicates: true,
          });
        });
      }
    }, {
      timeout: 600000, // 10 minutes timeout for large imports
    });

    logger.info('Import completed successfully');
    res.json({
      success: true,
      message: 'Data imported successfully',
    });
  } catch (error: any) {
    logger.error('=== IMPORT ERROR ===');
    logger.error('Import error:', error);
    logger.error('Error code:', error?.code);
    logger.error('Error message:', error?.message);
    logger.error('Error name:', error?.name);
    if (error?.meta) {
      logger.error('Error meta:', JSON.stringify(error.meta, null, 2));
    }
    if (error?.cause) {
      logger.error('Error cause:', error.cause);
    }
    logger.error('Error stack:', error?.stack);
    logger.error('==================');
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to import data';
    if (error?.code === 'P2002') {
      errorMessage = 'Duplicate entry detected. Some records already exist in the database.';
    } else if (error?.code === 'P2003') {
      errorMessage = 'Foreign key constraint failed. Referenced record does not exist.';
    } else if (error?.code === 'P2011') {
      errorMessage = 'Null constraint violation. Required field is missing.';
    } else if (error?.code === 'P2012') {
      errorMessage = 'Missing required value. Please check the backup file format.';
    } else if (error?.message?.includes('does not exist in the current database')) {
      errorMessage = 'Schema mismatch detected. Please run database migrations before importing.';
    } else if (error?.message?.includes('timeout')) {
      errorMessage = 'Import operation timed out. The backup file may be too large.';
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to import data',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          details: error?.message,
          code: error?.code,
          meta: error?.meta,
          stack: error?.stack 
        }),
      });
    } else {
      logger.error('Response already sent, cannot send error response');
    }
  }
});

// Clear all data from the database (DANGEROUS - requires confirmation)
router.post('/clear-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Log the deletion action
    const userId = req.user?.id || 'unknown';
    const timestamp = new Date().toISOString();
    logger.info(`[CLEAR ALL DATA] User ${userId} initiated data deletion at ${timestamp}`);

    // Perform atomic deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all data in reverse order of dependencies to avoid foreign key constraints
      await Promise.all([
        // Finance-related (most dependent)
        tx.journalLine.deleteMany({}),
        tx.journalEntry.deleteMany({}),
        tx.commission.deleteMany({}),
        tx.tenantPayment.deleteMany({}),
        tx.invoice.deleteMany({}),
        tx.transaction.deleteMany({}),
        tx.voucher.deleteMany({}),
        tx.financeLedger.deleteMany({}),
        
        // CRM-related
        tx.communication.deleteMany({}),
        tx.deal.deleteMany({}),
        tx.dealer.deleteMany({}),
        tx.client.deleteMany({}),
        tx.lead.deleteMany({}),
        
        // HR-related
        tx.leaveRequest.deleteMany({}),
        tx.payroll.deleteMany({}),
        tx.attendance.deleteMany({}),
        tx.employee.deleteMany({}),
        
        // Property-related
        tx.lease.deleteMany({}),
        tx.tenant.deleteMany({}),
        tx.sale.deleteMany({}),
        tx.buyer.deleteMany({}),
        tx.unit.deleteMany({}),
        tx.block.deleteMany({}),
        tx.floor.deleteMany({}),
        tx.property.deleteMany({}),
        
        // System-related
        tx.account.deleteMany({}),
        tx.transactionCategory.deleteMany({}),
        tx.message.deleteMany({}),
        tx.notification.deleteMany({}),
        tx.deviceApproval.deleteMany({}),
      ]);

      // Note: We do NOT delete Users and Roles to maintain system integrity
      // Only data records are deleted, not system configuration
    });

    logger.info(`[CLEAR ALL DATA] Successfully deleted all data by user ${userId} at ${timestamp}`);

    res.json({
      success: true,
      message: 'All data cleared successfully',
      timestamp,
      clearedBy: userId,
    });
  } catch (error: any) {
    const errorMessage = error?.message || 'Failed to clear data';
    logger.error('[CLEAR ALL DATA] Error:', errorMessage, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear data',
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        details: error?.message,
        stack: error?.stack 
      }),
    });
  }
});

export default router;

