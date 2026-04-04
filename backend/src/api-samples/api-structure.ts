/**
 * Complete API Structure Documentation
 * This file documents all API endpoints, their purposes, and auto-sync workflows
 */

export const API_STRUCTURE = {
  /**
   * PROPERTIES MODULE
   * Core foundation for property management
   */
  properties: {
    basePath: '/api/properties',
    endpoints: {
      'GET /': {
        description: 'Get all properties with filters',
        permissions: ['properties.view'],
        queryParams: ['status', 'type', 'city', 'search'],
        autoSync: false,
      },
      'GET /:id': {
        description: 'Get property by ID with full details',
        permissions: ['properties.view'],
        autoSync: false,
      },
      'GET /:id/dashboard': {
        description: 'Get property dashboard analytics',
        permissions: ['properties.view'],
        autoSync: false,
        returns: {
          financials: 'income, expenses, netProfit, occupancyRate',
          occupancy: 'totalUnits, occupiedUnits, vacantUnits',
          maintenance: 'openRequests, totalRequests',
        },
      },
      'POST /': {
        description: 'Create new property',
        permissions: ['properties.create'],
        autoSync: false,
        auditLog: true,
      },
      'PUT /:id': {
        description: 'Update property',
        permissions: ['properties.update'],
        autoSync: false,
        auditLog: true,
      },
      'DELETE /:id': {
        description: 'Delete property (soft delete)',
        permissions: ['properties.delete'],
        autoSync: false,
        auditLog: true,
      },
      'POST /:id/assign-tenant': {
        description: 'Assign tenant to property',
        permissions: ['properties.update'],
        autoSync: [
          'Creates Tenancy record',
          'Updates Property status to Occupied',
          'Updates Unit status to Occupied',
          'If leaseId provided, creates tenancy from lease',
        ],
        auditLog: true,
      },
      'DELETE /:id/remove-tenant/:tenantId': {
        description: 'Remove tenant from property',
        permissions: ['properties.update'],
        autoSync: [
          'Ends Tenancy record',
          'Updates Property status if no active tenancies',
        ],
        auditLog: true,
      },
      'POST /:id/expenses': {
        description: 'Add property expense',
        permissions: ['properties.update'],
        autoSync: [
          'Creates PropertyExpense record',
          'Auto-syncs to FinanceLedger (expense)',
        ],
        auditLog: true,
      },
      'POST /:id/maintenance': {
        description: 'Create maintenance request',
        permissions: ['properties.update'],
        autoSync: [
          'Creates MaintenanceRequest record',
          'Updates Property status if high/urgent priority',
        ],
        auditLog: true,
      },
      'POST /:id/upload': {
        description: 'Upload property documents',
        permissions: ['properties.update'],
        autoSync: ['Creates Attachment record'],
        auditLog: true,
      },
      'GET /:id/attachments': {
        description: 'Get property attachments',
        permissions: ['properties.view'],
        autoSync: false,
      },
    },
  },

  /**
   * FINANCE MODULE
   * Auto-sync with all other modules
   */
  finance: {
    basePath: '/api/finance',
    endpoints: {
      'GET /ledger': {
        description: 'Get finance ledger entries with filters',
        permissions: ['finance.view'],
        queryParams: [
          'category',
          'referenceType',
          'propertyId',
          'tenantId',
          'startDate',
          'endDate',
          'page',
          'limit',
        ],
        autoSync: false,
      },
      'GET /summary': {
        description: 'Get finance summary (income, expenses, net profit)',
        permissions: ['finance.view'],
        queryParams: ['startDate', 'endDate', 'propertyId'],
        autoSync: false,
      },
      'POST /ledger': {
        description: 'Create manual finance ledger entry',
        permissions: ['finance.create'],
        autoSync: false,
        auditLog: true,
      },
      'POST /sync/invoice/:invoiceId': {
        description: 'Sync invoice to finance ledger (auto-sync)',
        permissions: ['finance.sync'],
        autoSync: [
          'Creates FinanceLedger entry (income)',
          'Links to Invoice, Property, Tenant',
        ],
      },
      'POST /sync/payment/:paymentId': {
        description: 'Sync payment to finance ledger (auto-sync)',
        permissions: ['finance.sync'],
        autoSync: [
          'Creates FinanceLedger entry (income - received)',
          'Updates Invoice status and remainingAmount',
          'Updates TenantLedger (credit)',
          'Updates Tenant outstandingBalance',
        ],
      },
      'POST /sync/deal/:dealId': {
        description: 'Sync deal to finance ledger (auto-sync)',
        permissions: ['finance.sync'],
        autoSync: [
          'Creates FinanceLedger entry (income)',
          'Only if deal stage is closed-won',
        ],
      },
      'POST /sync/payroll/:payrollId': {
        description: 'Sync payroll to finance ledger (auto-sync)',
        permissions: ['finance.sync'],
        autoSync: [
          'Creates FinanceLedger entry (expense)',
          'Only if payroll paymentStatus is paid',
          'Links payroll.financeLedgerId',
        ],
      },
      'GET /ledger/reference/:referenceType/:referenceId': {
        description: 'Get finance ledger by reference',
        permissions: ['finance.view'],
        autoSync: false,
      },
    },
  },

  /**
   * CRM MODULE
   * Leads, Clients, Deals, Dealers
   */
  crm: {
    basePath: '/api/crm',
    endpoints: {
      'GET /leads': {
        description: 'Get all leads',
        permissions: ['crm.leads.view'],
        autoSync: false,
      },
      'POST /leads': {
        description: 'Create lead',
        permissions: ['crm.leads.create'],
        autoSync: false,
        auditLog: true,
      },
      'POST /leads/:id/convert': {
        description: 'Convert lead to client',
        permissions: ['crm.leads.update'],
        autoSync: [
          'Creates Client record',
          'Links lead.convertedToClientId',
          'Sets lead status to converted',
        ],
        auditLog: true,
      },
      'GET /clients': {
        description: 'Get all clients',
        permissions: ['crm.clients.view'],
        autoSync: false,
      },
      'POST /clients': {
        description: 'Create client',
        permissions: ['crm.clients.create'],
        autoSync: false,
        auditLog: true,
      },
      'GET /deals': {
        description: 'Get all deals',
        permissions: ['crm.deals.view'],
        autoSync: false,
      },
      'POST /deals': {
        description: 'Create deal',
        permissions: ['crm.deals.create'],
        autoSync: false,
        auditLog: true,
      },
      'PUT /deals/:id/stage': {
        description: 'Update deal stage',
        permissions: ['crm.deals.update'],
        autoSync: [
          'Creates StageHistory record',
          'If stage is closed-won, can sync to FinanceLedger',
        ],
        auditLog: true,
      },
      'POST /communications': {
        description: 'Create communication log',
        permissions: ['crm.communications.create'],
        autoSync: false,
        auditLog: true,
      },
    },
  },

  /**
   * TENANT PORTAL
   * Tenant-facing APIs
   */
  tenantPortal: {
    basePath: '/api/tenant-portal',
    endpoints: {
      'GET /dashboard': {
        description: 'Get tenant dashboard',
        permissions: ['tenant.view'],
        autoSync: false,
      },
      'GET /invoices': {
        description: 'Get tenant invoices',
        permissions: ['tenant.view'],
        autoSync: false,
      },
      'GET /payments': {
        description: 'Get payment history',
        permissions: ['tenant.view'],
        autoSync: false,
      },
      'GET /ledger': {
        description: 'Get tenant ledger',
        permissions: ['tenant.view'],
        autoSync: false,
      },
      'POST /complaints': {
        description: 'Create maintenance complaint',
        permissions: ['tenant.create'],
        autoSync: [
          'Creates MaintenanceRequest',
          'Updates Property status if urgent',
        ],
        auditLog: true,
      },
      'POST /upload-cnic': {
        description: 'Upload CNIC document',
        permissions: ['tenant.update'],
        autoSync: ['Updates Tenant.cnicDocumentUrl', 'Creates Attachment'],
        auditLog: true,
      },
      'POST /pay-rent': {
        description: 'Pay rent (mock payment)',
        permissions: ['tenant.create'],
        autoSync: [
          'Creates Payment record',
          'Auto-syncs to FinanceLedger',
          'Updates Invoice status',
          'Updates TenantLedger',
        ],
        auditLog: true,
      },
    },
  },

  /**
   * HR + PAYROLL
   * Auto-sync with Finance
   */
  hr: {
    basePath: '/api/hr',
    endpoints: {
      'POST /payroll': {
        description: 'Process payroll',
        permissions: ['hr.payroll.create'],
        autoSync: false,
        auditLog: true,
      },
      'PUT /payroll/:id/process': {
        description: 'Mark payroll as paid',
        permissions: ['hr.payroll.update'],
        autoSync: [
          'Updates Payroll paymentStatus to paid',
          'Can trigger auto-sync to FinanceLedger',
        ],
        auditLog: true,
      },
    },
  },

  /**
   * DASHBOARD ANALYTICS
   * Interactive analytics
   */
  dashboard: {
    basePath: '/api/dashboard',
    endpoints: {
      'GET /overall': {
        description: 'Get overall dashboard analytics',
        permissions: ['dashboard.view'],
        autoSync: false,
        returns: {
          properties: 'total, occupied, vacant, occupancyRate',
          financials: 'totalIncome, totalExpenses, netProfit',
          crm: 'activeDeals, pendingInvoices',
          maintenance: 'openRequests',
        },
      },
      'GET /revenue-trends': {
        description: 'Get revenue trends (monthly)',
        permissions: ['dashboard.view'],
        queryParams: ['months'],
        autoSync: false,
      },
      'GET /expense-trends': {
        description: 'Get expense trends (monthly)',
        permissions: ['dashboard.view'],
        queryParams: ['months'],
        autoSync: false,
      },
      'GET /top-properties': {
        description: 'Get top performing properties',
        permissions: ['dashboard.view'],
        queryParams: ['limit'],
        autoSync: false,
      },
    },
  },

  /**
   * AUDIT LOGS
   * System change tracking
   */
  audit: {
    basePath: '/api/audit',
    endpoints: {
      'GET /logs': {
        description: 'Get audit logs',
        permissions: ['audit.view'],
        queryParams: ['entityType', 'entityId', 'userId', 'action', 'limit'],
        autoSync: false,
      },
      'GET /logs/entity/:entityType/:entityId': {
        description: 'Get audit logs for entity',
        permissions: ['audit.view'],
        autoSync: false,
      },
    },
  },
};

