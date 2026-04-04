/**
 * Financial Report Excel Generator
 * Generates Excel reports for all financial report types
 */

import ExcelJS from 'exceljs';
import { Response } from 'express';
import logger from './logger';
import { FraudDetectionService } from '../services/fraud-detection-service';

export async function generateFinancialReportExcel(reportData: any, reportType: string, res: Response): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'REMS Financial System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(getReportTitle(reportType));

  // Generate report content based on type
  switch (reportType) {
    case 'trial-balance':
      await generateTrialBalanceExcel(worksheet, reportData);
      break;
    case 'balance-sheet':
      await generateBalanceSheetExcel(worksheet, reportData);
      break;
    case 'profit-loss':
      await generateProfitLossExcel(worksheet, reportData);
      break;
    case 'property-profitability':
      await generatePropertyProfitabilityExcel(worksheet, reportData);
      break;
    case 'escrow':
      await generateEscrowExcel(worksheet, reportData);
      break;
    case 'aging':
      await generateAgingExcel(worksheet, reportData);
      break;
    default:
      worksheet.addRow(['Unknown report type']);
  }

  // Add fraud detection sheet
  await addFraudDetectionSheet(workbook, reportData);

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
}

function getReportTitle(reportType: string): string {
  const titles: Record<string, string> = {
    'trial-balance': 'Trial Balance',
    'balance-sheet': 'Balance Sheet',
    'profit-loss': 'Profit & Loss',
    'property-profitability': 'Property Profitability',
    'escrow': 'Escrow Report',
    'aging': 'Aging Report',
  };
  return titles[reportType] || 'Financial Report';
}

function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '0.00';
  return Number(amount).toFixed(2);
}

async function generateTrialBalanceExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Header
  worksheet.addRow(['Trial Balance Report']);
  worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
  if (data.period?.startDate || data.period?.endDate) {
    worksheet.addRow([
      `Period: ${data.period.startDate ? new Date(data.period.startDate).toLocaleDateString() : ''} to ${data.period.endDate ? new Date(data.period.endDate).toLocaleDateString() : ''}`
    ]);
  }
  worksheet.addRow([]);

  // Table header
  const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit', 'Balance']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Data rows
  data.entries.forEach((entry: any) => {
    const row = worksheet.addRow([
      entry.accountCode,
      entry.accountName,
      entry.accountType,
      { formula: `=${formatCurrency(entry.debitTotal)}` },
      { formula: `=${formatCurrency(entry.creditTotal)}` },
      { formula: `=${formatCurrency(entry.balance)}` }
    ]);
  });

  // Totals row
  worksheet.addRow([]);
  const totalsRow = worksheet.addRow([
    'TOTALS',
    '',
    '',
    { formula: `=SUM(D5:D${worksheet.rowCount})` },
    { formula: `=SUM(E5:E${worksheet.rowCount})` },
    ''
  ]);
  totalsRow.font = { bold: true };

  // Balance status
  worksheet.addRow([]);
  if (data.isBalanced) {
    worksheet.addRow(['Status: ✓ Trial Balance is Balanced']).font = { color: { argb: 'FF008000' }, bold: true };
  } else {
    worksheet.addRow(['Status: ✗ Trial Balance Mismatch Detected!']).font = { color: { argb: 'FFFF0000' }, bold: true };
    const diff = Math.abs(data.totals.totalDebits - data.totals.totalCredits);
    worksheet.addRow([`Difference: ${formatCurrency(diff)}`]);
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 15;
  });
}

