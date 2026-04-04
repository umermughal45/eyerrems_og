/**
 * Financial Report PDF Generator
 * Generates PDF reports for all financial report types
 */

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import logger from './logger';
import { FraudDetectionService } from '../services/fraud-detection-service';

export function generateFinancialReportPDF(reportData: any, reportType: string, res: Response): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  const formatCurrency = (amount?: number | null): string => {
    if (amount === undefined || amount === null || Number.isNaN(amount)) return 'Rs 0.00';
    return `Rs ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (value?: string | Date | null): string => {
    if (!value) return 'N/A';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(getReportTitle(reportType), { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(1);

  // Generate report content based on type
  switch (reportType) {
    case 'trial-balance':
      generateTrialBalancePDF(doc, reportData, formatCurrency, formatDate);
      break;
    case 'balance-sheet':
      generateBalanceSheetPDF(doc, reportData, formatCurrency, formatDate);
      break;
    case 'profit-loss':
      generateProfitLossPDF(doc, reportData, formatCurrency, formatDate);
      break;
    case 'property-profitability':
      generatePropertyProfitabilityPDF(doc, reportData, formatCurrency, formatDate);
      break;
    case 'escrow':
      generateEscrowPDF(doc, reportData, formatCurrency, formatDate);
      break;
    case 'aging':
      generateAgingPDF(doc, reportData, formatCurrency, formatDate);
      break;
    default:
      doc.text('Unknown report type', { align: 'center' });
  }

  // Add fraud detection section if applicable
  addFraudDetectionSection(doc, reportData, formatDate);

  // Footer
  doc.fontSize(8).font('Helvetica').text(
    'This is a computer-generated report. For official use only.',
    { align: 'center' }
  );

  doc.end();
}

function getReportTitle(reportType: string): string {
  const titles: Record<string, string> = {
    'trial-balance': 'Trial Balance Report',
    'balance-sheet': 'Balance Sheet',
    'profit-loss': 'Profit & Loss Statement',
    'property-profitability': 'Property Profitability Report',
    'escrow': 'Escrow Balance Report',
    'aging': 'Aging Report',
  };
  return titles[reportType] || 'Financial Report';
}

function generateTrialBalancePDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  if (data.period?.startDate || data.period?.endDate) {
    doc.fontSize(10).font('Helvetica');
    if (data.period.startDate) doc.text(`From: ${formatDate(data.period.startDate)}`);
    if (data.period.endDate) doc.text(`To: ${formatDate(data.period.endDate)}`);
    doc.moveDown(0.5);
  }

  // Table header
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Account Code', 50, doc.y);
  doc.text('Account Name', 120, doc.y);
  doc.text('Debit', 350, doc.y, { align: 'right' });
  doc.text('Credit', 450, doc.y, { align: 'right' });
  doc.text('Balance', 550, doc.y, { align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.fontSize(9).font('Helvetica');
  data.entries.forEach((entry: any) => {
    if (doc.y > 700) {
      doc.addPage();
      // Repeat header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Account Code', 50, 50);
      doc.text('Account Name', 120, 50);
      doc.text('Debit', 350, 50, { align: 'right' });
      doc.text('Credit', 450, 50, { align: 'right' });
      doc.text('Balance', 550, 50, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');
    }

    doc.text(entry.accountCode || '', 50, doc.y);
    doc.text(entry.accountName || '', 120, doc.y, { width: 220 });
    doc.text(formatCurrency(entry.debitTotal), 350, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.creditTotal), 450, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.balance), 550, doc.y, { align: 'right' });
    doc.moveDown(0.4);
  });

  // Totals
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Totals:', 50, doc.y);
  doc.text(formatCurrency(data.totals.totalDebits), 350, doc.y, { align: 'right' });
  doc.text(formatCurrency(data.totals.totalCredits), 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  // Balance status
  if (data.isBalanced) {
    doc.fontSize(10).font('Helvetica').fillColor('green');
    doc.text('✓ Trial Balance is Balanced', 50, doc.y);
  } else {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('red');
    doc.text('✗ Trial Balance Mismatch Detected!', 50, doc.y);
    doc.text(`Difference: ${formatCurrency(Math.abs(data.totals.totalDebits - data.totals.totalCredits))}`, 50, doc.y + 15);
  }
  doc.fillColor('black');
}

function generateBalanceSheetPDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  if (data.asOfDate) {
    doc.fontSize(10).font('Helvetica');
    doc.text(`As of: ${formatDate(data.asOfDate)}`);
    doc.moveDown(0.5);
  }

  // Assets
  doc.fontSize(12).font('Helvetica-Bold').text('ASSETS', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text('Current Assets:', 50, doc.y);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica');
  let currentAssetsTotal = 0;
  data.assets.current.forEach((entry: any) => {
    doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
    doc.text(formatCurrency(entry.balance), 450, doc.y, { align: 'right' });
    currentAssetsTotal += entry.balance;
    doc.moveDown(0.3);
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Total Current Assets:', 50, doc.y);
  doc.text(formatCurrency(currentAssetsTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  // Fixed Assets
  doc.fontSize(10).font('Helvetica-Bold').text('Fixed Assets:', 50, doc.y);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica');
  let fixedAssetsTotal = 0;
  data.assets.fixed.forEach((entry: any) => {
    doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
    doc.text(formatCurrency(entry.balance), 450, doc.y, { align: 'right' });
    fixedAssetsTotal += entry.balance;
    doc.moveDown(0.3);
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Total Fixed Assets:', 50, doc.y);
  doc.text(formatCurrency(fixedAssetsTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  const totalAssets = currentAssetsTotal + fixedAssetsTotal;
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL ASSETS:', 50, doc.y);
  doc.text(formatCurrency(totalAssets), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Liabilities
  doc.fontSize(12).font('Helvetica-Bold').text('LIABILITIES', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text('Current Liabilities:', 50, doc.y);
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica');
  let liabilitiesTotal = 0;
  data.liabilities.current.forEach((entry: any) => {
    doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
    doc.text(formatCurrency(Math.abs(entry.balance)), 450, doc.y, { align: 'right' });
    liabilitiesTotal += Math.abs(entry.balance);
    doc.moveDown(0.3);
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Total Current Liabilities:', 50, doc.y);
  doc.text(formatCurrency(liabilitiesTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Equity
  doc.fontSize(12).font('Helvetica-Bold').text('EQUITY', 50, doc.y);
  doc.moveDown(0.3);
  let equityTotal = 0;
  ['capital', 'retainedEarnings', 'currentYearProfit'].forEach((section) => {
    if (data.equity[section] && data.equity[section].length > 0) {
      doc.fontSize(9).font('Helvetica');
      data.equity[section].forEach((entry: any) => {
        doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
        doc.text(formatCurrency(Math.abs(entry.balance)), 450, doc.y, { align: 'right' });
        equityTotal += Math.abs(entry.balance);
        doc.moveDown(0.3);
      });
    }
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('TOTAL EQUITY:', 50, doc.y);
  doc.text(formatCurrency(equityTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Validation
  const totalLiabilitiesEquity = liabilitiesTotal + equityTotal;
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL LIABILITIES + EQUITY:', 50, doc.y);
  doc.text(formatCurrency(totalLiabilitiesEquity), 450, doc.y, { align: 'right' });
  doc.moveDown(0.5);

  if (data.isBalanced) {
    doc.fontSize(10).font('Helvetica').fillColor('green');
    doc.text('✓ Balance Sheet is Balanced (Assets = Liabilities + Equity)', 50, doc.y);
  } else {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('red');
    doc.text('✗ Balance Sheet Mismatch Detected!', 50, doc.y);
    doc.text(`Difference: ${formatCurrency(Math.abs(totalAssets - totalLiabilitiesEquity))}`, 50, doc.y + 15);
  }
  doc.fillColor('black');
}

function generateProfitLossPDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  if (data.period?.startDate || data.period?.endDate) {
    doc.fontSize(10).font('Helvetica');
    doc.text(`Period: ${formatDate(data.period.startDate)} to ${formatDate(data.period.endDate)}`);
    doc.moveDown(0.5);
  }

  // Revenue
  doc.fontSize(12).font('Helvetica-Bold').text('REVENUE', 50, doc.y);
  doc.moveDown(0.3);
  let revenueTotal = 0;
  ['propertyRevenue', 'serviceIncome'].forEach((section) => {
    if (data.revenue[section] && data.revenue[section].length > 0) {
      doc.fontSize(9).font('Helvetica');
      data.revenue[section].forEach((entry: any) => {
        doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
        doc.text(formatCurrency(entry.balance), 450, doc.y, { align: 'right' });
        revenueTotal += entry.balance;
        doc.moveDown(0.3);
      });
    }
  });
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL REVENUE:', 50, doc.y);
  doc.text(formatCurrency(revenueTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Expenses
  doc.fontSize(12).font('Helvetica-Bold').text('EXPENSES', 50, doc.y);
  doc.moveDown(0.3);
  let expensesTotal = 0;
  ['selling', 'property', 'administrative', 'tax'].forEach((section) => {
    if (data.expenses[section] && data.expenses[section].length > 0) {
      doc.fontSize(9).font('Helvetica');
      data.expenses[section].forEach((entry: any) => {
        doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
        doc.text(formatCurrency(Math.abs(entry.balance)), 450, doc.y, { align: 'right' });
        expensesTotal += Math.abs(entry.balance);
        doc.moveDown(0.3);
      });
    }
  });
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL EXPENSES:', 50, doc.y);
  doc.text(formatCurrency(expensesTotal), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Net Profit
  const netProfit = revenueTotal - expensesTotal;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('NET PROFIT:', 50, doc.y);
  doc.fillColor(netProfit >= 0 ? 'green' : 'red');
  doc.text(formatCurrency(netProfit), 450, doc.y, { align: 'right' });
  doc.fillColor('black');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Profit Margin: ${((netProfit / revenueTotal) * 100).toFixed(2)}%`, 50, doc.y);
}

function generatePropertyProfitabilityPDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  // Handle array of PropertyProfitability objects
  const profitabilityData = Array.isArray(data) ? data : [data];
  
  if (profitabilityData.length === 0) {
    doc.fontSize(12).font('Helvetica').text('No property profitability data available.', { align: 'center' });
    return;
  }

  // Process each property
  profitabilityData.forEach((property: any, index: number) => {
    // Add page break for multiple properties (except first)
    if (index > 0) {
      doc.addPage();
    }

    // Property header
    doc.fontSize(14).font('Helvetica-Bold').text(
      property.propertyName || property.propertyId || 'Property Profitability',
      { align: 'center' }
    );
    doc.moveDown(0.3);
    
    if (property.propertyCode) {
      doc.fontSize(10).font('Helvetica').text(`Property Code: ${property.propertyCode}`, { align: 'center' });
      doc.moveDown(0.3);
    }

    if (data.period?.startDate || data.period?.endDate) {
      doc.fontSize(10).font('Helvetica');
      doc.text(`Period: ${formatDate(data.period.startDate)} to ${formatDate(data.period.endDate)}`);
      doc.moveDown(0.5);
    }

    // Validate and safely access revenue breakdown
    const revenueBreakdown = Array.isArray(property.revenueBreakdown) ? property.revenueBreakdown : [];
    const expenseBreakdown = Array.isArray(property.expenseBreakdown) ? property.expenseBreakdown : [];
    
    // Revenue
    doc.fontSize(11).font('Helvetica-Bold').text('REVENUE', 50, doc.y);
    doc.moveDown(0.3);
    
    if (revenueBreakdown.length > 0) {
      revenueBreakdown.forEach((entry: any) => {
        if (entry && entry.accountCode && entry.accountName) {
          doc.fontSize(9).font('Helvetica');
          const amount = typeof entry.amount === 'number' ? entry.amount : 0;
          doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
          doc.text(formatCurrency(amount), 450, doc.y, { align: 'right' });
          doc.moveDown(0.3);
        }
      });
    } else {
      doc.fontSize(9).font('Helvetica').text('No revenue entries', 70, doc.y);
      doc.moveDown(0.3);
    }
    
    const revenueTotal = typeof property.revenue === 'number' ? property.revenue : 0;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total Revenue:', 50, doc.y);
    doc.text(formatCurrency(revenueTotal), 450, doc.y, { align: 'right' });
    doc.moveDown(1);

    // Expenses
    doc.fontSize(11).font('Helvetica-Bold').text('EXPENSES', 50, doc.y);
    doc.moveDown(0.3);
    
    if (expenseBreakdown.length > 0) {
      expenseBreakdown.forEach((entry: any) => {
        if (entry && entry.accountCode && entry.accountName) {
          doc.fontSize(9).font('Helvetica');
          const amount = typeof entry.amount === 'number' ? Math.abs(entry.amount) : 0;
          doc.text(`${entry.accountCode} - ${entry.accountName}`, 70, doc.y);
          doc.text(formatCurrency(amount), 450, doc.y, { align: 'right' });
          doc.moveDown(0.3);
        }
      });
    } else {
      doc.fontSize(9).font('Helvetica').text('No expense entries', 70, doc.y);
      doc.moveDown(0.3);
    }
    
    const expensesTotal = typeof property.expenses === 'number' ? property.expenses : 0;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total Expenses:', 50, doc.y);
    doc.text(formatCurrency(expensesTotal), 450, doc.y, { align: 'right' });
    doc.moveDown(1);

    // Net Profit - use calculated value from service or calculate if missing
    const netProfit = typeof property.netProfit === 'number' 
      ? property.netProfit 
      : revenueTotal - expensesTotal;
    
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Net Profit:', 50, doc.y);
    doc.fillColor(netProfit >= 0 ? 'green' : 'red');
    doc.text(formatCurrency(netProfit), 450, doc.y, { align: 'right' });
    doc.fillColor('black');
    doc.moveDown(0.5);
    
    // Profit Margin - use calculated value from service or calculate if missing
    const profitMargin = typeof property.profitMargin === 'number'
      ? property.profitMargin
      : revenueTotal > 0 
        ? ((netProfit / revenueTotal) * 100)
        : (revenueTotal === 0 && expensesTotal > 0 ? -100 : 0);
    
    doc.fontSize(10).font('Helvetica');
    const marginText = typeof profitMargin === 'number' && !Number.isNaN(profitMargin)
      ? profitMargin.toFixed(2)
      : '0.00';
    doc.text(`Profit Margin: ${marginText}%`, 50, doc.y);
    doc.moveDown(1);
  });
}

function generateEscrowPDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  // Trust Assets
  doc.fontSize(11).font('Helvetica-Bold').text('TRUST ASSETS', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica');
  data.trustAssets.forEach((asset: any) => {
    doc.text(`${asset.accountCode} - ${asset.accountName}`, 70, doc.y);
    doc.text(formatCurrency(asset.balance), 450, doc.y, { align: 'right' });
    doc.moveDown(0.3);
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Total Trust Assets:', 50, doc.y);
  doc.text(formatCurrency(data.totalTrustAssets), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Client Liabilities
  doc.fontSize(11).font('Helvetica-Bold').text('CLIENT LIABILITIES', 50, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica');
  data.clientLiabilities.forEach((liability: any) => {
    doc.text(`${liability.accountCode} - ${liability.accountName}`, 70, doc.y);
    doc.text(formatCurrency(liability.balance), 450, doc.y, { align: 'right' });
    doc.moveDown(0.3);
  });
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Total Client Liabilities:', 50, doc.y);
  doc.text(formatCurrency(data.totalClientLiabilities), 450, doc.y, { align: 'right' });
  doc.moveDown(1);

  // Validation
  if (data.isBalanced) {
    doc.fontSize(10).font('Helvetica').fillColor('green');
    doc.text('✓ Escrow is Balanced (Trust Assets = Client Liabilities)', 50, doc.y);
  } else {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('red');
    doc.text('✗ Escrow Mismatch Detected!', 50, doc.y);
    doc.text(`Difference: ${formatCurrency(Math.abs(data.difference))}`, 50, doc.y + 15);
    doc.moveDown(0.5);
    doc.text('Violations:', 50, doc.y);
    doc.fontSize(9).font('Helvetica');
    data.violations.forEach((violation: string) => {
      doc.text(`• ${violation}`, 70, doc.y);
      doc.moveDown(0.3);
    });
  }
  doc.fillColor('black');
}

function generateAgingPDF(doc: PDFKit.PDFDocument, data: any, formatCurrency: (n: any) => string, formatDate: (d: any) => string): void {
  doc.fontSize(10).font('Helvetica');
  doc.text(`Report Type: ${data.type}`);
  doc.text(`As of: ${formatDate(data.asOfDate)}`);
  doc.moveDown(0.5);

  // Table header
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Account', 50, doc.y);
  doc.text('Current', 200, doc.y, { align: 'right' });
  doc.text('31-60 Days', 280, doc.y, { align: 'right' });
  doc.text('61-90 Days', 360, doc.y, { align: 'right' });
  doc.text('91+ Days', 440, doc.y, { align: 'right' });
  doc.text('Total', 520, doc.y, { align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.fontSize(9).font('Helvetica');
  data.entries.forEach((entry: any) => {
    if (doc.y > 700) {
      doc.addPage();
      // Repeat header
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Account', 50, 50);
      doc.text('Current', 200, 50, { align: 'right' });
      doc.text('31-60 Days', 280, 50, { align: 'right' });
      doc.text('61-90 Days', 360, 50, { align: 'right' });
      doc.text('91+ Days', 440, 50, { align: 'right' });
      doc.text('Total', 520, 50, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica');
    }

    doc.text(`${entry.accountCode} - ${entry.accountName}`, 50, doc.y, { width: 140 });
    doc.text(formatCurrency(entry.current), 200, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.days31_60), 280, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.days61_90), 360, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.days91_plus), 440, doc.y, { align: 'right' });
    doc.text(formatCurrency(entry.total), 520, doc.y, { align: 'right' });
    doc.moveDown(0.4);
  });

  // Totals
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(520, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Totals:', 50, doc.y);
  doc.text(formatCurrency(data.totals.current), 200, doc.y, { align: 'right' });
  doc.text(formatCurrency(data.totals.days31_60), 280, doc.y, { align: 'right' });
  doc.text(formatCurrency(data.totals.days61_90), 360, doc.y, { align: 'right' });
  doc.text(formatCurrency(data.totals.days91_plus), 440, doc.y, { align: 'right' });
  doc.text(formatCurrency(data.totals.total), 520, doc.y, { align: 'right' });
}

async function addFraudDetectionSection(doc: PDFKit.PDFDocument, reportData: any, formatDate: (d: any) => string): Promise<void> {
  try {
    // Get date range from report data
    const startDate = reportData.period?.startDate || reportData.asOfDate;
    const endDate = reportData.period?.endDate || reportData.asOfDate || new Date();

    // If no date available, use last 30 days
    if (!startDate) {
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      const redFlags = await FraudDetectionService.generateRedFlagsReport(defaultStart, new Date());
      if (redFlags.length === 0) return;
      
      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('FRAUD DETECTION & RED FLAGS', 50, doc.y);
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Red Flags Detected: ${redFlags.length}`, 50, doc.y);
      doc.moveDown(0.5);

      redFlags.forEach((flag) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        const color = flag.severity === 'High' ? 'red' : flag.severity === 'Medium' ? 'orange' : 'black';
        doc.fontSize(10).font('Helvetica-Bold').fillColor(color);
        doc.text(`${flag.type} (${flag.severity})`, 70, doc.y);
        doc.fontSize(9).font('Helvetica').fillColor('black');
        doc.text(flag.description, 70, doc.y + 15, { width: 450 });
        doc.text(`Date: ${formatDate(flag.date)} | Amount: Rs ${flag.amount.toLocaleString()}`, 70, doc.y + 30);
        doc.moveDown(1);
      });
    } else {
      const redFlags = await FraudDetectionService.generateRedFlagsReport(
        startDate instanceof Date ? startDate : new Date(startDate),
        endDate instanceof Date ? endDate : new Date(endDate)
      );

      if (redFlags.length === 0) return;

      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('FRAUD DETECTION & RED FLAGS', 50, doc.y);
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Red Flags Detected: ${redFlags.length}`, 50, doc.y);
      doc.moveDown(0.5);

      redFlags.forEach((flag) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        const color = flag.severity === 'High' ? 'red' : flag.severity === 'Medium' ? 'orange' : 'black';
        doc.fontSize(10).font('Helvetica-Bold').fillColor(color);
        doc.text(`${flag.type} (${flag.severity})`, 70, doc.y);
        doc.fontSize(9).font('Helvetica').fillColor('black');
        doc.text(flag.description, 70, doc.y + 15, { width: 450 });
        doc.text(`Date: ${formatDate(flag.date)} | Amount: Rs ${flag.amount.toLocaleString()}`, 70, doc.y + 30);
        doc.moveDown(1);
      });
    }


  } catch (error) {
    logger.warn('Failed to add fraud detection section:', error);
  }
}

