/**
 * Lease History Service
 * Tracks all changes to leases including creation, updates, renewals, and status changes
 */
/**
 * Create lease history entry
 */
export declare function createLeaseHistory(leaseId: string, action: 'created' | 'updated' | 'renewed' | 'status_changed' | 'terminated' | 'expired', changes: {
    field?: string;
    oldValue?: any;
    newValue?: any;
    changedBy?: string;
    notes?: string;
    metadata?: any;
}): Promise<{
    id: string;
    action: "expired" | "created" | "updated" | "terminated" | "renewed" | "status_changed";
    field: string | undefined;
    oldValue: any;
    newValue: any;
    changedBy: string | undefined;
    changedAt: string;
    notes: string | undefined;
    metadata: any;
} | null>;
/**
 * Get lease history
 */
export declare function getLeaseHistory(leaseId: string): Promise<{
    leaseId: string;
    leaseNumber: string | null;
    history: any[];
    totalEntries: number;
} | null>;
/**
 * Track lease renewal
 */
export declare function trackLeaseRenewal(leaseId: string, renewalData: {
    newLeaseEnd: Date;
    newRent?: number;
    renewedBy?: string;
    notes?: string;
}): Promise<void>;
/**
 * Track lease status change
 */
export declare function trackLeaseStatusChange(leaseId: string, newStatus: string, changedBy?: string, notes?: string): Promise<void>;
//# sourceMappingURL=lease-history.d.ts.map