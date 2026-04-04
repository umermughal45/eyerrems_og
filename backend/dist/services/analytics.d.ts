/**
 * Dashboard Analytics Service
 * Provides interactive analytics and reporting
 */
/**
 * Get property dashboard data
 */
export declare function getPropertyDashboard(propertyId: string): Promise<{
    property: {
        id: string;
        name: string;
        code: string | null;
        status: string;
        type: string;
    };
    financials: {
        income: number;
        expenses: number;
        netProfit: number;
        occupancyRate: number;
    };
    occupancy: {
        totalUnits: number;
        occupiedUnits: number;
        vacantUnits: number;
    };
    maintenance: {
        openRequests: number;
        totalRequests: number;
    };
    recentExpenses: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        createdBy: string | null;
        isDeleted: boolean;
        amount: number;
        date: Date;
        propertyId: string;
        description: string | null;
        category: string;
        financeLedgerId: string | null;
    }[];
    recentMaintenance: {
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
    }[];
}>;
/**
 * Get overall dashboard analytics
 */
export declare function getOverallDashboard(filters?: {
    startDate?: Date;
    endDate?: Date;
    propertyId?: string;
}): Promise<{
    properties: {
        total: number;
        occupied: number;
        vacant: number;
        occupancyRate: number;
    };
    financials: {
        totalIncome: number;
        totalExpenses: number;
        netProfit: number;
    };
    crm: {
        activeDeals: number;
        pendingInvoices: number;
    };
    maintenance: {
        openRequests: number;
    };
}>;
/**
 * Get revenue trends (monthly)
 */
export declare function getRevenueTrends(months?: number): Promise<{
    month: string;
    revenue: number;
}[]>;
/**
 * Get expense trends (monthly)
 */
export declare function getExpenseTrends(months?: number): Promise<{
    month: string;
    expense: number;
}[]>;
/**
 * Get top performing properties
 */
export declare function getTopProperties(limit?: number): Promise<{
    propertyId: string;
    propertyName: string;
    propertyCode: string | null;
    income: number;
    expenses: number;
    netProfit: number;
    occupancy: number;
    totalUnits: number;
}[]>;
//# sourceMappingURL=analytics.d.ts.map