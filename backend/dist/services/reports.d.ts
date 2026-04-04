/**
 * Financial Reports Service
 * Generates Income Statement, Cash Flow, Closing Balance reports
 */
/**
 * Generate Income Statement
 */
export declare function generateIncomeStatement(startDate: Date, endDate: Date, propertyId?: string): Promise<{
    period: {
        startDate: Date;
        endDate: Date;
    };
    revenue: {
        total: number;
        breakdown: {
            [key: string]: number;
        };
        entries: ({
            deal: ({
                client: {
                    name: string;
                    id: string;
                    clientCode: string | null;
                } | null;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                } | null;
            } & {
                status: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                attachments: import("@prisma/client/runtime/library").JsonValue | null;
                createdBy: string | null;
                isDeleted: boolean;
                tags: import("@prisma/client/runtime/library").JsonValue | null;
                updatedBy: string | null;
                manualUniqueId: string | null;
                tid: string | null;
                clientId: string | null;
                notes: string | null;
                dealerId: string | null;
                approvedAt: Date | null;
                propertyId: string | null;
                title: string;
                deletedAt: Date | null;
                deletedBy: string | null;
                role: string | null;
                unitId: string | null;
                locationId: string | null;
                subsidiaryOptionId: string | null;
                dealCode: string | null;
                dealAmount: number;
                commissionRate: number;
                listingPriceSnapshot: number | null;
                varianceAmount: number | null;
                varianceType: string | null;
                stage: string;
                actualClosingDate: Date | null;
                approvedBy: string | null;
                commissionAmount: number;
                dealType: string | null;
                expectedClosingDate: Date | null;
                expectedRevenue: number | null;
                probability: number;
                requiresApproval: boolean;
                valueBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
                dealDate: Date;
                totalPaid: number;
            }) | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            dealId: string | null;
            amount: number;
            date: Date;
            notes: string | null;
            tenantId: string | null;
            propertyId: string | null;
            description: string | null;
            paymentId: string | null;
            payrollId: string | null;
            category: string;
            invoiceId: string | null;
            referenceType: string;
            referenceId: string | null;
        })[];
    };
    expenses: {
        total: number;
        breakdown: {
            [key: string]: number;
        };
        entries: ({
            deal: ({
                client: {
                    name: string;
                    id: string;
                    clientCode: string | null;
                } | null;
                property: {
                    name: string;
                    id: string;
                    propertyCode: string | null;
                } | null;
            } & {
                status: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                attachments: import("@prisma/client/runtime/library").JsonValue | null;
                createdBy: string | null;
                isDeleted: boolean;
                tags: import("@prisma/client/runtime/library").JsonValue | null;
                updatedBy: string | null;
                manualUniqueId: string | null;
                tid: string | null;
                clientId: string | null;
                notes: string | null;
                dealerId: string | null;
                approvedAt: Date | null;
                propertyId: string | null;
                title: string;
                deletedAt: Date | null;
                deletedBy: string | null;
                role: string | null;
                unitId: string | null;
                locationId: string | null;
                subsidiaryOptionId: string | null;
                dealCode: string | null;
                dealAmount: number;
                commissionRate: number;
                listingPriceSnapshot: number | null;
                varianceAmount: number | null;
                varianceType: string | null;
                stage: string;
                actualClosingDate: Date | null;
                approvedBy: string | null;
                commissionAmount: number;
                dealType: string | null;
                expectedClosingDate: Date | null;
                expectedRevenue: number | null;
                probability: number;
                requiresApproval: boolean;
                valueBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
                dealDate: Date;
                totalPaid: number;
            }) | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            createdBy: string | null;
            isDeleted: boolean;
            dealId: string | null;
            amount: number;
            date: Date;
            notes: string | null;
            tenantId: string | null;
            propertyId: string | null;
            description: string | null;
            paymentId: string | null;
            payrollId: string | null;
            category: string;
            invoiceId: string | null;
            referenceType: string;
            referenceId: string | null;
        })[];
    };
    netIncome: number;
    netIncomePercent: number;
}>;
/**
 * Generate Cash Flow Statement
 */
