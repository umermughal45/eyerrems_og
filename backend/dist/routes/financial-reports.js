"use strict";
/**
 * Financial Reports Routes
 * Trial Balance, Balance Sheet, P&L, Property Profitability, Escrow Report, Aging Reports
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
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const financial_reporting_service_1 = require("../services/financial-reporting-service");
const logger_1 = __importDefault(require("../utils/logger"));
const error_handler_1 = require("../utils/error-handler");
const router = express_1.default.Router();
/**
 * GET /api/financial-reports/trial-balance
 * Generate Trial Balance report
 */
router.get('/trial-balance', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const trialBalance = await financial_reporting_service_1.FinancialReportingService.generateTrialBalance(start, end);
        const totals = trialBalance.reduce((acc, entry) => ({
            totalDebits: acc.totalDebits + entry.debitTotal,
            totalCredits: acc.totalCredits + entry.creditTotal,
        }), { totalDebits: 0, totalCredits: 0 });
        const isBalanced = Math.abs(totals.totalDebits - totals.totalCredits) < 0.01;
        if (!isBalanced) {
            return res.status(422).json({
                error: 'Trial balance mismatch: period closing blocked',
                details: {
                    totals,
                    period: { startDate: start, endDate: end },
                },
            });
        }
        return (0, error_handler_1.successResponse)(res, {
            entries: trialBalance,
            totals,
            isBalanced,
            period: {
                startDate: start,
                endDate: end,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Generate trial balance error:', error);
        res.status(500).json({
            error: 'Failed to generate trial balance',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/financial-reports/balance-sheet
 * Generate Balance Sheet report
 */
router.get('/balance-sheet', auth_1.authenticate, async (req, res) => {
    try {
        const { asOfDate } = req.query;
        const asOf = asOfDate ? new Date(asOfDate) : undefined;
        const balanceSheet = await financial_reporting_service_1.FinancialReportingService.generateBalanceSheet(asOf);
        return (0, error_handler_1.successResponse)(res, balanceSheet);
    }
    catch (error) {
        logger_1.default.error('Generate balance sheet error:', error);
        res.status(500).json({
            error: 'Failed to generate balance sheet',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/financial-reports/profit-loss
 * Generate Profit & Loss Statement
 */
router.get('/profit-loss', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required',
            });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
            });
        }
        const profitLoss = await financial_reporting_service_1.FinancialReportingService.generateProfitAndLoss(start, end);
        return (0, error_handler_1.successResponse)(res, profitLoss);
    }
    catch (error) {
        logger_1.default.error('Generate profit & loss error:', error);
        res.status(500).json({
            error: 'Failed to generate profit & loss statement',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/financial-reports/property-profitability
 * Generate Property Profitability Report
 */
router.get('/property-profitability', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId, startDate, endDate } = req.query;
        // Validate date inputs
        let start;
        let end;
        if (startDate) {
            start = new Date(startDate);
            if (Number.isNaN(start.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid start date format',
                    message: 'Start date must be a valid date string',
                });
            }
        }
        if (endDate) {
            end = new Date(endDate);
            if (Number.isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid end date format',
                    message: 'End date must be a valid date string',
                });
            }
        }
        // Validate date range
        if (start && end && start > end) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date range',
                message: 'Start date must be before or equal to end date',
            });
        }
        // Validate property ID if provided
        if (propertyId && typeof propertyId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid property ID',
                message: 'Property ID must be a valid string',
            });
        }
        // Generate profitability report
        const profitability = await financial_reporting_service_1.FinancialReportingService.generatePropertyProfitability(propertyId, start, end);
        // Return results (empty array if no data found is valid)
        return (0, error_handler_1.successResponse)(res, profitability);
    }
    catch (error) {
        logger_1.default.error('Generate property profitability error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        // Check for specific error types
        if (typeof message === 'string' && message.startsWith('INVALID_PROPERTY_DIMENSION')) {
            const parts = message.split(':');
            const count = parts[1] ? Number(parts[1]) : undefined;
            return res.status(422).json({
                success: false,
                error: 'Invalid transactions: revenue/expense without property',
                message: 'Some transactions are missing property associations',
                details: { count },
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate property profitability report',
            message,
        });
    }
});
/**
 * GET /api/financial-reports/escrow
 * Generate Escrow Report
 */
