/**
 * Filter Payload Types
 * Shared between frontend and backend
 */

export interface FilterPayload {
  // Identity Filters
  systemId?: string;
  tid?: string;
  codes?: string[];
  referenceNumbers?: string[];
  
  // Status & Lifecycle Filters (multi-select)
  status?: string[];
  priority?: string[];
  stage?: string[];
  lifecycle?: string[];
  
  // Date Filters (CRITICAL - explicit field selection)
  dateField?: string;
  datePreset?: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  
  // Ownership & Responsibility
  createdBy?: string;
  assignedTo?: string;
  assignedDealerId?: string;
  assignedAgentId?: string;
  department?: string;
  approvedBy?: string;
  
  // Numeric / Financial Filters
  amount?: {
    min?: number;
    max?: number;
  };
  balance?: {
    min?: number;
    max?: number;
  };
  tax?: {
    min?: number;
    max?: number;
  };
  debit?: {
    min?: number;
    max?: number;
  };
  credit?: {
    min?: number;
    max?: number;
  };
  
  // Relational Filters
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  dealId?: string;
  clientId?: string;
  employeeId?: string;
  accountId?: string;
  voucherId?: string;
  
  // Search (applied last)
  search?: string;
  
  // Additional module-specific filters
  [key: string]: any;
}