async function generateBalanceSheetExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Header
  worksheet.addRow(['Balance Sheet']);
  worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
  if (data.asOfDate) {
    worksheet.addRow([`As of: ${new Date(data.asOfDate).toLocaleDateString()}`]);
  }
  worksheet.addRow([]);

  // Assets section
  worksheet.addRow(['ASSETS']).font = { bold: true, size: 12 };
  worksheet.addRow(['Current Assets']).font = { bold: true };
  data.assets.current.forEach((entry: any) => {
    worksheet.addRow([entry.accountCode, entry.accountName, '', formatCurrency(entry.balance)]);
  });
  const currentAssetsTotal = data.assets.current.reduce((sum: number, e: any) => sum + e.balance, 0);
  worksheet.addRow(['Total Current Assets', '', '', formatCurrency(currentAssetsTotal)]).font = { bold: true };

  worksheet.addRow(['Fixed Assets']).font = { bold: true };
  data.assets.fixed.forEach((entry: any) => {
    worksheet.addRow([entry.accountCode, entry.accountName, '', formatCurrency(entry.balance)]);
  });
  const fixedAssetsTotal = data.assets.fixed.reduce((sum: number, e: any) => sum + e.balance, 0);
  worksheet.addRow(['Total Fixed Assets', '', '', formatCurrency(fixedAssetsTotal)]).font = { bold: true };
  const totalAssets = currentAssetsTotal + fixedAssetsTotal;
  worksheet.addRow(['TOTAL ASSETS', '', '', formatCurrency(totalAssets)]).font = { bold: true, size: 11 };
  worksheet.addRow([]);

  // Liabilities section
  worksheet.addRow(['LIABILITIES']).font = { bold: true, size: 12 };
  worksheet.addRow(['Current Liabilities']).font = { bold: true };
  data.liabilities.current.forEach((entry: any) => {
    worksheet.addRow([entry.accountCode, entry.accountName, '', formatCurrency(Math.abs(entry.balance))]);
  });
  const liabilitiesTotal = data.liabilities.current.reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0);
  worksheet.addRow(['Total Current Liabilities', '', '', formatCurrency(liabilitiesTotal)]).font = { bold: true };
  worksheet.addRow([]);

  // Equity section
  worksheet.addRow(['EQUITY']).font = { bold: true, size: 12 };
  let equityTotal = 0;
  ['capital', 'retainedEarnings', 'currentYearProfit'].forEach((section) => {
    if (data.equity[section] && data.equity[section].length > 0) {
      data.equity[section].forEach((entry: any) => {
        worksheet.addRow([entry.accountCode, entry.accountName, '', formatCurrency(Math.abs(entry.balance))]);
        equityTotal += Math.abs(entry.balance);
      });
    }
  });
  worksheet.addRow(['TOTAL EQUITY', '', '', formatCurrency(equityTotal)]).font = { bold: true };
  worksheet.addRow([]);

  // Validation
  const totalLiabilitiesEquity = liabilitiesTotal + equityTotal;
  worksheet.addRow(['TOTAL LIABILITIES + EQUITY', '', '', formatCurrency(totalLiabilitiesEquity)]).font = { bold: true, size: 11 };
  worksheet.addRow([]);

  if (data.isBalanced) {
    worksheet.addRow(['Status: ✓ Balance Sheet is Balanced']).font = { color: { argb: 'FF008000' }, bold: true };
  } else {
    worksheet.addRow(['Status: ✗ Balance Sheet Mismatch Detected!']).font = { color: { argb: 'FFFF0000' }, bold: true };
    const diff = Math.abs(totalAssets - totalLiabilitiesEquity);
    worksheet.addRow([`Difference: ${formatCurrency(diff)}`]);
  }

  worksheet.columns.forEach((column) => {
    column.width = 20;
  });
}

async function generateProfitLossExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Header
  worksheet.addRow(['Profit & Loss Statement']);
  worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
  if (data.period?.startDate || data.period?.endDate) {
    worksheet.addRow([
      `Period: ${data.period.startDate ? new Date(data.period.startDate).toLocaleDateString() : ''} to ${data.period.endDate ? new Date(data.period.endDate).toLocaleDateString() : ''}`
    ]);
  }
  worksheet.addRow([]);

  // Revenue section
  worksheet.addRow(['REVENUE']).font = { bold: true, size: 12 };
  let revenueTotal = 0;
  ['propertyRevenue', 'serviceIncome'].forEach((section) => {
    if (data.revenue[section] && data.revenue[section].length > 0) {
      data.revenue[section].forEach((entry: any) => {
        worksheet.addRow([entry.accountCode, entry.accountName, formatCurrency(entry.balance)]);
        revenueTotal += entry.balance;
      });
    }
  });
  worksheet.addRow(['TOTAL REVENUE', '', formatCurrency(revenueTotal)]).font = { bold: true, size: 11 };
  worksheet.addRow([]);

  // Expenses section
  worksheet.addRow(['EXPENSES']).font = { bold: true, size: 12 };
  let expensesTotal = 0;
  ['selling', 'property', 'administrative', 'tax'].forEach((section) => {
    if (data.expenses[section] && data.expenses[section].length > 0) {
      data.expenses[section].forEach((entry: any) => {
        worksheet.addRow([entry.accountCode, entry.accountName, formatCurrency(Math.abs(entry.balance))]);
        expensesTotal += Math.abs(entry.balance);
      });
    }
  });
  worksheet.addRow(['TOTAL EXPENSES', '', formatCurrency(expensesTotal)]).font = { bold: true, size: 11 };
  worksheet.addRow([]);

  // Net Profit
  const netProfit = revenueTotal - expensesTotal;
  worksheet.addRow(['NET PROFIT', '', formatCurrency(netProfit)]).font = { bold: true, size: 12, color: { argb: netProfit >= 0 ? 'FF008000' : 'FFFF0000' } };
  worksheet.addRow(['Profit Margin', '', `${((netProfit / revenueTotal) * 100).toFixed(2)}%`]);

  worksheet.columns.forEach((column) => {
    column.width = 20;
  });
}

async function generatePropertyProfitabilityExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Handle array of PropertyProfitability objects
  const profitabilityData = Array.isArray(data) ? data : [data];
  
  if (profitabilityData.length === 0) {
    worksheet.addRow(['No property profitability data available.']);
    return;
  }

  // Process each property
  profitabilityData.forEach((property: any, index: number) => {
    // Add spacing between properties (except first)
    if (index > 0) {
      worksheet.addRow([]);
      worksheet.addRow([]);
    }

    // Property header
    worksheet.addRow([property.propertyName || property.propertyId || 'Property Profitability']).font = { bold: true, size: 14 };
    worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
    
    if (property.propertyCode) {
      worksheet.addRow([`Property Code: ${property.propertyCode}`]);
    }
    
    if (data.period?.startDate || data.period?.endDate) {
      worksheet.addRow([
        `Period: ${data.period.startDate ? new Date(data.period.startDate).toLocaleDateString() : ''} to ${data.period.endDate ? new Date(data.period.endDate).toLocaleDateString() : ''}`
      ]);
    }
    worksheet.addRow([]);

    // Revenue
    worksheet.addRow(['REVENUE']).font = { bold: true, size: 12 };
    
    const revenueBreakdown = Array.isArray(property.revenueBreakdown) ? property.revenueBreakdown : [];
    if (revenueBreakdown.length > 0) {
      revenueBreakdown.forEach((entry: any) => {
        if (entry && entry.accountCode && entry.accountName) {
          const amount = typeof entry.amount === 'number' ? entry.amount : 0;
          worksheet.addRow([entry.accountCode, entry.accountName, formatCurrency(amount)]);
        }
      });
    } else {
      worksheet.addRow(['No revenue entries']);
    }
    
    const revenueTotal = typeof property.revenue === 'number' ? property.revenue : 0;
    worksheet.addRow(['Total Revenue', '', formatCurrency(revenueTotal)]).font = { bold: true };
    worksheet.addRow([]);

    // Expenses
    worksheet.addRow(['EXPENSES']).font = { bold: true, size: 12 };
    
    const expenseBreakdown = Array.isArray(property.expenseBreakdown) ? property.expenseBreakdown : [];
    if (expenseBreakdown.length > 0) {
      expenseBreakdown.forEach((entry: any) => {
        if (entry && entry.accountCode && entry.accountName) {
          const amount = typeof entry.amount === 'number' ? Math.abs(entry.amount) : 0;
          worksheet.addRow([entry.accountCode, entry.accountName, formatCurrency(amount)]);
        }
      });
    } else {
      worksheet.addRow(['No expense entries']);
    }
    
    const expensesTotal = typeof property.expenses === 'number' ? property.expenses : 0;
    worksheet.addRow(['Total Expenses', '', formatCurrency(expensesTotal)]).font = { bold: true };
    worksheet.addRow([]);

    // Net Profit - use calculated value from service or calculate if missing
    const netProfit = typeof property.netProfit === 'number' 
      ? property.netProfit 
      : revenueTotal - expensesTotal;
    
    worksheet.addRow(['Net Profit', '', formatCurrency(netProfit)]).font = { 
      bold: true, 
      size: 12, 
      color: { argb: netProfit >= 0 ? 'FF008000' : 'FFFF0000' } 
    };
    
    // Profit Margin - use calculated value from service or calculate if missing
    const profitMargin = typeof property.profitMargin === 'number'
      ? property.profitMargin
      : revenueTotal > 0 
        ? ((netProfit / revenueTotal) * 100)
        : (revenueTotal === 0 && expensesTotal > 0 ? -100 : 0);
    
    const marginText = typeof profitMargin === 'number' && !Number.isNaN(profitMargin)
      ? profitMargin.toFixed(2)
      : '0.00';
    worksheet.addRow(['Profit Margin', '', `${marginText}%`]);
  });

  worksheet.columns.forEach((column) => {
    column.width = 20;
  });
}

