/**
 * Diagnostic Script: Verify Voucher Posting Integrity
 *
 * This script checks:
 * 1. Voucher status = "posted"
 * 2. JournalEntry exists and is linked
 * 3. JournalLines exist for all voucher lines
 * 4. Account Ledger report shows entries from JournalLine
 * 5. Totals match between voucher, journal, and ledger
 *
 * Usage: npx ts-node backend/src/scripts/diagnose-voucher-posting.ts <voucherId>
 */
declare function diagnoseVoucherPosting(voucherId: string): Promise<void>;
export { diagnoseVoucherPosting };
//# sourceMappingURL=diagnose-voucher-posting.d.ts.map