/**
 * AUTO-SYNC WORKFLOW DIAGRAM (Text Representation)
 */
export const WORKFLOW_DIAGRAMS = {
  propertyToTenant: `
    Property → Assign Tenant → Create Tenancy → Update Property Status (Occupied)
  `,
  tenancyToInvoice: `
    Tenancy (active) → Auto-generate Monthly Invoice → Create Invoice → 
    Sync to FinanceLedger (income) → Update TenantLedger (debit) → 
    Update Tenant outstandingBalance
  `,
  paymentToFinance: `
    Payment Received → Update Invoice Status → Sync to FinanceLedger (income) → 
    Update TenantLedger (credit) → Update Tenant outstandingBalance
  `,
  expenseToFinance: `
    Property Expense → Create PropertyExpense → Auto-sync to FinanceLedger (expense) → 
    Link expense.financeLedgerId
  `,
  maintenanceToFinance: `
    Maintenance Request Completed (with cost) → Auto-sync to FinanceLedger (expense) → 
    Link maintenance.financeLedgerId
  `,
  dealToFinance: `
    Deal Stage → closed-won → Auto-sync to FinanceLedger (income) → 
    Link deal.financeLedgerId
  `,
  payrollToFinance: `
    Payroll Payment Status → paid → Auto-sync to FinanceLedger (expense) → 
    Link payroll.financeLedgerId
  `,
};

/**
 * SYSTEM FLOW (Complete Chain)
 */
export const SYSTEM_FLOW = {
  propertyToFinance: `
    Property → Tenant → Lease → Tenancy → Invoice → Payment → Finance Ledger
  `,
  propertyToMaintenance: `
    Property → Maintenance Request → Expense (if cost) → Finance Ledger
  `,
  leadToDeal: `
    Lead → Client → Deal → Deal Stage (closed-won) → Finance Ledger
  `,
  hrToFinance: `
    Payroll Salary → Payment Status (paid) → Finance Ledger (expense)
  `,
};

