"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnoseVoucherPosting = diagnoseVoucherPosting;
const client_1 = __importDefault(require("../prisma/client"));
async function diagnoseVoucherPosting(voucherId) {
    console.log(`\n=== Diagnosing Voucher Posting: ${voucherId} ===\n`);
    // 1. Fetch voucher
    const voucher = await client_1.default.voucher.findUnique({
        where: { id: voucherId },
        include: {
            lines: {
                include: {
                    account: true,
                },
            },
            journalEntry: {
                include: {
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                },
            },
            property: true,
            deal: true,
        },
    });
    if (!voucher) {
        console.error(`❌ Voucher not found: ${voucherId}`);
        return;
    }
    console.log(`📋 Voucher: ${voucher.voucherNumber}`);
    console.log(`   Type: ${voucher.type}`);
    console.log(`   Status: ${voucher.status}`);
    console.log(`   Date: ${voucher.date.toISOString().split('T')[0]}`);
    console.log(`   Posting Date: ${voucher.postingDate?.toISOString().split('T')[0] || 'N/A'}`);
    console.log(`   Amount: ${voucher.amount.toFixed(2)}`);
    // 2. Check voucher status
    if (voucher.status !== 'posted') {
        console.error(`\n❌ Voucher is not posted. Status: ${voucher.status}`);
        return;
    }
    console.log(`\n✅ Voucher status: POSTED`);
    // 3. Check journal entry
    if (!voucher.journalEntryId) {
        console.error(`\n❌ Voucher has no journalEntryId`);
        return;
    }
    console.log(`\n✅ Journal Entry ID: ${voucher.journalEntryId}`);
    const journalEntry = voucher.journalEntry;
    if (!journalEntry) {
        console.error(`\n❌ Journal Entry not found: ${voucher.journalEntryId}`);
        return;
    }
    console.log(`\n📊 Journal Entry:`);
    console.log(`   Entry Number: ${journalEntry.entryNumber}`);
    console.log(`   Voucher No: ${journalEntry.voucherNo}`);
    console.log(`   Date: ${journalEntry.date.toISOString().split('T')[0]}`);
    console.log(`   Status: ${journalEntry.status}`);
    console.log(`   Description: ${journalEntry.description || 'N/A'}`);
    // 4. Compare voucher lines vs journal lines
    console.log(`\n📝 Voucher Lines (${voucher.lines.length}):`);
    const voucherTotals = { debit: 0, credit: 0 };
    voucher.lines.forEach((line, idx) => {
        console.log(`   ${idx + 1}. ${line.account.code} - ${line.account.name}`);
        console.log(`      Debit: ${line.debit.toFixed(2)}, Credit: ${line.credit.toFixed(2)}`);
        voucherTotals.debit += line.debit;
        voucherTotals.credit += line.credit;
    });
    console.log(`   Total Debit: ${voucherTotals.debit.toFixed(2)}`);
    console.log(`   Total Credit: ${voucherTotals.credit.toFixed(2)}`);
    console.log(`\n📝 Journal Lines (${journalEntry.lines.length}):`);
    const journalTotals = { debit: 0, credit: 0 };
    journalEntry.lines.forEach((line, idx) => {
        console.log(`   ${idx + 1}. ${line.account.code} - ${line.account.name}`);
        console.log(`      Debit: ${line.debit.toFixed(2)}, Credit: ${line.credit.toFixed(2)}`);
        journalTotals.debit += line.debit;
        journalTotals.credit += line.credit;
    });
    console.log(`   Total Debit: ${journalTotals.debit.toFixed(2)}`);
    console.log(`   Total Credit: ${journalTotals.credit.toFixed(2)}`);
    // 5. Verify totals match
    const debitMatch = Math.abs(voucherTotals.debit - journalTotals.debit) < 0.01;
    const creditMatch = Math.abs(voucherTotals.credit - journalTotals.credit) < 0.01;
    const balanced = Math.abs(journalTotals.debit - journalTotals.credit) < 0.01;
    if (!debitMatch || !creditMatch) {
        console.error(`\n❌ Totals mismatch!`);
        console.error(`   Voucher Debit: ${voucherTotals.debit.toFixed(2)} vs Journal Debit: ${journalTotals.debit.toFixed(2)}`);
        console.error(`   Voucher Credit: ${voucherTotals.credit.toFixed(2)} vs Journal Credit: ${journalTotals.credit.toFixed(2)}`);
    }
    else {
        console.log(`\n✅ Totals match`);
    }
    if (!balanced) {
        console.error(`\n❌ Journal Entry is not balanced!`);
        console.error(`   Debit: ${journalTotals.debit.toFixed(2)} ≠ Credit: ${journalTotals.credit.toFixed(2)}`);
    }
    else {
        console.log(`✅ Journal Entry is balanced`);
    }
    // 6. Check Account Ledger visibility
    console.log(`\n🔍 Checking Account Ledger visibility...`);
    const accountIds = new Set();
    voucher.lines.forEach((line) => {
        accountIds.add(line.accountId);
    });
    const { LedgerService } = await Promise.resolve().then(() => __importStar(require('../services/ledger-service')));
    const ledgerResult = await LedgerService.getCompanyLedger({
        startDate: new Date(voucher.date.getFullYear(), voucher.date.getMonth(), voucher.date.getDate()),
        endDate: new Date(voucher.date.getFullYear(), voucher.date.getMonth(), voucher.date.getDate() + 1),
    });
    const ledgerEntriesForVoucher = ledgerResult.entries.filter((e) => e.journalEntryId === journalEntry.id || e.voucherNo === voucher.voucherNumber);
    console.log(`   Found ${ledgerEntriesForVoucher.length} entries in Account Ledger for this voucher`);
    if (ledgerEntriesForVoucher.length === 0) {
        console.error(`\n❌ Voucher does NOT appear in Account Ledger report!`);
        console.error(`   This indicates the Account Ledger is not reading from JournalLine.`);
    }
    else {
        console.log(`\n✅ Voucher appears in Account Ledger report`);
        ledgerEntriesForVoucher.forEach((entry, idx) => {
            console.log(`   ${idx + 1}. ${entry.accountDebit || entry.accountCredit} - ${entry.amount.toFixed(2)}`);
        });
    }
    // 7. Check account balances
    console.log(`\n💰 Account Balances (from JournalLine):`);
    for (const accountId of accountIds) {
        const account = voucher.lines.find((l) => l.accountId === accountId)?.account;
        if (!account)
            continue;
        const accountLedger = await LedgerService.getCompanyLedger({
            accountId,
        });
        const accountEntries = accountLedger.entries.filter((e) => e.journalEntryId === journalEntry.id);
        const accountTotal = accountEntries.reduce((sum, e) => {
            if (e.debitAccountId === accountId)
                return sum + e.amount;
            if (e.creditAccountId === accountId)
                return sum - e.amount;
            return sum;
        }, 0);
        console.log(`   ${account.code} - ${account.name}: ${accountTotal.toFixed(2)}`);
    }
    console.log(`\n=== Diagnosis Complete ===\n`);
}
// Run if called directly
if (require.main === module) {
    const voucherId = process.argv[2];
    if (!voucherId) {
        console.error('Usage: npx ts-node backend/src/scripts/diagnose-voucher-posting.ts <voucherId>');
        process.exit(1);
    }
    diagnoseVoucherPosting(voucherId)
        .then(() => {
        process.exit(0);
    })
        .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=diagnose-voucher-posting.js.map