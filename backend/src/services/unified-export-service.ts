/**
 * Unified Export Service
 * Handles exports across all modules with consistent scoping (VIEW/FILTERED/ALL)
 * Supports PDF, Excel, CSV formats
 * Uses unified filter engine for ERP-grade filtering
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { applyFilters, validateFilterPayload, ModuleFilterConfig, FilterPayload, PermissionContext, SystemConstraints } from './unified-filter-engine';
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
  columns?: string[]; // Selected column keys (if provided, filter config.columns)
  dataShape?: 'raw' | 'structured'; // Data shape for export
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
  buildWhereClause: (filters?: ExportFilters, search?: string) => any; // Legacy - kept for backward compatibility
  buildOrderBy: (sort?: { field: string; direction: 'asc' | 'desc' }) => any;
  include?: any;
  // New: Filter configuration for unified filter engine
  filterConfig?: ModuleFilterConfig;
}

/**
 * Module configurations
 * Each module defines its columns and query logic
 */
export const MODULE_CONFIGS: Record<string, ModuleExportConfig> = {
  leads: {
    module: 'leads',
    model: 'Lead',
    columns: [
      { key: 'leadCode', header: 'Lead Code', width: 20 },
      { key: 'name', header: 'Name', width: 30 },
      { key: 'email', header: 'Email', width: 30 },
      { key: 'phone', header: 'Phone', width: 20 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'priority', header: 'Priority', width: 15 },
      { key: 'source', header: 'Source', width: 20 },
      { key: 'temperature', header: 'Temperature', width: 15 },
      { key: 'assignedAgent', header: 'Assigned Agent', width: 25, format: (v) => v?.username || '' },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.status) where.status = filters.status;
      if (filters?.priority) where.priority = filters.priority;
      if (filters?.assignedTo) where.assignedToUserId = filters.assignedTo;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { leadCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    include: {
      assignedAgent: {
        select: { id: true, username: true },
      },
    },
    filterConfig: {
      model: 'Lead',
      identityFields: ['leadCode', 'name', 'email', 'phone', 'tid', 'manualUniqueId'],
      statusField: 'status',
      dateFields: ['createdAt', 'updatedAt', 'followUpDate', 'expectedCloseDate'],
      numericFields: ['score', 'budgetMin', 'budgetMax'],
      relationalFields: {
        assignedTo: 'assignedToUserId',
        assignedDealerId: 'assignedDealerId',
        clientId: 'convertedFromLeadId',
      },
    },
  },
  clients: {
    module: 'clients',
    model: 'Client',
    columns: [
      { key: 'clientCode', header: 'Client Code', width: 20 },
      { key: 'name', header: 'Name', width: 30 },
      { key: 'email', header: 'Email', width: 30 },
      { key: 'phone', header: 'Phone', width: 20 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'clientType', header: 'Type', width: 15 },
      { key: 'city', header: 'City', width: 20 },
      { key: 'assignedDealer', header: 'Assigned Dealer', width: 25, format: (v) => v?.name || '' },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.status) where.status = filters.status;
      if (filters?.clientType) where.clientType = filters.clientType;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { clientCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    include: {
      assignedDealer: {
        select: { id: true, name: true },
      },
    },
    filterConfig: {
      model: 'Client',
      identityFields: ['clientCode', 'name', 'email', 'phone', 'tid', 'manualUniqueId'],
      statusField: 'status',
      dateFields: ['createdAt', 'updatedAt'],
      relationalFields: {
        assignedDealerId: 'assignedDealerId',
        assignedAgentId: 'assignedAgentId',
      },
    },
  },
  dealers: {
    module: 'dealers',
    model: 'Dealer',
    columns: [
      { key: 'dealerCode', header: 'Dealer Code', width: 20 },
      { key: 'name', header: 'Name', width: 30 },
      { key: 'email', header: 'Email', width: 30 },
      { key: 'phone', header: 'Phone', width: 20 },
      { key: 'isActive', header: 'Active', width: 15, type: 'boolean' },
      { key: 'commissionRate', header: 'Commission Rate', width: 18, type: 'number' },
      { key: 'city', header: 'City', width: 20 },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.isActive !== undefined) where.isActive = filters.isActive === true || filters.isActive === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { dealerCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    filterConfig: {
      model: 'Dealer',
      identityFields: ['dealerCode', 'name', 'email', 'phone', 'tid', 'manualUniqueId'],
      dateFields: ['createdAt', 'updatedAt'],
      numericFields: ['commissionRate'],
    },
  },
  deals: {
    module: 'deals',
    model: 'Deal',
    columns: [
      { key: 'dealCode', header: 'Deal Code', width: 20 },
      { key: 'title', header: 'Title', width: 40 },
      { key: 'client', header: 'Client', width: 30, format: (v) => v?.name || '' },
      { key: 'dealAmount', header: 'Amount', width: 18, type: 'number' },
      { key: 'stage', header: 'Stage', width: 20 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'dealType', header: 'Type', width: 15 },
      { key: 'dealDate', header: 'Deal Date', width: 20, type: 'date' },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.status) where.status = filters.status;
      if (filters?.stage) where.stage = filters.stage;
      if (filters?.dealType) where.dealType = filters.dealType;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { dealCode: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    include: {
      client: {
        select: { id: true, name: true },
      },
    },
    filterConfig: {
      model: 'Deal',
      identityFields: ['dealCode', 'title', 'tid'],
      statusField: 'status',
      dateFields: ['createdAt', 'updatedAt', 'dealDate', 'expectedClosingDate', 'actualClosingDate'],
      numericFields: ['dealAmount', 'commissionAmount', 'expectedRevenue', 'probability'],
      relationalFields: {
        clientId: 'clientId',
        dealerId: 'dealerId',
        propertyId: 'propertyId',
      },
    },
  },
  employees: {
    module: 'employees',
    model: 'Employee',
    columns: [
      { key: 'employeeId', header: 'Employee ID', width: 20 },
      { key: 'name', header: 'Name', width: 30 },
      { key: 'email', header: 'Email', width: 30 },
      { key: 'phone', header: 'Phone', width: 20 },
      { key: 'department', header: 'Department', width: 20 },
      { key: 'position', header: 'Position', width: 25 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'joinDate', header: 'Join Date', width: 20, type: 'date' },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.department) where.department = filters.department;
      if (filters?.status) where.status = filters.status;
      if (filters?.employeeType) where.employeeType = filters.employeeType;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    filterConfig: {
      model: 'Employee',
      identityFields: ['employeeId', 'name', 'email', 'phone', 'tid'],
      statusField: 'status',
      dateFields: ['createdAt', 'updatedAt', 'joinDate', 'dateOfBirth'],
      numericFields: ['salary', 'basicSalary'],
      relationalFields: {
        department: 'department',
      },
    },
  },
  vouchers: {
    module: 'vouchers',
    model: 'Voucher',
    columns: [
      { key: 'voucherNumber', header: 'Voucher #', width: 20 },
      { key: 'type', header: 'Type', width: 15 },
      { key: 'date', header: 'Date', width: 20, type: 'date' },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'amount', header: 'Amount', width: 18, type: 'number' },
      { key: 'description', header: 'Description', width: 40 },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.voucherType) where.type = filters.voucherType;
      if (filters?.dateFrom || filters?.dateTo) {
        where.date = {};
        if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
      }
      if (search) {
        where.OR = [
          { voucherNumber: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { date: 'desc' };
    },
    filterConfig: {
      model: 'Voucher',
      identityFields: ['voucherNumber', 'description'],
      statusField: 'status',
      dateFields: ['date', 'createdAt', 'updatedAt', 'approvedAt', 'postedAt'],
      numericFields: ['totalAmount', 'amount'],
      relationalFields: {
        voucherId: 'id',
      },
    },
  },
  properties: {
    module: 'properties',
    model: 'Property',
    columns: [
      { key: 'propertyCode', header: 'Property Code', width: 20 },
      { key: 'name', header: 'Name', width: 30 },
      { key: 'type', header: 'Type', width: 15 },
      { key: 'status', header: 'Status', width: 15 },
      { key: 'city', header: 'City', width: 20 },
      { key: 'address', header: 'Address', width: 40 },
      { key: 'totalUnits', header: 'Units', width: 15, type: 'number' },
      { key: 'createdAt', header: 'Created At', width: 20, type: 'date' },
    ],
    buildWhereClause: (filters, search) => {
      const where: any = { isDeleted: false };
      if (filters?.status) where.status = filters.status;
      if (filters?.type) where.type = filters.type;
      if (filters?.city) where.city = filters.city;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { propertyCode: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ];
      }
      return where;
    },
    buildOrderBy: (sort) => {
      if (sort?.field) {
        return { [sort.field]: sort.direction || 'asc' };
      }
      return { createdAt: 'desc' };
    },
    filterConfig: {
      model: 'Property',
      identityFields: ['propertyCode', 'name', 'address', 'tid'],
      statusField: 'status',
      dateFields: ['createdAt', 'updatedAt'],
      numericFields: ['totalUnits', 'totalArea', 'rentAmount', 'salePrice'],
      relationalFields: {
        propertyId: 'id',
        dealerId: 'dealerId',
      },
    },
  },
};

/**
 * Format value for export
 */
function formatValue(value: any, column: ColumnDefinition): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (column.format) {
    return column.format(value);
  }

  if (column.type === 'date') {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      try {
        return new Date(value).toISOString().split('T')[0];
      } catch {
        return value;
      }
    }
    return String(value);
  }

  if (column.type === 'boolean') {
    return value === true || value === 'true' || value === 1 ? 'Yes' : 'No';
  }

  if (column.type === 'number') {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '' : String(num);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Get data for export based on scope
 * Uses unified filter engine when filterConfig is available
 */
async function getExportData(
  config: ModuleExportConfig,
  request: ExportRequest,
  permissionContext?: PermissionContext
): Promise<any[]> {
  let where: any;
  const orderBy = config.buildOrderBy(request.sort);

  // Use unified filter engine if filterConfig is available
  if (config.filterConfig && permissionContext && request.filters) {
    // Validate filter payload
    const validation = validateFilterPayload(config.filterConfig, request.filters);
    if (!validation.valid) {
      throw new Error(`Invalid filter payload: ${validation.errors.join(', ')}`);
    }

    // Apply filters using unified engine
    const systemConstraints: SystemConstraints = {
      excludeSoftDeleted: true,
      excludeArchived: true,
    };

    const filterResult = await applyFilters(
      config.filterConfig,
      { ...request.filters, search: request.search },
      permissionContext,
      systemConstraints
    );

    where = filterResult.where;
  } else {
    // Fallback to legacy buildWhereClause
    where = config.buildWhereClause(request.filters, request.search);
  }

  let query: any = {
    where,
    orderBy,
  };

  if (config.include) {
    query.include = config.include;
  }

  // Apply scope
  if (request.scope === 'VIEW' && request.pagination) {
    const skip = (request.pagination.page - 1) * request.pagination.pageSize;
    query.skip = skip;
    query.take = request.pagination.pageSize;
  }
  // FILTERED and ALL ignore pagination (FILTERED applies filters, ALL ignores filters too)

  if (request.scope === 'ALL') {
    // Ignore filters and search for ALL scope
    if (config.filterConfig && permissionContext) {
      // Use filter engine with empty filters
      const systemConstraints: SystemConstraints = {
        excludeSoftDeleted: true,
        excludeArchived: true,
      };
      const filterResult = await applyFilters(
        config.filterConfig,
        {},
        permissionContext,
        systemConstraints
      );
      where = filterResult.where;
    } else {
      // Legacy fallback
      where = config.buildWhereClause({}, undefined);
      // Keep soft-delete filter if model has it
      if (where.isDeleted === false) {
        where = { isDeleted: false };
      } else {
        where = {};
      }
    }
    query.where = where;
  }

  const model = (prisma as any)[config.model.toLowerCase()];
  if (!model) {
    throw new Error(`Model ${config.model} not found`);
  }

  const data = await model.findMany(query);
  return data;
}

/**
 * Generate Excel export
 */
async function generateExcel(data: any[], columns: ColumnDefinition[], moduleName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'REMS ERP';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(moduleName);
  
  // Set column headers
  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  for (const row of data) {
    const rowData: any = {};
    for (const col of columns) {
      const value = row[col.key];
      const formatted = formatValue(value, col);
      rowData[col.key] = formatted;
    }
    sheet.addRow(rowData);
  }

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate CSV export
 */
function generateCSV(data: any[], columns: ColumnDefinition[]): Buffer {
  const lines: string[] = [];
  
  // Header row
  const headers = columns.map(col => `"${col.header.replace(/"/g, '""')}"`).join(',');
  lines.push(headers);

  // Data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      const formatted = formatValue(value, col);
      // Escape quotes and wrap in quotes
      return `"${String(formatted).replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  }

  // UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + lines.join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generate PDF export - audit-grade grid layout with repeating headers
 */
async function generatePDF(data: any[], columns: ColumnDefinition[], moduleName: string): Promise<Buffer> {
  const { generateListReportPDFBuffer } = await import('../utils/audit-grade-pdf-report');
  const reportCols = columns.map((c) => ({
    key: c.key,
    header: c.header,
    width: (c.width || 15) * 6,
    type: c.type,
    format: c.format
      ? (v: any) => {
          const out = c.format!(v);
          return out === null || out === undefined || out === '' ? '—' : String(out);
        }
      : undefined,
  }));

  return generateListReportPDFBuffer(data, reportCols, {
    companyName: 'Real Estate Management System',
    reportTitle: `${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Report`,
    generatedAt: new Date(),
  });
}

/**
 * Generate Word export (using Excel format as fallback)
 */
async function generateWord(data: any[], columns: ColumnDefinition[], moduleName: string): Promise<Buffer> {
  // Word format is complex, so we'll generate an Excel file that Word can open
  // For true .docx, we'd need the 'docx' library
  return generateExcel(data, columns, moduleName);
}

/**
 * Main export function
 */
export async function exportData(
  request: ExportRequest,
  userId: string,
  permissionContext?: PermissionContext
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const config = MODULE_CONFIGS[request.module];
  if (!config) {
    throw new Error(`Module ${request.module} not supported for export`);
  }

  logger.info(`Export requested: module=${request.module}, format=${request.format}, scope=${request.scope}, userId=${userId}`);

  // Get data (with permission context if available)
  const data = await getExportData(config, request, permissionContext);
  
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  logger.info(`Export data fetched: ${data.length} records`);

  // Filter columns if specific columns requested
  let columnsToExport = config.columns;
  if (request.columns && request.columns.length > 0) {
    const selectedKeys = new Set(request.columns);
    const validKeys = new Set(config.columns.map((col) => col.key));
    const invalidKeys = request.columns.filter((key) => !validKeys.has(key));
    
    if (invalidKeys.length > 0) {
      logger.warn(`Invalid column keys requested: ${invalidKeys.join(', ')}`);
      // Filter out invalid keys
      const validSelectedKeys = request.columns.filter((key) => validKeys.has(key));
      if (validSelectedKeys.length === 0) {
        throw new Error(`No valid columns selected. Invalid keys: ${invalidKeys.join(', ')}`);
      }
      columnsToExport = config.columns.filter((col) => validSelectedKeys.includes(col.key));
    } else {
      columnsToExport = config.columns.filter((col) => selectedKeys.has(col.key));
    }
    
    // Validate column permissions if permission context provided
    if (permissionContext && permissionContext.permissions) {
      const userRoles = permissionContext.roleName ? [permissionContext.roleName.toLowerCase()] : [];
      const userPermissions = permissionContext.permissions || [];
      const isAdmin = userPermissions.includes('admin.*') || userPermissions.includes('*') || userRoles.includes('admin');
      
      columnsToExport = columnsToExport.filter((col) => {
        // If column has role restrictions, check user roles
        // Note: Backend MODULE_CONFIGS doesn't have role info yet - this is a placeholder
        // In production, you'd load column definitions from registry and check roles
        return true; // For now, allow all columns (frontend already filtered by role)
      });
    }
    
    if (columnsToExport.length === 0) {
      throw new Error('No valid columns selected for export');
    }
    logger.info(`Filtered to ${columnsToExport.length} columns from ${config.columns.length} available`);
  }

  // Generate export based on format
  let buffer: Buffer;
  let mimeType: string;
  let filename: string;
  const timestamp = new Date().toISOString().split('T')[0];

  switch (request.format) {
    case 'excel':
      buffer = await generateExcel(data, columnsToExport, config.module);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${config.module}-${timestamp}.xlsx`;
      break;
    case 'csv':
      buffer = generateCSV(data, columnsToExport);
      mimeType = 'text/csv; charset=utf-8';
      filename = `${config.module}-${timestamp}.csv`;
      break;
    case 'pdf':
      buffer = await generatePDF(data, columnsToExport, config.module);
      mimeType = 'application/pdf';
      filename = `${config.module}-${timestamp}.pdf`;
      break;
    case 'word':
      buffer = await generateWord(data, columnsToExport, config.module);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `${config.module}-${timestamp}.xlsx`; // Excel format as Word-compatible
      break;
    default:
      throw new Error(`Unsupported format: ${request.format}`);
  }

  return { buffer, mimeType, filename };
}

/**
 * Get export count (for validation/warnings)
 * Uses unified filter engine when filterConfig is available
 */
export async function getExportCount(
  config: ModuleExportConfig,
  request: ExportRequest,
  permissionContext?: PermissionContext
): Promise<number> {
  let where: any;

  // Use unified filter engine if filterConfig is available
  if (config.filterConfig && permissionContext && request.filters) {
    const systemConstraints: SystemConstraints = {
      excludeSoftDeleted: true,
      excludeArchived: true,
    };

    const filterResult = await applyFilters(
      config.filterConfig,
      { ...request.filters, search: request.search },
      permissionContext,
      systemConstraints
    );

    where = filterResult.where;
  } else {
    // Fallback to legacy buildWhereClause
    where = config.buildWhereClause(request.filters, request.search);
  }

  const model = (prisma as any)[config.model.toLowerCase()];
  if (request.scope === 'ALL') {
    const baseWhere = where.isDeleted === false ? { isDeleted: false } : {};
    return await model.count({ where: baseWhere });
  }

  // Strip isDeleted from where if model doesn't support it (Voucher, Transaction, etc.)
  const modelsWithoutIsDeleted = new Set(['voucher', 'transaction', 'invoice', 'commission']);
  const modelKey = config.model.toLowerCase();
  const safeWhere = modelsWithoutIsDeleted.has(modelKey) && where.isDeleted === false
    ? (() => { const { isDeleted, ...rest } = where; return rest; })()
    : where;

  return await model.count({ where: safeWhere });
}