export declare function generateCashFlowStatement(startDate: Date, endDate: Date, propertyId?: string): Promise<{
    period: {
        startDate: Date;
        endDate: Date;
    };
    operatingActivities: {
        cashInflows: {
            rentPayments: number;
            dealPayments: number;
            total: number;
        };
        cashOutflows: {
            propertyExpenses: number;
            maintenance: number;
            salaries: number;
            total: number;
        };
    };
    netCashFlow: number;
    payments: ({
        invoice: ({
            property: {
                type: string;
                status: string;
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                city: string | null;
                isDeleted: boolean;
                manualUniqueId: string | null;
                propertySubsidiary: string | null;
                tid: string | null;
                dealerId: string | null;
                description: string | null;
                title: string | null;
                category: string | null;
                location: string | null;
                imageUrl: string | null;
                yearBuilt: number | null;
                totalArea: number | null;
                totalUnits: number;
                propertyCode: string | null;
                documents: import("@prisma/client/runtime/library").JsonValue | null;
                ownerName: string | null;
                ownerPhone: string | null;
                previousTenants: import("@prisma/client/runtime/library").JsonValue | null;
                rentAmount: number | null;
                rentEscalationPercentage: number | null;
                securityDeposit: number | null;
                size: number | null;
                locationId: string | null;
                amenities: string[];
                salePrice: number | null;
                subsidiaryOptionId: string | null;
            } | null;
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: import("@prisma/client/runtime/library").JsonValue | null;
            tid: string | null;
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
        }) | null;
        tenant: {
            name: string;
            id: string;
            email: string | null;
            password: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            cnic: string | null;
            cnicDocumentUrl: string | null;
            isDeleted: boolean;
            tid: string | null;
            unitId: string;
            isActive: boolean;
            lastLoginAt: Date | null;
            tenantCode: string | null;
            advanceBalance: number;
            outstandingBalance: number;
            profilePhotoUrl: string | null;
        } | null;
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        amount: number;
        method: string;
        date: Date;
        notes: string | null;
        journalEntryId: string | null;
        referenceNumber: string | null;
        tenantId: string | null;
        createdByUserId: string | null;
        paymentId: string;
        invoiceId: string | null;
        bankAccountId: string | null;
        allocatedAmount: number;
        overpaymentAmount: number;
        allocations: import("@prisma/client/runtime/library").JsonValue | null;
        receivableAccountId: string | null;
        advanceAccountId: string | null;
    })[];
    expenses: ({
        deal: ({
            property: {
                name: string;
                id: string;
                propertyCode: string | null;
            } | null;
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: import("@prisma/client/runtime/library").JsonValue | null;
            createdBy: string | null;
            isDeleted: boolean;
            tags: import("@prisma/client/runtime/library").JsonValue | null;
            updatedBy: string | null;
            manualUniqueId: string | null;
            tid: string | null;
            clientId: string | null;
            notes: string | null;
            dealerId: string | null;
            approvedAt: Date | null;
            propertyId: string | null;
            title: string;
            deletedAt: Date | null;
            deletedBy: string | null;
            role: string | null;
            unitId: string | null;
            locationId: string | null;
            subsidiaryOptionId: string | null;
            dealCode: string | null;
            dealAmount: number;
            commissionRate: number;
            listingPriceSnapshot: number | null;
            varianceAmount: number | null;
            varianceType: string | null;
            stage: string;
            actualClosingDate: Date | null;
            approvedBy: string | null;
            commissionAmount: number;
            dealType: string | null;
            expectedClosingDate: Date | null;
            expectedRevenue: number | null;
            probability: number;
            requiresApproval: boolean;
            valueBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
            dealDate: Date;
            totalPaid: number;
        }) | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        isDeleted: boolean;
        dealId: string | null;
        amount: number;
        date: Date;
        notes: string | null;
        tenantId: string | null;
        propertyId: string | null;
        description: string | null;
        paymentId: string | null;
        payrollId: string | null;
        category: string;
        invoiceId: string | null;
        referenceType: string;
        referenceId: string | null;
    })[];
}>;
/**
 * Generate Closing Balance Report (Trial Balance)
 */
export declare function generateClosingBalance(asOfDate: Date, propertyId?: string): Promise<{
    asOfDate: Date;
    income: {
        total: number;
        invoiced: number;
        received: number;
    };
    expenses: {
        total: number;
    };
    balances: {
        netIncome: number;
        cash: number;
        outstanding: number;
    };
    summary: {
        totalIncome: number;
        totalExpenses: number;
        netIncome: number;
        cashBalance: number;
        outstandingReceivables: number;
    };
}>;
/**
 * Calculate overdue invoices with late fees
 */
export declare function calculateOverdueInvoices(): Promise<{
    invoices: {
        daysOverdue: number;
        lateFee: number;
        totalDue: number;
        property: {
            type: string;
            status: string;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string;
            city: string | null;
            isDeleted: boolean;
            manualUniqueId: string | null;
            propertySubsidiary: string | null;
            tid: string | null;
            dealerId: string | null;
            description: string | null;
            title: string | null;
            category: string | null;
            location: string | null;
            imageUrl: string | null;
            yearBuilt: number | null;
            totalArea: number | null;
            totalUnits: number;
            propertyCode: string | null;
            documents: import("@prisma/client/runtime/library").JsonValue | null;
            ownerName: string | null;
            ownerPhone: string | null;
            previousTenants: import("@prisma/client/runtime/library").JsonValue | null;
            rentAmount: number | null;
            rentEscalationPercentage: number | null;
            securityDeposit: number | null;
            size: number | null;
            locationId: string | null;
            amenities: string[];
            salePrice: number | null;
            subsidiaryOptionId: string | null;
        } | null;
        tenant: {
            name: string;
            id: string;
            email: string | null;
            password: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            address: string | null;
            cnic: string | null;
            cnicDocumentUrl: string | null;
            isDeleted: boolean;
            tid: string | null;
            unitId: string;
            isActive: boolean;
            lastLoginAt: Date | null;
            tenantCode: string | null;
            advanceBalance: number;
            outstandingBalance: number;
            profilePhotoUrl: string | null;
        } | null;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        tid: string | null;
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
//# sourceMappingURL=reports.d.ts.map