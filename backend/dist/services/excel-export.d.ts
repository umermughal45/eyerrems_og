import ExcelJS from 'exceljs';
export interface SheetConfig {
    name: string;
    model: string;
    columns: Array<{
        key: string;
        header: string;
        width?: number;
        type?: 'string' | 'number' | 'date' | 'boolean';
    }>;
    query: () => Promise<any[]>;
}
export declare function getSheetConfigs(): SheetConfig[];
export declare function generateExcelExport(): Promise<ExcelJS.Buffer>;
//# sourceMappingURL=excel-export.d.ts.map