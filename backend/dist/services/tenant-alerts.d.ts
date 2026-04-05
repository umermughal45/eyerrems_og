/**
 * Tenant Alerts Service
 * Handles overdue rent alerts and lease expiry alerts for tenants
 */
/**
 * Get overdue invoices for a tenant or all tenants
 */
export declare function getOverdueRentAlerts(tenantId?: string): Promise<{
    alerts: {
        daysOverdue: number;
        lateFee: number;
        totalDue: number;
        property: {
            name: string;
            id: string;
            propertyCode: string | null;
        } | null;
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
            tenantCode: string | null;
        } | null;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        amount: number;
        journalEntryId: string | null;
        invoiceNumber: string;
        dueDate: Date;
        tenantId: string | null;
        propertyId: string | null;
        billingDate: Date;
        taxPercent: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        remainingAmount: number;
        lateFeeRule: string;
        termsAndConditions: string | null;
        tenantAccountId: string | null;
        incomeAccountId: string | null;
        createdByUserId: string | null;
    }[];
    summary: {
        count: number;
        totalOverdueAmount: number;
        totalLateFees: number;
        totalDue: number;
    };
}>;
/**
 * Get lease expiry alerts for tenants
 */
export declare function getTenantLeaseExpiryAlerts(tenantId?: string): Promise<{
    critical: {
        daysRemaining: number;
        alertLevel: "urgent" | "warning" | "critical";
        unit: {
            id: string;
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            unitName: string;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        };
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tid: string | null;
        notes: string | null;
        tenantId: string;
        termsAndConditions: string | null;
        unitId: string;
        securityDeposit: number | null;
        leaseStart: Date;
        leaseEnd: Date;
        rent: number;
        leaseDocumentUrl: string | null;
        leaseNumber: string | null;
        noticePeriod: number | null;
        renewalDate: Date | null;
        renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
        rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
    urgent: {
        daysRemaining: number;
        alertLevel: "urgent" | "warning" | "critical";
        unit: {
            id: string;
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            unitName: string;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        };
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tid: string | null;
        notes: string | null;
        tenantId: string;
        termsAndConditions: string | null;
        unitId: string;
        securityDeposit: number | null;
        leaseStart: Date;
        leaseEnd: Date;
        rent: number;
        leaseDocumentUrl: string | null;
        leaseNumber: string | null;
        noticePeriod: number | null;
        renewalDate: Date | null;
        renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
        rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
    warning: {
        daysRemaining: number;
        alertLevel: "urgent" | "warning" | "critical";
        unit: {
            id: string;
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            unitName: string;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        };
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tid: string | null;
        notes: string | null;
        tenantId: string;
        termsAndConditions: string | null;
        unitId: string;
        securityDeposit: number | null;
        leaseStart: Date;
        leaseEnd: Date;
        rent: number;
        leaseDocumentUrl: string | null;
        leaseNumber: string | null;
        noticePeriod: number | null;
        renewalDate: Date | null;
        renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
        rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
    all: {
        daysRemaining: number;
        alertLevel: "urgent" | "warning" | "critical";
        unit: {
            id: string;
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            unitName: string;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        };
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tid: string | null;
        notes: string | null;
        tenantId: string;
        termsAndConditions: string | null;
        unitId: string;
        securityDeposit: number | null;
        leaseStart: Date;
        leaseEnd: Date;
        rent: number;
        leaseDocumentUrl: string | null;
        leaseNumber: string | null;
        noticePeriod: number | null;
        renewalDate: Date | null;
        renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
        rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
    }[];
    summary: {
        total: number;
        critical: number;
        urgent: number;
        warning: number;
    };
}>;
/**
 * Get all tenant alerts (overdue rent + lease expiry)
 */
export declare function getAllTenantAlerts(tenantId?: string): Promise<{
    overdueRent: {
        alerts: {
            daysOverdue: number;
            lateFee: number;
            totalDue: number;
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            } | null;
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
                tenantCode: string | null;
            } | null;
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: import("@prisma/client/runtime/library").JsonValue | null;
            amount: number;
            journalEntryId: string | null;
            invoiceNumber: string;
            dueDate: Date;
            tenantId: string | null;
            propertyId: string | null;
            billingDate: Date;
            taxPercent: number;
            taxAmount: number;
            discountAmount: number;
            totalAmount: number;
            remainingAmount: number;
            lateFeeRule: string;
            termsAndConditions: string | null;
            tenantAccountId: string | null;
            incomeAccountId: string | null;
            createdByUserId: string | null;
        }[];
        summary: {
            count: number;
            totalOverdueAmount: number;
            totalLateFees: number;
            totalDue: number;
        };
    };
    leaseExpiry: {
        critical: {
            daysRemaining: number;
            alertLevel: "urgent" | "warning" | "critical";
            unit: {
                id: string;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                };
                unitName: string;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            };
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tid: string | null;
            notes: string | null;
            tenantId: string;
            termsAndConditions: string | null;
            unitId: string;
            securityDeposit: number | null;
            leaseStart: Date;
            leaseEnd: Date;
            rent: number;
            leaseDocumentUrl: string | null;
            leaseNumber: string | null;
            noticePeriod: number | null;
            renewalDate: Date | null;
            renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
            rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        urgent: {
            daysRemaining: number;
            alertLevel: "urgent" | "warning" | "critical";
            unit: {
                id: string;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                };
                unitName: string;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            };
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tid: string | null;
            notes: string | null;
            tenantId: string;
            termsAndConditions: string | null;
            unitId: string;
            securityDeposit: number | null;
            leaseStart: Date;
            leaseEnd: Date;
            rent: number;
            leaseDocumentUrl: string | null;
            leaseNumber: string | null;
            noticePeriod: number | null;
            renewalDate: Date | null;
            renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
            rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        warning: {
            daysRemaining: number;
            alertLevel: "urgent" | "warning" | "critical";
            unit: {
                id: string;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                };
                unitName: string;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            };
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tid: string | null;
            notes: string | null;
            tenantId: string;
            termsAndConditions: string | null;
            unitId: string;
            securityDeposit: number | null;
            leaseStart: Date;
            leaseEnd: Date;
            rent: number;
            leaseDocumentUrl: string | null;
            leaseNumber: string | null;
            noticePeriod: number | null;
            renewalDate: Date | null;
            renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
            rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        all: {
            daysRemaining: number;
            alertLevel: "urgent" | "warning" | "critical";
            unit: {
                id: string;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                };
                unitName: string;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            };
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tid: string | null;
            notes: string | null;
            tenantId: string;
            termsAndConditions: string | null;
            unitId: string;
            securityDeposit: number | null;
            leaseStart: Date;
            leaseEnd: Date;
            rent: number;
            leaseDocumentUrl: string | null;
            leaseNumber: string | null;
            noticePeriod: number | null;
            renewalDate: Date | null;
            renewalHistory: import("@prisma/client/runtime/library").JsonValue | null;
            rentTerms: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        summary: {
            total: number;
            critical: number;
            urgent: number;
            warning: number;
        };
    };
    totalAlerts: number;
}>;
//# sourceMappingURL=tenant-alerts.d.ts.map