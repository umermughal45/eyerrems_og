export interface PropertyProfitabilityReport {
    propertyId: string | null;
    propertyName: string;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
}
export declare function generatePropertyProfitabilityReport(startDate: Date, endDate: Date, propertyId?: string): Promise<PropertyProfitabilityReport[]>;
//# sourceMappingURL=property-analytics-service.d.ts.map