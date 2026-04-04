"use strict";
/**
 * Payment Plan Utilities
 * Clean utility functions for payment plan calculations and validations
 * No inline logic - all calculations centralized here
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePaymentPlanSummary = calculatePaymentPlanSummary;
exports.calculateInstallmentSummary = calculateInstallmentSummary;
exports.calculateDealCompletionStatus = calculateDealCompletionStatus;
exports.validatePaymentPlan = validatePaymentPlan;
exports.calculateInstallmentStatus = calculateInstallmentStatus;
exports.distributePaymentAcrossInstallments = distributePaymentAcrossInstallments;
exports.formatCurrency = formatCurrency;
exports.formatPercentage = formatPercentage;
/**
 * Calculate payment plan summary from installments
 */
function calculatePaymentPlanSummary(installments) {
    const totalExpected = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const totalPaid = installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
    const remaining = Math.max(0, totalExpected - totalPaid);
    const paidPercentage = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;
    let status;
    if (totalPaid === 0) {
        status = 'Pending';
    }
    else if (remaining <= 0.01) { // Allow for floating point precision
        status = 'Fully Paid';
    }
    else {
        status = 'Partially Paid';
    }
    return {
        totalExpected,
        totalPaid,
        remaining,
        paidPercentage,
        status,
    };
}
/**
 * Calculate installment summary
 */
function calculateInstallmentSummary(installments) {
    const now = new Date();
    const totalInstallments = installments.length;
    const paidInstallments = installments.filter((inst) => inst.status === 'paid').length;
    const unpaidInstallments = totalInstallments - paidInstallments;
    const overdueInstallments = installments.filter((inst) => (inst.status === 'unpaid' || inst.status === 'overdue') &&
        new Date(inst.dueDate) < now).length;
    const totalAmount = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const paidAmount = installments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
    const remainingAmount = totalAmount - paidAmount;
    return {
        totalInstallments,
        paidInstallments,
        unpaidInstallments,
        overdueInstallments,
        totalAmount,
        paidAmount,
        remainingAmount,
    };
}
/**
 * Calculate deal completion status based on payments
 */
function calculateDealCompletionStatus(dealAmount, totalPaid) {
    const completionPercentage = dealAmount > 0 ? (totalPaid / dealAmount) * 100 : 0;
    const remaining = Math.max(0, dealAmount - totalPaid);
    const isCompleted = remaining <= 0.01; // Allow for floating point precision
    return {
        isCompleted,
        completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
        remaining,
    };
}
/**
 * Validate payment plan data
 */
function validatePaymentPlan(data) {
    if (data.numberOfInstallments < 1) {
        return { valid: false, error: 'Number of installments must be at least 1' };
    }
    if (data.totalAmount <= 0) {
        return { valid: false, error: 'Total amount must be greater than 0' };
    }
    if (data.installmentAmounts && data.installmentAmounts.length > 0) {
        if (data.installmentAmounts.length !== data.numberOfInstallments) {
            return {
                valid: false,
                error: 'Number of installment amounts must match number of installments',
            };
        }
        const sum = data.installmentAmounts.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - data.totalAmount) > 0.01) {
            return {
                valid: false,
                error: 'Sum of installment amounts must equal total amount',
            };
        }
        // Check for negative amounts
        if (data.installmentAmounts.some((amt) => amt <= 0)) {
            return { valid: false, error: 'All installment amounts must be greater than 0' };
        }
    }
    if (data.dueDates && data.dueDates.length > 0) {
        if (data.dueDates.length !== data.numberOfInstallments) {
            return {
                valid: false,
                error: 'Number of due dates must match number of installments',
            };
        }
        // Check for past dates (optional - might want to allow)
        // const now = new Date();
        // if (data.dueDates.some((date) => date < now)) {
        //   return { valid: false, error: 'Due dates cannot be in the past' };
        // }
    }
    return { valid: true };
}
/**
 * Update installment status based on paid amount
 */
function calculateInstallmentStatus(amount, paidAmount, dueDate) {
    const now = new Date();
    const isOverdue = new Date(dueDate) < now;
    if (paidAmount <= 0) {
        return isOverdue ? 'overdue' : 'unpaid';
    }
    if (paidAmount >= amount - 0.01) {
        // Allow for floating point precision
        return 'paid';
    }
    return 'partial';
}
/**
 * Distribute payment across installments (for partial payments)
 */
function distributePaymentAcrossInstallments(paymentAmount, installments) {
    const allocations = [];
    let remainingPayment = paymentAmount;
    // First, allocate to unpaid/overdue installments in order
    const unpaidInstallments = installments
        .filter((inst) => inst.status === 'unpaid' || inst.status === 'overdue' || inst.status === 'partial')
        .sort((a, b) => {
        // Sort by due date if available, otherwise by installment number
        return 0; // Simplified - you might want to add due date sorting
    });
    for (const installment of unpaidInstallments) {
        if (remainingPayment <= 0)
            break;
        const remainingForInstallment = installment.amount - installment.paidAmount;
        const allocation = Math.min(remainingPayment, remainingForInstallment);
        if (allocation > 0) {
            allocations.push({
                installmentId: installment.id,
                allocatedAmount: allocation,
            });
            remainingPayment -= allocation;
        }
    }
    return allocations;
}
/**
 * Format currency for display
 */
function formatCurrency(amount) {
    return `Rs ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
/**
 * Format percentage for display
 */
function formatPercentage(value) {
    return `${value.toFixed(1)}%`;
}
//# sourceMappingURL=payment-plan-utils.js.map