/**
 * Complete API Structure Documentation
 * This file documents all API endpoints, their purposes, and auto-sync workflows
 */
export declare const API_STRUCTURE: {
    /**
     * PROPERTIES MODULE
     * Core foundation for property management
     */
    properties: {
        basePath: string;
        endpoints: {
            'GET /': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'GET /:id': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'GET /:id/dashboard': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                returns: {
                    financials: string;
                    occupancy: string;
                    maintenance: string;
                };
            };
            'POST /': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'PUT /:id': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'DELETE /:id': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'POST /:id/assign-tenant': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'DELETE /:id/remove-tenant/:tenantId': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /:id/expenses': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /:id/maintenance': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /:id/upload': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'GET /:id/attachments': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
        };
    };
    /**
     * FINANCE MODULE
     * Auto-sync with all other modules
     */
    finance: {
        basePath: string;
        endpoints: {
            'GET /ledger': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'GET /summary': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'POST /ledger': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'POST /sync/invoice/:invoiceId': {
                description: string;
                permissions: string[];
                autoSync: string[];
            };
            'POST /sync/payment/:paymentId': {
                description: string;
                permissions: string[];
                autoSync: string[];
            };
            'POST /sync/deal/:dealId': {
                description: string;
                permissions: string[];
                autoSync: string[];
            };
            'POST /sync/payroll/:payrollId': {
                description: string;
                permissions: string[];
                autoSync: string[];
            };
            'GET /ledger/reference/:referenceType/:referenceId': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
        };
    };
    /**
     * CRM MODULE
     * Leads, Clients, Deals, Dealers
     */
    crm: {
        basePath: string;
        endpoints: {
            'GET /leads': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'POST /leads': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'POST /leads/:id/convert': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'GET /clients': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'POST /clients': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'GET /deals': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'POST /deals': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'PUT /deals/:id/stage': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /communications': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
        };
    };
    /**
     * TENANT PORTAL
     * Tenant-facing APIs
     */
    tenantPortal: {
        basePath: string;
        endpoints: {
            'GET /dashboard': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'GET /invoices': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'GET /payments': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'GET /ledger': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
            'POST /complaints': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /upload-cnic': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
            'POST /pay-rent': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
        };
    };
    /**
     * HR + PAYROLL
     * Auto-sync with Finance
     */
    hr: {
        basePath: string;
        endpoints: {
            'POST /payroll': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                auditLog: boolean;
            };
            'PUT /payroll/:id/process': {
                description: string;
                permissions: string[];
                autoSync: string[];
                auditLog: boolean;
            };
        };
    };
    /**
     * DASHBOARD ANALYTICS
     * Interactive analytics
     */
    dashboard: {
        basePath: string;
        endpoints: {
            'GET /overall': {
                description: string;
                permissions: string[];
                autoSync: boolean;
                returns: {
                    properties: string;
                    financials: string;
                    crm: string;
                    maintenance: string;
                };
            };
            'GET /revenue-trends': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'GET /expense-trends': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'GET /top-properties': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
        };
    };
    /**
     * AUDIT LOGS
     * System change tracking
     */
    audit: {
        basePath: string;
        endpoints: {
            'GET /logs': {
                description: string;
                permissions: string[];
                queryParams: string[];
                autoSync: boolean;
            };
            'GET /logs/entity/:entityType/:entityId': {
                description: string;
                permissions: string[];
                autoSync: boolean;
            };
        };
    };
};
/**
 * AUTO-SYNC WORKFLOW DIAGRAM (Text Representation)
 */
export declare const WORKFLOW_DIAGRAMS: {
    propertyToTenant: string;
    tenancyToInvoice: string;
    paymentToFinance: string;
    expenseToFinance: string;
    maintenanceToFinance: string;
    dealToFinance: string;
    payrollToFinance: string;
};
/**
 * SYSTEM FLOW (Complete Chain)
 */
export declare const SYSTEM_FLOW: {
    propertyToFinance: string;
    propertyToMaintenance: string;
    leadToDeal: string;
    hrToFinance: string;
};
//# sourceMappingURL=api-structure.d.ts.map