router.get('/escrow', auth_1.authenticate, async (req, res) => {
    try {
        const escrowReport = await financial_reporting_service_1.FinancialReportingService.generateEscrowReport();
        return (0, error_handler_1.successResponse)(res, escrowReport);
    }
    catch (error) {
        logger_1.default.error('Generate escrow report error:', error);
        res.status(500).json({
            error: 'Failed to generate escrow report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/financial-reports/aging
 * Generate Aging Report for Receivables or Payables
 */
router.get('/aging', auth_1.authenticate, async (req, res) => {
    try {
        const { type, asOfDate } = req.query;
        if (!type || (type !== 'Receivable' && type !== 'Payable')) {
            return res.status(400).json({
                error: 'type parameter is required and must be "Receivable" or "Payable"',
            });
        }
        const asOf = asOfDate ? new Date(asOfDate) : undefined;
        const agingReport = await financial_reporting_service_1.FinancialReportingService.generateAgingReport(type, asOf);
        const totals = agingReport.reduce((acc, entry) => ({
            current: acc.current + entry.current,
            days31_60: acc.days31_60 + entry.days31_60,
            days61_90: acc.days61_90 + entry.days61_90,
            days91_plus: acc.days91_plus + entry.days91_plus,
            total: acc.total + entry.total,
        }), { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0, total: 0 });
        return (0, error_handler_1.successResponse)(res, {
            type,
            entries: agingReport,
            totals,
            asOfDate: asOf || new Date(),
        });
    }
    catch (error) {
        logger_1.default.error('Generate aging report error:', error);
        res.status(500).json({
            error: 'Failed to generate aging report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Export routes for PDF and Excel
 */
// Helper to generate PDF for reports
async function generateReportPDF(reportData, reportType, res) {
    const { generateFinancialReportPDF } = await Promise.resolve().then(() => __importStar(require('../utils/financial-report-pdf')));
    generateFinancialReportPDF(reportData, reportType, res);
}
// Helper to generate Excel for reports
async function generateReportExcel(reportData, reportType, res) {
    const { generateFinancialReportExcel } = await Promise.resolve().then(() => __importStar(require('../utils/financial-report-excel')));
    await generateFinancialReportExcel(reportData, reportType, res);
}
// Trial Balance Export
router.get('/trial-balance/export', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const trialBalance = await financial_reporting_service_1.FinancialReportingService.generateTrialBalance(start, end);
        const totals = trialBalance.reduce((acc, entry) => ({
            totalDebits: acc.totalDebits + entry.debitTotal,
            totalCredits: acc.totalCredits + entry.creditTotal,
        }), { totalDebits: 0, totalCredits: 0 });
        const reportData = {
            entries: trialBalance,
            totals,
            isBalanced: Math.abs(totals.totalDebits - totals.totalCredits) < 0.01,
            period: { startDate: start, endDate: end },
        };
        if (format === 'excel') {
            await generateReportExcel(reportData, 'trial-balance', res);
        }
        else {
            await generateReportPDF(reportData, 'trial-balance', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export trial balance error:', error);
        res.status(500).json({
            error: 'Failed to export trial balance',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Balance Sheet Export
router.get('/balance-sheet/export', auth_1.authenticate, async (req, res) => {
    try {
        const { asOfDate, format = 'pdf' } = req.query;
        const asOf = asOfDate ? new Date(asOfDate) : undefined;
        const balanceSheet = await financial_reporting_service_1.FinancialReportingService.generateBalanceSheet(asOf);
        if (format === 'excel') {
            await generateReportExcel(balanceSheet, 'balance-sheet', res);
        }
        else {
            await generateReportPDF(balanceSheet, 'balance-sheet', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export balance sheet error:', error);
        res.status(500).json({
            error: 'Failed to export balance sheet',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Profit & Loss Export
router.get('/profit-loss/export', auth_1.authenticate, async (req, res) => {
    try {
        const { startDate, endDate, format = 'pdf' } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const profitLoss = await financial_reporting_service_1.FinancialReportingService.generateProfitAndLoss(start, end);
        if (format === 'excel') {
            await generateReportExcel(profitLoss, 'profit-loss', res);
        }
        else {
            await generateReportPDF(profitLoss, 'profit-loss', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export profit & loss error:', error);
        res.status(500).json({
            error: 'Failed to export profit & loss',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Property Profitability Export
router.get('/property-profitability/export', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyId, startDate, endDate, format = 'pdf' } = req.query;
        // Validate date inputs
        let start;
        let end;
        if (startDate) {
            start = new Date(startDate);
            if (Number.isNaN(start.getTime())) {
                return res.status(400).json({
                    error: 'Invalid start date format',
                    message: 'Start date must be a valid date string',
                });
            }
        }
        if (endDate) {
            end = new Date(endDate);
            if (Number.isNaN(end.getTime())) {
                return res.status(400).json({
                    error: 'Invalid end date format',
                    message: 'End date must be a valid date string',
                });
            }
        }
        // Validate date range
        if (start && end && start > end) {
            return res.status(400).json({
                error: 'Invalid date range',
                message: 'Start date must be before or equal to end date',
            });
        }
        // Validate property ID if provided
        if (propertyId && typeof propertyId !== 'string') {
            return res.status(400).json({
                error: 'Invalid property ID',
                message: 'Property ID must be a valid string',
            });
        }
        // Generate profitability report
        const profitability = await financial_reporting_service_1.FinancialReportingService.generatePropertyProfitability(propertyId, start, end);
        // Generate export (even if empty)
        if (format === 'excel') {
            await generateReportExcel(profitability, 'property-profitability', res);
        }
        else {
            await generateReportPDF(profitability, 'property-profitability', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export property profitability error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Check for specific error types
        if (errorMessage.includes('INVALID_PROPERTY_DIMENSION')) {
            return res.status(422).json({
                error: 'Invalid transactions: revenue/expense without property',
                message: 'Some transactions are missing property associations',
            });
        }
        res.status(500).json({
            error: 'Failed to export property profitability',
            message: errorMessage,
        });
    }
});
// Escrow Report Export
router.get('/escrow/export', auth_1.authenticate, async (req, res) => {
    try {
        const { format = 'pdf' } = req.query;
        const escrowReport = await financial_reporting_service_1.FinancialReportingService.generateEscrowReport();
        if (format === 'excel') {
            await generateReportExcel(escrowReport, 'escrow', res);
        }
        else {
            await generateReportPDF(escrowReport, 'escrow', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export escrow report error:', error);
        res.status(500).json({
            error: 'Failed to export escrow report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// Aging Report Export
router.get('/aging/export', auth_1.authenticate, async (req, res) => {
    try {
        const { type, asOfDate, format = 'pdf' } = req.query;
        if (!type || (type !== 'Receivable' && type !== 'Payable')) {
            return res.status(400).json({
                error: 'type parameter is required and must be "Receivable" or "Payable"',
            });
        }
        const asOf = asOfDate ? new Date(asOfDate) : undefined;
        const agingReport = await financial_reporting_service_1.FinancialReportingService.generateAgingReport(type, asOf);
        const totals = agingReport.reduce((acc, entry) => ({
            current: acc.current + entry.current,
            days31_60: acc.days31_60 + entry.days31_60,
            days61_90: acc.days61_90 + entry.days61_90,
            days91_plus: acc.days91_plus + entry.days91_plus,
            total: acc.total + entry.total,
        }), { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0, total: 0 });
        const reportData = {
            type,
            entries: agingReport,
            totals,
            asOfDate: asOf || new Date(),
        };
        if (format === 'excel') {
            await generateReportExcel(reportData, 'aging', res);
        }
        else {
            await generateReportPDF(reportData, 'aging', res);
        }
    }
    catch (error) {
        logger_1.default.error('Export aging report error:', error);
        res.status(500).json({
            error: 'Failed to export aging report',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=financial-reports.js.map