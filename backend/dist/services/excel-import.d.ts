export interface ImportResult {
    inserted: number;
    updated: number;
    deleted: number;
    failed: number;
    errors: Array<{
        row: number;
        sheet: string;
        error: string;
    }>;
    details: Record<string, {
        inserted: number;
        updated: number;
        deleted: number;
        failed: number;
    }>;
}
export declare function importExcelFile(buffer: Buffer): Promise<ImportResult>;
//# sourceMappingURL=excel-import.d.ts.map