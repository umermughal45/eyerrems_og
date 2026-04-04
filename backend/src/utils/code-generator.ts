/**
 * Auto-code generation utilities for all entities
 */

import prisma from '../prisma/client';

/**
 * Generate unique property code
 */
export async function generatePropertyCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    code = `PROP-${yyyy}${mm}${dd}-${rand}`;
    try {
      const existing = await prisma.property.findUnique({ 
        where: { propertyCode: code },
        select: { id: true, propertyCode: true },
      });
      exists = !!existing;
    } catch (err: any) {
      // If propertyCode column doesn't exist, break the loop and return the code
      if (err?.code === 'P2022' || err?.message?.includes('column') || err?.message?.includes('does not exist')) {
        exists = false;
      } else {
        throw err;
      }
    }
  }
  return code;
}

/**
 * Generate unique tenant code
 */
export async function generateTenantCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `TENANT-${dateStr}-${random}`;
    const existing = await prisma.tenant.findUnique({ where: { tenantCode: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique lease number
 */
export async function generateLeaseNumber(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `LEASE-${yyyy}${mm}-${random}`;
    const existing = await prisma.lease.findUnique({ where: { leaseNumber: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique invoice number
 */
export async function generateInvoiceNumber(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(10000 + Math.random() * 90000);
    code = `INV-${yyyy}${mm}-${random}`;
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique payment ID
 */
export async function generatePaymentId(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `PAY-${timestamp}-${random}`;
    const existing = await prisma.payment.findUnique({ where: { paymentId: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique employee ID
 */
export async function generateEmployeeId(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    code = `EMP-${yyyy}-${random}`;
    const existing = await prisma.employee.findUnique({ where: { employeeId: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique lead code
 */
export async function generateLeadCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `LEAD-${yyyy}${mm}-${random}`;
    const existing = await prisma.lead.findUnique({ where: { leadCode: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique deal code
 */
export async function generateDealCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `DEAL-${yyyy}${mm}-${random}`;
    const existing = await prisma.deal.findUnique({ where: { dealCode: code } });
    exists = !!existing;
  }
  return code;
}

/**
 * Generate unique transaction code
 */
export async function generateTransactionCode(): Promise<string> {
  let code: string = '';
  let exists = true;
  while (exists) {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `TXN-${timestamp}-${random}`;
    const existing = await prisma.transaction.findUnique({ where: { transactionCode: code } });
    exists = !!existing;
  }
  return code;
}

