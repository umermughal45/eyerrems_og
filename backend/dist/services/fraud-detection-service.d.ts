export interface RedFlag {
    type: 'Duplicate Payment' | 'Round Amount' | 'Weekend Posting' | 'Manual Control Account Entry' | 'High Value';
    severity: 'Low' | 'Medium' | 'High';
    description: string;
    transactionId: string;
    date: Date;
    amount: number;
    details?: any;
}
export declare class FraudDetectionService {
    /**
     * Detect potential duplicate payments
     * Same amount, same client, within 24 hours
     */
    static detectDuplicatePayments(startDate?: Date, endDate?: Date): Promise<RedFlag[]>;
    /**
     * Detect round amount transactions (e.g., 1000.00, 5000.00)
     * Often used in fabricated transactions
     */
    static detectRoundAmounts(startDate?: Date, endDate?: Date, threshold?: number): Promise<RedFlag[]>;
    /**
     * Detect transactions posted on weekends
     */
    static detectWeekendPostings(startDate?: Date, endDate?: Date): Promise<RedFlag[]>;
    /**
     * Generate comprehensive Red Flags Report
     */
    static generateRedFlagsReport(startDate?: Date, endDate?: Date): Promise<RedFlag[]>;
}
//# sourceMappingURL=fraud-detection-service.d.ts.map