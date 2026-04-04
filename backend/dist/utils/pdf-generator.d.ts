/**
 * PDF Generator Utility
 * Generates PDF reports for various entities
 */
import { Response } from 'express';
export interface PaymentPlanPDFData {
    deal: {
        dealCode?: string;
        title: string;
        dealAmount: number;
        client?: {
            name?: string;
            email?: string;
            phone?: string;
        };
        dealer?: {
            name?: string;
        };
        property?: {
            name?: string;
            propertyCode?: string;
        };
    };
    summary: {
        totalAmount: number;
        paidAmount: number;
        remainingAmount: number;
        progress: number;
        status: string;
        downPayment?: number;
        downPaymentPaid?: number;
    };
    installments: Array<{
        installmentNumber: number;
        amount: number;
        dueDate: string | Date;
        paidAmount?: number;
        status?: string;
        paymentMode?: string;
        notes?: string;
    }>;
    generatedAt?: Date;
}
/**
 * Generate Payment Plan PDF - Clean professional report (matches property report style)
 */
export declare function generatePaymentPlanPDF(data: PaymentPlanPDFData, res: Response): void;
export interface ReceiptPDFData {
    receipt: {
        receiptNo: string;
        amount: number;
        method: string;
        date: Date | string;
        notes?: string;
    };
    deal: {
        dealCode?: string;
        title: string;
        dealAmount: number;
    };
    client: {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    allocations: Array<{
        installmentNumber: number;
        amountAllocated: number;
        installmentAmount: number;
        dueDate: Date | string;
    }>;
    receivedBy?: {
        username?: string;
        email?: string;
    };
    companyName?: string;
    companyLogo?: string;
}
/**
 * Generate Receipt PDF
 * Returns PDF buffer instead of piping to response
 */
export declare function generateReceiptPDF(data: ReceiptPDFData): Promise<Buffer>;
export interface PropertyReportData {
    property: {
        name?: string;
        propertyCode?: string | null;
        manualUniqueId?: string | null;
        type?: string | null;
        status?: string | null;
        address?: string | null;
        location?: string | null;
        dealerName?: string | null;
        salePrice?: number | null;
        totalUnits?: number;
        occupied?: number;
        totalArea?: number | null;
        yearBuilt?: number | null;
        ownerName?: string | null;
        ownerPhone?: string | null;
    };
    financeSummary: {
        totalReceived: number;
        totalExpenses: number;
        pendingAmount: number;
        entryCount: number;
    };
    financeRecords: Array<{
        id: string;
        amount: number;
        category?: string | null;
        referenceType?: string | null;
        description?: string | null;
        date?: Date | string | null;
    }>;
    deals: Array<{
        id: string;
        title?: string | null;
        amount: number;
        received: number;
        pending: number;
        status?: string | null;
        stage?: string | null;
        dealerName?: string | null;
        clientName?: string | null;
        createdAt?: Date | string | null;
    }>;
    sales: Array<{
        id: string;
        saleValue?: number | null;
        saleDate?: Date | string | null;
        buyerName?: string | null;
        dealerName?: string | null;
        status?: string | null;
        profit?: number | null;
    }>;
    paymentPlans?: Array<{
        dealId: string;
        dealTitle?: string | null;
        clientName?: string | null;
        installments: Array<{
            installmentNumber: number;
            amount: number;
            dueDate: Date | string;
            paidAmount: number;
            status: string;
            paidDate?: Date | string | null;
            remainingBalance: number;
        }>;
    }>;
}
/**
 * Generate Property PDF Report
 * Keeps styling lightweight to match app's clean theme
 */
export declare function generatePropertyReportPDF(data: PropertyReportData, res: Response): void;
export interface PropertiesReportData {
    properties: Array<{
        id: string;
        name?: string | null;
        propertyCode?: string | null;
        type?: string | null;
        address?: string | null;
        salePrice?: number | null;
        subsidiaryOption?: {
            id: string;
            name: string;
            propertySubsidiary?: {
                id: string;
                name: string;
                logoPath?: string | null;
            } | null;
        } | null;
    }>;
    generatedAt?: Date;
}
/**
 * Generate Properties PDF Report - audit-grade grid list
 */
export declare function generatePropertiesReportPDF(data: PropertiesReportData, res: Response): Promise<void>;
export interface VoucherPDFData {
    voucher: {
        voucherNumber: string;
        type: string;
        date: Date | string;
        paymentMethod?: string | null;
        referenceNumber?: string | null;
        amount: number;
        description?: string | null;
        status: string;
        account?: {
            code?: string | null;
            name?: string | null;
        } | null;
        property?: {
            name?: string | null;
            code?: string | null;
        } | null;
        unit?: {
            unitName?: string | null;
            unitNumber?: string | null;
        } | null;
        payeeType?: string | null;
        payeeId?: string | null;
        deal?: {
            dealCode?: string | null;
            title?: string | null;
            dealAmount?: number | null;
            client?: {
                name?: string | null;
                email?: string | null;
                phone?: string | null;
            } | null;
        } | null;
        preparedBy?: {
            username?: string | null;
            email?: string | null;
        } | null;
        approvedBy?: {
            username?: string | null;
            email?: string | null;
        } | null;
        postedAt?: Date | string | null;
        createdAt?: Date | string | null;
    };
    lines: Array<{
        id: string;
        accountId: string;
        account?: {
            code?: string | null;
            name?: string | null;
        } | null;
        debit: number;
        credit: number;
        description?: string | null;
        property?: {
            name?: string | null;
        } | null;
        unit?: {
            unitName?: string | null;
        } | null;
    }>;
    companyName?: string;
}
/**
 * Generate Professional Voucher PDF Report
 * Shows complete voucher details including all lines, accounts, and totals
 */
export declare function generateVoucherPDF(data: VoucherPDFData): Promise<Buffer>;
//# sourceMappingURL=pdf-generator.d.ts.map