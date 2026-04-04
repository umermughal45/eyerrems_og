/**
 * Unified Export Service
 * Handles exports across all modules with consistent scoping (VIEW/FILTERED/ALL)
 * Supports PDF, Excel, CSV formats
 * Uses unified filter engine for ERP-grade filtering
 */
import { ModuleFilterConfig, FilterPayload, PermissionContext } from './unified-filter-engine';
export type { PermissionContext, FilterPayload } from './unified-filter-engine';
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'word';
export type ExportScope = 'VIEW' | 'FILTERED' | 'ALL';
export interface ExportFilters extends FilterPayload {
    [key: string]: any;
}
export interface ExportRequest {
    module: string;
    format: ExportFormat;
    scope: ExportScope;
    columns?: string[];
    dataShape?: 'raw' | 'structured';
    filters?: ExportFilters;
    search?: string;
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    pagination?: {
        page: number;
        pageSize: number;
    };
}
export interface ColumnDefinition {
    key: string;
    header: string;
    width?: number;
    type?: 'string' | 'number' | 'date' | 'boolean';
    format?: (value: any) => string;
}
export interface ModuleExportConfig {
    module: string;
    model: string;
    columns: ColumnDefinition[];
    buildWhereClause: (filters?: ExportFilters, search?: string) => any;
    buildOrderBy: (sort?: {
        field: string;
        direction: 'asc' | 'desc';
    }) => any;
    include?: any;
    filterConfig?: ModuleFilterConfig;
}
/**
 * Module configurations
 * Each module defines its columns and query logic
 */
export declare const MODULE_CONFIGS: Record<string, ModuleExportConfig>;
/**
 * Main export function
 */
export declare function exportData(request: ExportRequest, userId: string, permissionContext?: PermissionContext): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
}>;
/**
 * Get export count (for validation/warnings)
 * Uses unified filter engine when filterConfig is available
 */
export declare function getExportCount(config: ModuleExportConfig, request: ExportRequest, permissionContext?: PermissionContext): Promise<number>;
//# sourceMappingURL=unified-export-service.d.ts.map