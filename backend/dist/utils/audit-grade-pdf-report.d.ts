/**
 * Audit-grade PDF Report Generator
 * ERP-standard list reports and voucher reports
 * - Fixed column widths, no auto-flow
 * - Repeating headers, page breaks
 * - Print-safe typography
 */
import { Response } from 'express';
export interface ReportColumnDef {
    key: string;
    header: string;
    width: number;
    type?: 'string' | 'number' | 'date' | 'currency' | 'boolean';
    format?: (v: any, row?: any) => string;
}
export interface ListReportOptions {
    companyName?: string;
    reportTitle?: string;
    generatedAt?: Date;
    rowsPerPage?: number;
}
/**
 * Generate list report PDF and stream to response
 */
export declare function generateListReportPDF(data: any[], columns: ReportColumnDef[], options: ListReportOptions, res: Response): void;
/**
 * Generate list report PDF and return as Buffer
 */
export declare function generateListReportPDFBuffer(data: any[], columns: ReportColumnDef[], options: ListReportOptions): Promise<Buffer>;
/** Voucher report types */
export interface VoucherReportData {
    companyName?: string;
    voucher: {
        voucherNumber: string;
        type: string;
        date: Date | string;
        paymentMethod?: string | null;
        referenceNumber?: string | null;
        amount: number;
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
        preparedBy?: {
            username?: string | null;
            email?: string | null;
        } | null;
        checkedBy?: {
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
        account?: {
            code?: string | null;
            name?: string | null;
        } | null;
        accountId?: string;
        debit: number;
        credit: number;
        description?: string | null;
    }>;
}
/**
 * Generate audit-grade voucher PDF (single page, fixed column widths)
 */
export declare function generateVoucherReportPDF(data: VoucherReportData): Promise<Buffer>;
//# sourceMappingURL=audit-grade-pdf-report.d.ts.map