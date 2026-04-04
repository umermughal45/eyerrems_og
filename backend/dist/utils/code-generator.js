"use strict";
/**
 * Auto-code generation utilities for all entities
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePropertyCode = generatePropertyCode;
exports.generateTenantCode = generateTenantCode;
exports.generateLeaseNumber = generateLeaseNumber;
exports.generateInvoiceNumber = generateInvoiceNumber;
exports.generatePaymentId = generatePaymentId;
exports.generateEmployeeId = generateEmployeeId;
exports.generateLeadCode = generateLeadCode;
exports.generateDealCode = generateDealCode;
exports.generateTransactionCode = generateTransactionCode;
const client_1 = __importDefault(require("../prisma/client"));
/**
 * Generate unique property code
 */
async function generatePropertyCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        code = `PROP-${yyyy}${mm}${dd}-${rand}`;
        try {
            const existing = await client_1.default.property.findUnique({
                where: { propertyCode: code },
                select: { id: true, propertyCode: true },
            });
            exists = !!existing;
        }
        catch (err) {
            // If propertyCode column doesn't exist, break the loop and return the code
            if (err?.code === 'P2022' || err?.message?.includes('column') || err?.message?.includes('does not exist')) {
                exists = false;
            }
            else {
                throw err;
            }
        }
    }
    return code;
}
/**
 * Generate unique tenant code
 */
async function generateTenantCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `TENANT-${dateStr}-${random}`;
        const existing = await client_1.default.tenant.findUnique({ where: { tenantCode: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique lease number
 */
async function generateLeaseNumber() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `LEASE-${yyyy}${mm}-${random}`;
        const existing = await client_1.default.lease.findUnique({ where: { leaseNumber: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique invoice number
 */
async function generateInvoiceNumber() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(10000 + Math.random() * 90000);
        code = `INV-${yyyy}${mm}-${random}`;
        const existing = await client_1.default.invoice.findUnique({ where: { invoiceNumber: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique payment ID
 */
async function generatePaymentId() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const timestamp = now.getTime();
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `PAY-${timestamp}-${random}`;
        const existing = await client_1.default.payment.findUnique({ where: { paymentId: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique employee ID
 */
async function generateEmployeeId() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const random = Math.floor(10000 + Math.random() * 90000);
        code = `EMP-${yyyy}-${random}`;
        const existing = await client_1.default.employee.findUnique({ where: { employeeId: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique lead code
 */
async function generateLeadCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `LEAD-${yyyy}${mm}-${random}`;
        const existing = await client_1.default.lead.findUnique({ where: { leadCode: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique deal code
 */
async function generateDealCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `DEAL-${yyyy}${mm}-${random}`;
        const existing = await client_1.default.deal.findUnique({ where: { dealCode: code } });
        exists = !!existing;
    }
    return code;
}
/**
 * Generate unique transaction code
 */
async function generateTransactionCode() {
    let code = '';
    let exists = true;
    while (exists) {
        const now = new Date();
        const timestamp = now.getTime();
        const random = Math.floor(1000 + Math.random() * 9000);
        code = `TXN-${timestamp}-${random}`;
        const existing = await client_1.default.transaction.findUnique({ where: { transactionCode: code } });
        exists = !!existing;
    }
    return code;
}
//# sourceMappingURL=code-generator.js.map