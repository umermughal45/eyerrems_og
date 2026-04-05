import type { Request } from 'express';
export type LeadImportAssignmentMode = 'CSV_DEFINED' | 'AUTO_ASSIGN' | 'UNASSIGNED';
export interface LeadImportUploadContext {
    userId: string;
    fileName: string;
    filePath: string;
    fileHash: string;
    buffer: Buffer;
    assignmentMode: LeadImportAssignmentMode;
    rowLimit: number;
}
export declare const LEAD_IMPORT_REQUIRED_HEADERS: readonly ["Full Name", "Phone", "Email", "CNIC", "Lead Source", "Source Details", "Dealer TID", "Dealer Email", "Notes"];
type CsvRow = Record<string, string>;
type ValidatorUser = {
    id: string;
    username?: string;
    roleName?: string;
};
export declare function parseLeadImportCsv(buffer: Buffer, rowLimit: number): Promise<{
    header: string[];
    rows: CsvRow[];
}>;
export declare function createLeadImportBatch(ctx: LeadImportUploadContext): Promise<{
    status: string;
    id: string;
    createdAt: Date;
    rowCount: number;
    fileName: string;
    createdByUserId: string;
    filePath: string;
    fileHash: string;
    readyCount: number;
    duplicateCount: number;
    invalidCount: number;
    committedAt: Date | null;
    errorSummary: string | null;
}>;
export declare function validateLeadImportBatch(batchId: string, validatorUser: ValidatorUser): Promise<{
    batchId: string;
    status: "validated";
    rowCount: number;
    readyCount: number;
    duplicateCount: number;
    invalidCount: number;
}>;
export declare function commitLeadImportBatch(batchId: string, approverUser: ValidatorUser, req?: Request): Promise<{
    batchId: string;
    status: "committed";
    rowCount: number;
    committedLeads: number;
}>;
export {};
//# sourceMappingURL=lead-import-service.d.ts.map