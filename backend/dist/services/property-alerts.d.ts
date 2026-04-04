/**
 * Property Alerts Service
 * Handles maintenance due alerts and lease expiry alerts
 */
/**
 * Check for maintenance requests that are due
 * Returns maintenance requests that need attention
 */
export declare function getMaintenanceDueAlerts(propertyId?: string): Promise<{
    urgent: ({
        property: {
            name: string;
            id: string;
            propertyCode: string | null;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        } | null;
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tenantId: string | null;
        propertyId: string;
        assignedTo: string | null;
        priority: string;
        unitId: string | null;
        completedAt: Date | null;
        issueTitle: string;
        issueDescription: string;
        assignedToName: string | null;
        estimatedCost: number | null;
        actualCost: number | null;
        financeLedgerId: string | null;
    })[];
    overdue: ({
        property: {
            name: string;
            id: string;
            propertyCode: string | null;
        };
        tenant: {
            name: string;
            id: string;
            email: string | null;
            phone: string | null;
        } | null;
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        createdBy: string | null;
        isDeleted: boolean;
        updatedBy: string | null;
        tenantId: string | null;
        propertyId: string;
        assignedTo: string | null;
        priority: string;
        unitId: string | null;
        completedAt: Date | null;
        issueTitle: string;
        issueDescription: string;
        assignedToName: string | null;
        estimatedCost: number | null;
        actualCost: number | null;
        financeLedgerId: string | null;
    })[];
    total: number;
}>;
/**
 * Check for leases that are expiring soon
 * Returns leases expiring in 30, 15, and 7 days
 */
export declare function getLeaseExpiryAlerts(propertyId?: string): Promise<{
    expiringIn30Days: ({
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
    } & {
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
    })[];
    expiringIn15Days: ({
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
    } & {
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
    })[];
    expiringIn7Days: ({
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
    } & {
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
    })[];
    expired: ({
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
    } & {
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
    })[];
    total: number;
}>;
/**
 * Get all property alerts (maintenance + lease expiry)
 */
export declare function getAllPropertyAlerts(propertyId?: string): Promise<{
    maintenance: {
        urgent: ({
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            } | null;
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: import("@prisma/client/runtime/library").JsonValue | null;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tenantId: string | null;
            propertyId: string;
            assignedTo: string | null;
            priority: string;
            unitId: string | null;
            completedAt: Date | null;
            issueTitle: string;
            issueDescription: string;
            assignedToName: string | null;
            estimatedCost: number | null;
            actualCost: number | null;
            financeLedgerId: string | null;
        })[];
        overdue: ({
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            };
            tenant: {
                name: string;
                id: string;
                email: string | null;
                phone: string | null;
            } | null;
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: import("@prisma/client/runtime/library").JsonValue | null;
            createdBy: string | null;
            isDeleted: boolean;
            updatedBy: string | null;
            tenantId: string | null;
            propertyId: string;
            assignedTo: string | null;
            priority: string;
            unitId: string | null;
            completedAt: Date | null;
            issueTitle: string;
            issueDescription: string;
            assignedToName: string | null;
            estimatedCost: number | null;
            actualCost: number | null;
            financeLedgerId: string | null;
        })[];
        total: number;
    };
    leaseExpiry: {
        expiringIn30Days: ({
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
        } & {
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
        })[];
        expiringIn15Days: ({
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
        } & {
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
        })[];
        expiringIn7Days: ({
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
        } & {
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
        })[];
        expired: ({
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
        } & {
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
        })[];
        total: number;
    };
    totalAlerts: number;
}>;
//# sourceMappingURL=property-alerts.d.ts.map