async function generateEscrowExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Header
  worksheet.addRow(['Escrow Balance Report']);
  worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
  worksheet.addRow([]);

  // Trust Assets
  worksheet.addRow(['TRUST ASSETS']).font = { bold: true, size: 12 };
  data.trustAssets.forEach((asset: any) => {
    worksheet.addRow([asset.accountCode, asset.accountName, formatCurrency(asset.balance)]);
  });
  worksheet.addRow(['Total Trust Assets', '', formatCurrency(data.totalTrustAssets)]).font = { bold: true };
  worksheet.addRow([]);

  // Client Liabilities
  worksheet.addRow(['CLIENT LIABILITIES']).font = { bold: true, size: 12 };
  data.clientLiabilities.forEach((liability: any) => {
    worksheet.addRow([liability.accountCode, liability.accountName, formatCurrency(liability.balance)]);
  });
  worksheet.addRow(['Total Client Liabilities', '', formatCurrency(data.totalClientLiabilities)]).font = { bold: true };
  worksheet.addRow([]);

  // Validation
  if (data.isBalanced) {
    worksheet.addRow(['Status: ✓ Escrow is Balanced']).font = { color: { argb: 'FF008000' }, bold: true };
  } else {
    worksheet.addRow(['Status: ✗ Escrow Mismatch Detected!']).font = { color: { argb: 'FFFF0000' }, bold: true };
    worksheet.addRow([`Difference: ${formatCurrency(Math.abs(data.difference))}`]);
    worksheet.addRow([]);
    worksheet.addRow(['Violations:']).font = { bold: true };
    data.violations.forEach((violation: string) => {
      worksheet.addRow([violation]);
    });
  }

  worksheet.columns.forEach((column) => {
    column.width = 25;
  });
}

async function generateAgingExcel(worksheet: ExcelJS.Worksheet, data: any): Promise<void> {
  // Header
  worksheet.addRow(['Aging Report']);
  worksheet.addRow([`Type: ${data.type}`]);
  worksheet.addRow([`As of: ${new Date(data.asOfDate).toLocaleDateString()}`]);
  worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
  worksheet.addRow([]);

  // Table header
  const headerRow = worksheet.addRow(['Account Code', 'Account Name', 'Current (0-30)', '31-60 Days', '61-90 Days', '91+ Days', 'Total']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Data rows
  data.entries.forEach((entry: any) => {
    worksheet.addRow([
      entry.accountCode,
      entry.accountName,
      formatCurrency(entry.current),
      formatCurrency(entry.days31_60),
      formatCurrency(entry.days61_90),
      formatCurrency(entry.days91_plus),
      formatCurrency(entry.total)
    ]);
  });

  // Totals row
  worksheet.addRow([]);
  const totalsRow = worksheet.addRow([
    'TOTALS',
    '',
    formatCurrency(data.totals.current),
    formatCurrency(data.totals.days31_60),
    formatCurrency(data.totals.days61_90),
    formatCurrency(data.totals.days91_plus),
    formatCurrency(data.totals.total)
  ]);
  totalsRow.font = { bold: true };

  worksheet.columns.forEach((column) => {
    column.width = 15;
  });
}

async function addFraudDetectionSheet(workbook: ExcelJS.Workbook, reportData: any): Promise<void> {
  try {
    const startDate = reportData.period?.startDate || reportData.asOfDate;
    const endDate = reportData.period?.endDate || reportData.asOfDate || new Date();

    if (!startDate) return;

    const redFlags = await FraudDetectionService.generateRedFlagsReport(
      startDate instanceof Date ? startDate : new Date(startDate),
      endDate instanceof Date ? endDate : new Date(endDate)
    );

    if (redFlags.length === 0) return;

    const worksheet = workbook.addWorksheet('Fraud Detection & Red Flags');

    // Header
    worksheet.addRow(['Fraud Detection & Red Flags Report']);
    worksheet.addRow([`Generated on: ${new Date().toLocaleString()}`]);
    worksheet.addRow([`Total Red Flags: ${redFlags.length}`]);
    worksheet.addRow([]);

    // Table header
    const headerRow = worksheet.addRow(['Type', 'Severity', 'Description', 'Date', 'Amount', 'Transaction ID']);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    redFlags.forEach((flag) => {
      const row = worksheet.addRow([
        flag.type,
        flag.severity,
        flag.description,
        new Date(flag.date).toLocaleDateString(),
        formatCurrency(flag.amount),
        flag.transactionId
      ]);

      // Color code by severity
      const color = flag.severity === 'High' ? 'FFFF0000' : flag.severity === 'Medium' ? 'FFFFA500' : 'FF000000';
      row.getCell(2).font = { color: { argb: color }, bold: true };
    });

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });
  } catch (error) {
    logger.warn('Failed to add fraud detection sheet:', error);
  }
}

