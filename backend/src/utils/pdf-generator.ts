/**
 * PDF Generator Utility
 * Generates PDF reports for various entities
 */

import PDFDocument from 'pdfkit';
import { Response } from 'express';
import logger from './logger';
import fs from 'fs';
import path from 'path';

export interface PaymentPlanPDFData {
  deal: {
    dealCode?: string;
    title: string;
    dealAmount: number;
    client?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    dealer?: {
      name?: string;
    };
    property?: {
      name?: string;
      propertyCode?: string;
    };
  };
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    progress: number;
    status: string;
    downPayment?: number; // Down payment amount
    downPaymentPaid?: number; // Down payment actually paid
  };
  installments: Array<{
    installmentNumber: number;
    amount: number;
    dueDate: string | Date;
    paidAmount?: number;
    status?: string;
    paymentMode?: string;
    notes?: string;
  }>;
  generatedAt?: Date;
}

/**
 * Generate Payment Plan PDF - Clean professional report (matches property report style)
 */
export function generatePaymentPlanPDF(data: PaymentPlanPDFData, res: Response): void {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-generator.ts:50',message:'PDF generator entry',data:{hasDeal:!!data.deal,hasSummary:!!data.summary,installmentsCount:data.installments?.length||0,headersSent:res.headersSent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payment-plan-${data.deal.dealCode || 'report'}-${new Date().toISOString().split('T')[0]}.pdf"`
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-generator.ts:58',message:'After setting headers',data:{headersSent:res.headersSent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // Pipe PDF to response
    doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const pageMargin = 50;
  
  // Track pages that have footer added to prevent duplicates
  const footerAddedToPages = new Set<number>();
  
  // Footer function to add on all pages
  // Uses absolute positioning to avoid triggering page creation
  const addFooter = () => {
    // Check if footer already added to current page
    // Use type assertion for internal PDFKit properties
    const currentPage = (doc.page as any).pageNumber || 0;
    if (footerAddedToPages.has(currentPage)) {
      return;
    }
    
    try {
      // Check if stream is still writable
      // Use type assertion for internal stream properties
      const writableState = (doc as any)._writableState;
      const readableState = (doc as any)._readableState;
      if (writableState?.ended || readableState?.ended) {
        return;
      }
      
      footerAddedToPages.add(currentPage);
      
      // Use absolute positioning to avoid triggering page creation
      const footerY = pageHeight - 30;
      const savedY = doc.y;
      const savedX = doc.x;
      
      doc.fontSize(8).font('Helvetica');
      doc.fillColor('#666666');
      
      // Use absolute positioning with explicit width to prevent overflow
      // This ensures text won't trigger page creation
      doc.text(
        'This is a computer-generated document. No signature required. | Real Estate Management System',
        pageWidth / 2,
        footerY,
        { align: 'center', width: pageWidth - 100 }
      );
      
      // Restore position
      doc.x = savedX;
      doc.y = savedY;
    } catch (error) {
      // Silently fail if footer can't be added (stream might be ending)
      // Don't throw to avoid breaking PDF generation
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    try {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        return 'Rs 0';
      }
      return `Rs ${numAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    } catch (error) {
      return 'Rs 0';
    }
  };

  // Helper function to format date
  const formatDate = (date: string | Date): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!(d instanceof Date) || isNaN(d.getTime())) {
        return 'N/A';
      }
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // ============ HEADER SECTION ============
  doc.fontSize(20).font('Helvetica-Bold').text('Payment Plan Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(1);

  // ============ DEAL INFORMATION ============
  doc.fontSize(14).font('Helvetica-Bold').text('Deal Information', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Deal Code: ${data.deal.dealCode || 'N/A'}`);
  doc.text(`Title: ${data.deal.title}`);
  doc.text(`Deal Amount: ${formatCurrency(data.deal.dealAmount)}`);
  
  if (data.deal.property) {
    doc.text(`Property: ${data.deal.property.name || 'N/A'}`);
    if (data.deal.property.propertyCode) doc.text(`Property Code: ${data.deal.property.propertyCode}`);
  }
  
  if (data.deal.dealer) {
    doc.text(`Dealer: ${data.deal.dealer.name || 'N/A'}`);
  }
  
  if (data.deal.client) {
    doc.text(`Client: ${data.deal.client.name || 'N/A'}`);
    if (data.deal.client.phone) doc.text(`Phone: ${data.deal.client.phone}`);
    if (data.deal.client.email) doc.text(`Email: ${data.deal.client.email}`);
  }
  
  doc.moveDown(0.6);

  // ============ PAYMENT SUMMARY ============
  doc.fontSize(14).font('Helvetica-Bold').text('Payment Summary', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  const downPayment = data.summary.downPayment || 0;
  doc.text(`Total Amount: ${formatCurrency(data.summary.totalAmount)}`);
  if (downPayment > 0) {
    doc.text(`Down Payment: ${formatCurrency(downPayment)}`);
  }
  doc.text(`Paid Amount: ${formatCurrency(data.summary.paidAmount)}`);
  doc.text(`Remaining Amount: ${formatCurrency(data.summary.remainingAmount)}`);
  doc.text(`Status: ${data.summary.status || 'Pending'}`);
  doc.moveDown(0.6);

  // ============ INSTALLMENT SCHEDULE ============
  if (data.installments && data.installments.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Installment Schedule', { underline: true });
    doc.moveDown(0.3);
    
    // Table header
    const tableStartY = doc.y;
    const col1 = 50;
    const col2 = col1 + 50;
    const col3 = col2 + 100;
    const col4 = col3 + 100;
    const col5 = col4 + 100;
    const col6 = col5 + 100;
    
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('No.', col1, tableStartY);
    doc.text('Due Date', col2, tableStartY);
    doc.text('Amount', col3, tableStartY, { width: 90, align: 'right' });
    doc.text('Paid', col4, tableStartY, { width: 90, align: 'right' });
    doc.text('Balance', col5, tableStartY, { width: 90, align: 'right' });
    doc.text('Status', col6, tableStartY);
    
    doc.moveTo(col1, tableStartY + 12).lineTo(550, tableStartY + 12).stroke();
    doc.fontSize(9).font('Helvetica');
    
    let currentY = tableStartY + 20;
    const rowHeight = 16;
    
    // Down Payment row
    if (downPayment > 0) {
      if (currentY > 720) {
        // Add footer to current page before adding new page
        const currentPage = (doc.page as any).pageNumber || 0;
        if (!footerAddedToPages.has(currentPage)) {
          addFooter();
        }
        doc.addPage();
        currentY = 50;
      }
      
      const dpStatus = data.summary.downPaymentPaid && data.summary.downPaymentPaid >= downPayment ? 'Paid' : 'Pending';
      const dpPaid = data.summary.downPaymentPaid || 0;
      const dpRemaining = Math.max(0, downPayment - dpPaid);
      
      doc.fillColor('#000000');
      doc.text('DP', col1, currentY);
      doc.text('Down Payment', col2, currentY);
      doc.text(formatCurrency(downPayment), col3, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(dpPaid), col4, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(dpRemaining), col5, currentY, { width: 90, align: 'right' });
      doc.text(dpStatus, col6, currentY);
      
      currentY += rowHeight;
    }
    
    // Installments
    data.installments.forEach((inst) => {
      if (currentY > 720) {
        // Add footer to current page before adding new page
        const currentPage = (doc.page as any).pageNumber || 0;
        if (!footerAddedToPages.has(currentPage)) {
          addFooter();
        }
        doc.addPage();
        currentY = 50;
      }
      
      const remaining = (inst.amount || 0) - (inst.paidAmount || 0);
      const status = (inst.status || 'pending').charAt(0).toUpperCase() + (inst.status || 'pending').slice(1).toLowerCase();
      
      doc.fillColor('#000000');
      doc.text((inst.installmentNumber || 0).toString(), col1, currentY);
      doc.text(formatDate(inst.dueDate || new Date()), col2, currentY);
      doc.text(formatCurrency(inst.amount || 0), col3, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(inst.paidAmount || 0), col4, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(remaining), col5, currentY, { width: 90, align: 'right' });
      doc.text(status, col6, currentY);
      
      currentY += rowHeight;
    });
    
    // Total row
    if (currentY < pageHeight - 80) {
      currentY += 5;
      doc.moveTo(col1, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      
      doc.fontSize(10).font('Helvetica-Bold');
      const totalInstallments = data.installments.reduce((sum, i) => sum + (i.amount || 0), 0) + downPayment;
      doc.text('TOTAL', col2, currentY);
      doc.text(formatCurrency(totalInstallments), col3, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(data.summary.paidAmount), col4, currentY, { width: 90, align: 'right' });
      doc.text(formatCurrency(data.summary.remainingAmount), col5, currentY, { width: 90, align: 'right' });
    }
    
    doc.moveDown(0.6);
  }

  // Add footer to current/last page if not already added
  const lastPage = (doc.page as any).pageNumber || 0;
  if (!footerAddedToPages.has(lastPage)) {
    addFooter();
  }

  // Finalize PDF - ensure stream is ready
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-generator.ts:241',message:'Before doc.end()',data:{headersSent:res.headersSent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  // End the PDF document stream
  // Check if stream is still writable before ending
  try {
    const writableState = (doc as any)._writableState;
    const readableState = (doc as any)._readableState;
    if (!writableState?.ended && !readableState?.ended) {
      doc.end();
    }
  } catch (error: any) {
    // If stream already ended or error occurred, handle gracefully
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: error?.message || 'Failed to finalize PDF' 
      });
    } else {
      // Headers already sent, just end the response
      res.end();
    }
    throw error;
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-generator.ts:243',message:'After doc.end()',data:{headersSent:res.headersSent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7293d0cd-bbb9-40ce-87ee-9763b81d9a43',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pdf-generator.ts:245',message:'PDF generator error',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,500),errorName:error?.name,headersSent:res.headersSent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate PDF',
      });
    } else {
      res.end();
    }
    throw error;
  }
}

export interface ReceiptPDFData {
  receipt: {
    receiptNo: string;
    amount: number;
    method: string;
    date: Date | string;
    notes?: string;
  };
  deal: {
    dealCode?: string;
    title: string;
    dealAmount: number;
  };
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  allocations: Array<{
    installmentNumber: number;
    amountAllocated: number;
    installmentAmount: number;
    dueDate: Date | string;
  }>;
  receivedBy?: {
    username?: string;
    email?: string;
  };
  companyName?: string;
  companyLogo?: string;
}

/**
 * Generate Receipt PDF
 * Returns PDF buffer instead of piping to response
 */
export async function generateReceiptPDF(data: ReceiptPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Helper functions
    const formatCurrency = (amount: number): string => {
      return `Rs ${amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    const formatDate = (date: string | Date): string => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    // Header with Company Name
    const companyName = data.companyName || 'Real Estate Management System';
    doc.fontSize(24).font('Helvetica-Bold').text(companyName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica').text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(1);

    // Receipt Details
    doc.fontSize(14).font('Helvetica-Bold').text('Receipt Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Receipt Number: ${data.receipt.receiptNo}`);
    doc.text(`Date: ${formatDate(data.receipt.date)}`);
    doc.text(`Payment Method: ${data.receipt.method}`);
    doc.text(`Amount Received: ${formatCurrency(data.receipt.amount)}`);
    if (data.receipt.notes) {
      doc.moveDown(0.3);
      doc.text(`Notes: ${data.receipt.notes}`);
    }
    doc.moveDown(1);

    // Client Information
    doc.fontSize(14).font('Helvetica-Bold').text('Client Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${data.client.name}`);
    if (data.client.email) doc.text(`Email: ${data.client.email}`);
    if (data.client.phone) doc.text(`Phone: ${data.client.phone}`);
    if (data.client.address) doc.text(`Address: ${data.client.address}`);
    doc.moveDown(1);

    // Deal Information
    doc.fontSize(14).font('Helvetica-Bold').text('Deal Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Deal Code: ${data.deal.dealCode || 'N/A'}`);
    doc.text(`Title: ${data.deal.title}`);
    doc.text(`Total Deal Amount: ${formatCurrency(data.deal.dealAmount)}`);
    doc.moveDown(1);

    // Allocation Breakdown
    if (data.allocations && data.allocations.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Payment Allocation', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const itemHeight = 20;
      const tableLeft = 50;
      const col1 = tableLeft; // Installment #
      const col2 = col1 + 80; // Due Date
      const col3 = col2 + 120; // Installment Amount
      const col4 = col3 + 120; // Allocated

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Installment #', col1, tableTop);
      doc.text('Due Date', col2, tableTop);
      doc.text('Installment Amount', col3, tableTop);
      doc.text('Amount Allocated', col4, tableTop);

      doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      doc.fontSize(9).font('Helvetica');
      let currentY = tableTop + 25;

      data.allocations.forEach((alloc) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc.text(alloc.installmentNumber.toString(), col1, currentY);
        doc.text(formatDate(alloc.dueDate), col2, currentY);
        doc.text(formatCurrency(alloc.installmentAmount), col3, currentY);
        doc.text(formatCurrency(alloc.amountAllocated), col4, currentY);

        doc.moveTo(tableLeft, currentY + 12).lineTo(550, currentY + 12).stroke();
        currentY += itemHeight;
      });

      doc.y = currentY + 10;
    }

    // Total
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Total Amount Received: ${formatCurrency(data.receipt.amount)}`, { align: 'right' });

    // Footer with signatures
    doc.moveDown(2);
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;

    // Received By section
    doc.fontSize(10).font('Helvetica');
    doc.text('Received By:', 100, pageHeight - 150);
    doc.moveTo(100, pageHeight - 130).lineTo(250, pageHeight - 130).stroke();
    if (data.receivedBy) {
      doc.fontSize(9).text(data.receivedBy.username || data.receivedBy.email || '', 100, pageHeight - 115);
    }

    // Authorized Signature
    doc.text('Authorized Signature:', 350, pageHeight - 150);
    doc.moveTo(350, pageHeight - 130).lineTo(500, pageHeight - 130).stroke();

    // Footer note
    doc.fontSize(8).font('Helvetica');
    doc.text(
      'This is a computer-generated receipt. No signature required.',
      pageWidth / 2,
      pageHeight - 50,
      { align: 'center' }
    );

    doc.end();
  });
}

export interface PropertyReportData {
  property: {
    name?: string;
    propertyCode?: string | null;
    manualUniqueId?: string | null;
    type?: string | null;
    status?: string | null;
    address?: string | null;
    location?: string | null;
    dealerName?: string | null;
    salePrice?: number | null;
    totalUnits?: number;
    occupied?: number;
    totalArea?: number | null;
    yearBuilt?: number | null;
    ownerName?: string | null;
    ownerPhone?: string | null;
  };
  financeSummary: {
    totalReceived: number;
    totalExpenses: number;
    pendingAmount: number;
    entryCount: number;
  };
  financeRecords: Array<{
    id: string;
    amount: number;
    category?: string | null;
    referenceType?: string | null;
    description?: string | null;
    date?: Date | string | null;
  }>;
  deals: Array<{
    id: string;
    title?: string | null;
    amount: number;
    received: number;
    pending: number;
    status?: string | null;
    stage?: string | null;
    dealerName?: string | null;
    clientName?: string | null;
    createdAt?: Date | string | null;
  }>;
  sales: Array<{
    id: string;
    saleValue?: number | null;
    saleDate?: Date | string | null;
    buyerName?: string | null;
    dealerName?: string | null;
    status?: string | null;
    profit?: number | null;
  }>;
  paymentPlans?: Array<{
    dealId: string;
    dealTitle?: string | null;
    clientName?: string | null;
    installments: Array<{
      installmentNumber: number;
      amount: number;
      dueDate: Date | string;
      paidAmount: number;
      status: string;
      paidDate?: Date | string | null;
      remainingBalance: number;
    }>;
  }>;
}

/**
 * Generate Property PDF Report
 * Keeps styling lightweight to match app's clean theme
 */
export function generatePropertyReportPDF(data: PropertyReportData, res: Response): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  const safeName = data.property.name?.replace(/\s+/g, '-').toLowerCase() || 'property';
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeName}-report-${new Date().toISOString().split('T')[0]}.pdf"`
  );

  doc.pipe(res);

  const formatCurrency = (amount?: number | null): string => {
    if (amount === undefined || amount === null || Number.isNaN(amount)) return 'Rs 0';
    return `Rs ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (value?: string | Date | null): string => {
    if (!value) return 'N/A';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(data.property.name || 'Property Report', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(1);

  // Basic info
  doc.fontSize(14).font('Helvetica-Bold').text('Basic Information', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  doc.text(`System ID: ${data.property.propertyCode || 'N/A'}`);
  doc.text(`Manual ID: ${data.property.manualUniqueId || 'N/A'}`);
  doc.text(`Type: ${data.property.type || 'N/A'}`);
  doc.text(`Status: ${data.property.status || 'N/A'}`);
  doc.text(`Address: ${data.property.address || 'N/A'}`);
  if (data.property.yearBuilt) doc.text(`Year Built: ${data.property.yearBuilt}`);
  if (data.property.totalArea) doc.text(`Total Area: ${data.property.totalArea.toLocaleString()} sq ft`);
  doc.moveDown(0.6);

  // Pricing & ownership
  doc.fontSize(14).font('Helvetica-Bold').text('Commercials & Ownership', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Sales Price: ${formatCurrency(data.property.salePrice)}`);
  doc.text(`Dealer Assigned: ${data.property.dealerName || 'N/A'}`);
  doc.text(`Owner: ${data.property.ownerName || 'N/A'}`);
  doc.text(`Owner Contact: ${data.property.ownerPhone || 'N/A'}`);
  doc.text(
    `Units: ${data.property.occupied || 0} occupied of ${data.property.totalUnits ?? 0}`
  );
  doc.moveDown(0.6);

  // Finance summary
  doc.fontSize(14).font('Helvetica-Bold').text('Finance Summary', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Received: ${formatCurrency(data.financeSummary.totalReceived)}`);
  doc.text(`Pending Amount: ${formatCurrency(data.financeSummary.pendingAmount)}`);
  doc.text(`Total Expenses: ${formatCurrency(data.financeSummary.totalExpenses)}`);
  doc.text(`Entries: ${data.financeSummary.entryCount}`);
  doc.moveDown(0.6);

  // Finance records table (compact)
  if (data.financeRecords && data.financeRecords.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Finance Records (recent)', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold');
    const startY = doc.y;
    const col1 = 50;
    const col2 = col1 + 220;
    const col3 = col2 + 80;
    const col4 = col3 + 80;
    doc.text('Description', col1, startY);
    doc.text('Category', col2, startY);
    doc.text('Amount', col3, startY, { width: 80, align: 'right' });
    doc.text('Date', col4, startY, { width: 100 });
    doc.moveTo(col1, startY + 12).lineTo(550, startY + 12).stroke();
    doc.fontSize(9).font('Helvetica');
    let currentY = startY + 20;
    data.financeRecords.forEach((rec) => {
      if (currentY > 720) {
        doc.addPage();
        currentY = 50;
      }
      doc.text(rec.description || rec.referenceType || 'Entry', col1, currentY, { width: 200 });
      doc.text(rec.category || '-', col2, currentY);
      doc.text(formatCurrency(rec.amount), col3, currentY, { width: 80, align: 'right' });
      doc.text(formatDate(rec.date || undefined), col4, currentY, { width: 100 });
      currentY += 18;
    });
    doc.moveDown(1);
  }

  // Deals section
  doc.fontSize(12).font('Helvetica-Bold').text('Running Deals', { underline: true });
  doc.moveDown(0.3);
  if (!data.deals || data.deals.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No active deals.');
  } else {
    doc.fontSize(9).font('Helvetica');
    data.deals.forEach((deal) => {
      doc.text(`${deal.title || 'Deal'} (${deal.status || 'open'})`);
      doc.text(`  Amount: ${formatCurrency(deal.amount)} | Received: ${formatCurrency(deal.received)} | Pending: ${formatCurrency(deal.pending)}`);
      doc.text(
        `  Client: ${deal.clientName || 'N/A'} | Dealer: ${deal.dealerName || 'N/A'} | Stage: ${deal.stage || 'N/A'} | Created: ${formatDate(deal.createdAt)}`
      );
      doc.moveDown(0.2);
    });
  }
  doc.moveDown(0.6);

  // Sales / booking details
  doc.fontSize(12).font('Helvetica-Bold').text('Purchase / Booking Details', { underline: true });
  doc.moveDown(0.3);
  if (!data.sales || data.sales.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No sale/booking records found.');
  } else {
    doc.fontSize(9).font('Helvetica');
    data.sales.forEach((sale) => {
      doc.text(
        `Sale: ${formatCurrency(sale.saleValue)} | Buyer: ${sale.buyerName || 'N/A'} | Dealer: ${sale.dealerName || 'N/A'} | Status: ${sale.status || 'N/A'} | Date: ${formatDate(sale.saleDate)}`
      );
      if (sale.profit !== undefined && sale.profit !== null) {
        doc.text(`  Profit: ${formatCurrency(sale.profit)}`);
      }
      doc.moveDown(0.2);
    });
  }
  doc.moveDown(0.6);

  // Payment Plans section
  if (data.paymentPlans && data.paymentPlans.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Payment Plans', { underline: true });
    doc.moveDown(0.3);
    
    data.paymentPlans.forEach((plan) => {
      if (doc.y > 700) {
        doc.addPage();
      }
      
      doc.fontSize(10).font('Helvetica-Bold').text(`${plan.dealTitle || 'Deal'} - ${plan.clientName || 'N/A'}`);
      doc.moveDown(0.2);
      
      // Table header
      const tableStartY = doc.y;
      const col1 = 50;
      const col2 = col1 + 50;
      const col3 = col2 + 100;
      const col4 = col3 + 100;
      const col5 = col4 + 100;
      const col6 = col5 + 100;
      
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('No.', col1, tableStartY);
      doc.text('Amount', col2, tableStartY);
      doc.text('Due Date', col3, tableStartY);
      doc.text('Paid', col4, tableStartY, { width: 80, align: 'right' });
      doc.text('Status', col5, tableStartY);
      doc.text('Balance', col6, tableStartY, { width: 80, align: 'right' });
      
      doc.moveTo(col1, tableStartY + 10).lineTo(550, tableStartY + 10).stroke();
      doc.fontSize(8).font('Helvetica');
      
      let currentY = tableStartY + 18;
      plan.installments.forEach((inst) => {
        if (currentY > 720) {
          doc.addPage();
          currentY = 50;
        }
        
        doc.text(inst.installmentNumber.toString(), col1, currentY);
        doc.text(formatCurrency(inst.amount), col2, currentY, { width: 90 });
        doc.text(formatDate(inst.dueDate), col3, currentY, { width: 90 });
        doc.text(formatCurrency(inst.paidAmount), col4, currentY, { width: 80, align: 'right' });
        doc.text(inst.status || 'Pending', col5, currentY, { width: 90 });
        doc.text(formatCurrency(inst.remainingBalance), col6, currentY, { width: 80, align: 'right' });
        
        currentY += 16;
      });
      
      doc.moveDown(0.4);
    });
  }

  // Footer
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  doc.fontSize(8).font('Helvetica');
  doc.text(
    'Generated by REMS - Property Report',
    pageWidth / 2,
    pageHeight - 40,
    { align: 'center' }
  );

  doc.end();
}

export interface PropertiesReportData {
  properties: Array<{
    id: string;
    name?: string | null;
    propertyCode?: string | null;
    type?: string | null;
    address?: string | null;
    salePrice?: number | null;
    subsidiaryOption?: {
      id: string;
      name: string;
      propertySubsidiary?: {
        id: string;
        name: string;
        logoPath?: string | null;
      } | null;
    } | null;
  }>;
  generatedAt?: Date;
}

/**
 * Generate Properties PDF Report - audit-grade grid list
 */
export async function generatePropertiesReportPDF(data: PropertiesReportData, res: Response): Promise<void> {
  const { generateListReportPDF } = await import('./audit-grade-pdf-report');

  const flatProps = data.properties.map((p) => ({
    propertyCode: p.propertyCode ?? '—',
    name: p.name ?? '—',
    type: p.type ?? '—',
    address: p.address ?? '—',
    salePrice: p.salePrice,
    subsidiary: p.subsidiaryOption?.name ?? p.subsidiaryOption?.propertySubsidiary?.name ?? '—',
  }));

  const columns = [
    { key: 'propertyCode', header: 'Property Code', width: 120, type: 'string' as const },
    { key: 'name', header: 'Name', width: 180, type: 'string' as const },
    { key: 'type', header: 'Type', width: 100, type: 'string' as const },
    { key: 'address', header: 'Address', width: 220, type: 'string' as const },
    {
      key: 'salePrice',
      header: 'Sale Price',
      width: 110,
      type: 'currency' as const,
      format: (v: any) =>
        v != null && !isNaN(Number(v))
          ? `Rs ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '—',
    },
    { key: 'subsidiary', header: 'Subsidiary', width: 120, type: 'string' as const },
  ];

  generateListReportPDF(flatProps, columns, {
    companyName: 'Real Estate Management System',
    reportTitle: 'Properties Report',
    generatedAt: data.generatedAt ?? new Date(),
  }, res);
}

export interface VoucherPDFData {
  voucher: {
    voucherNumber: string;
    type: string;
    date: Date | string;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    amount: number;
    description?: string | null;
    status: string;
    account?: {
      code?: string | null;
      name?: string | null;
    } | null;
    property?: {
      name?: string | null;
      code?: string | null;
    } | null;
    unit?: {
      unitName?: string | null;
      unitNumber?: string | null;
    } | null;
    payeeType?: string | null;
    payeeId?: string | null;
    deal?: {
      dealCode?: string | null;
      title?: string | null;
      dealAmount?: number | null;
      client?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
      } | null;
    } | null;
    preparedBy?: {
      username?: string | null;
      email?: string | null;
    } | null;
    approvedBy?: {
      username?: string | null;
      email?: string | null;
    } | null;
    postedAt?: Date | string | null;
    createdAt?: Date | string | null;
  };
  lines: Array<{
    id: string;
    accountId: string;
    account?: {
      code?: string | null;
      name?: string | null;
    } | null;
    debit: number;
    credit: number;
    description?: string | null;
    property?: {
      name?: string | null;
    } | null;
    unit?: {
      unitName?: string | null;
    } | null;
  }>;
  companyName?: string;
}

/**
 * Generate Professional Voucher PDF Report
 * Shows complete voucher details including all lines, accounts, and totals
 */
export async function generateVoucherPDF(data: VoucherPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Helper functions
    const formatCurrency = (amount: number | null | undefined): string => {
      const safeAmount = amount || 0;
      return `Rs ${safeAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    };

    const formatDate = (date: string | Date | null | undefined): string => {
      if (!date) return '-';
      try {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return '-';
      }
    };

    const getVoucherTypeLabel = (type: string): string => {
      const labels: Record<string, string> = {
        BPV: 'Bank Payment Voucher',
        BRV: 'Bank Receipt Voucher',
        CPV: 'Cash Payment Voucher',
        CRV: 'Cash Receipt Voucher',
        JV: 'Journal Voucher',
      };
      return labels[type] || type;
    };

    const getStatusLabel = (status: string): string => {
      return status.charAt(0).toUpperCase() + status.slice(1);
    };

    // ============ HEADER SECTION ============
    const companyName = data.companyName || 'Real Estate Management System';
    doc.fontSize(24).font('Helvetica-Bold').text(companyName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).font('Helvetica-Bold').text(getVoucherTypeLabel(data.voucher.type), { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.moveDown(1);

    // ============ VOUCHER HEADER INFORMATION ============
    doc.fontSize(14).font('Helvetica-Bold').text('Voucher Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    const leftCol = 50;
    const rightCol = 300;
    let currentY = doc.y;

    doc.text(`Voucher Number:`, leftCol, currentY);
    doc.font('Helvetica-Bold').text(data.voucher.voucherNumber || '-', rightCol, currentY);
    doc.font('Helvetica');
    currentY += 15;

    doc.text(`Voucher Type:`, leftCol, currentY);
    doc.text(`${data.voucher.type} - ${getVoucherTypeLabel(data.voucher.type)}`, rightCol, currentY);
    currentY += 15;

    doc.text(`Date:`, leftCol, currentY);
    doc.text(formatDate(data.voucher.date), rightCol, currentY);
    currentY += 15;

    doc.text(`Status:`, leftCol, currentY);
    doc.font('Helvetica-Bold').text(getStatusLabel(data.voucher.status), rightCol, currentY);
    doc.font('Helvetica');
    currentY += 15;

    if (data.voucher.paymentMethod) {
      doc.text(`Payment Method:`, leftCol, currentY);
      doc.text(data.voucher.paymentMethod, rightCol, currentY);
      currentY += 15;
    }

    if (data.voucher.referenceNumber) {
      doc.text(`Reference Number:`, leftCol, currentY);
      doc.text(data.voucher.referenceNumber, rightCol, currentY);
      currentY += 15;
    }

    doc.text(`Total Amount:`, leftCol, currentY);
    doc.font('Helvetica-Bold').text(formatCurrency(data.voucher.amount), rightCol, currentY);
    doc.font('Helvetica');
    currentY += 15;

    if (data.voucher.account) {
      doc.text(`${data.voucher.type === 'BPV' || data.voucher.type === 'BRV' ? 'Bank' : 'Cash'} Account:`, leftCol, currentY);
      doc.text(`${data.voucher.account.code || '-'} - ${data.voucher.account.name || '-'}`, rightCol, currentY);
      currentY += 15;
    }

    if (data.voucher.description) {
      doc.text(`Description:`, leftCol, currentY);
      doc.text(data.voucher.description, rightCol, currentY, { width: 250 });
      currentY += 20;
    }

    doc.y = currentY + 10;
    doc.moveDown(0.5);

    // ============ PAYEE INFORMATION (for Payment Vouchers) ============
    if ((data.voucher.type === 'BPV' || data.voucher.type === 'CPV') && data.voucher.payeeType) {
      doc.fontSize(14).font('Helvetica-Bold').text('Payee Information', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Payee Type: ${data.voucher.payeeType}`);
      if (data.voucher.deal?.client) {
        doc.text(`Name: ${data.voucher.deal.client.name || '-'}`);
        if (data.voucher.deal.client.email) doc.text(`Email: ${data.voucher.deal.client.email}`);
        if (data.voucher.deal.client.phone) doc.text(`Phone: ${data.voucher.deal.client.phone}`);
      }
      doc.moveDown(0.5);
    }

    // ============ PROPERTY/UNIT INFORMATION ============
    if (data.voucher.property || data.voucher.unit) {
      doc.fontSize(14).font('Helvetica-Bold').text('Property/Unit Information', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica');
      if (data.voucher.property) {
        doc.text(`Property: ${data.voucher.property.name || '-'}`);
        if (data.voucher.property.code) doc.text(`Property Code: ${data.voucher.property.code}`);
      }
      if (data.voucher.unit) {
        doc.text(`Unit: ${data.voucher.unit.unitName || '-'}`);
        if (data.voucher.unit.unitNumber) doc.text(`Unit Number: ${data.voucher.unit.unitNumber}`);
      }
      doc.moveDown(0.5);
    }

    // ============ DEAL INFORMATION ============
    if (data.voucher.deal) {
      doc.fontSize(14).font('Helvetica-Bold').text('Deal Information', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).font('Helvetica');
      if (data.voucher.deal.dealCode) doc.text(`Deal Code: ${data.voucher.deal.dealCode}`);
      doc.text(`Title: ${data.voucher.deal.title || '-'}`);
      if (data.voucher.deal.dealAmount) {
        doc.text(`Deal Amount: ${formatCurrency(data.voucher.deal.dealAmount)}`);
      }
      doc.moveDown(0.5);
    }

    // ============ VOUCHER LINES TABLE ============
    if (data.lines && data.lines.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Voucher Lines', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const itemHeight = 20;
      const tableLeft = 50;
      const col1 = tableLeft; // Account
      const col2 = col1 + 200; // Description
      const col3 = col2 + 120; // Debit
      const col4 = col3 + 100; // Credit

      // Table Header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Account', col1, tableTop);
      doc.text('Description', col2, tableTop);
      doc.text('Debit', col3, tableTop, { align: 'right' });
      doc.text('Credit', col4, tableTop, { align: 'right' });

      // Draw header line
      doc.moveTo(tableLeft, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table Rows
      doc.fontSize(9).font('Helvetica');
      let currentY = tableTop + 25;
      let totalDebit = 0;
      let totalCredit = 0;

      data.lines.forEach((line) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
          // Redraw header on new page
          doc.fontSize(9).font('Helvetica-Bold');
          doc.text('Account', col1, currentY);
          doc.text('Description', col2, currentY);
          doc.text('Debit', col3, currentY, { align: 'right' });
          doc.text('Credit', col4, currentY, { align: 'right' });
          doc.moveTo(tableLeft, currentY + 15).lineTo(550, currentY + 15).stroke();
          currentY += 25;
          doc.fontSize(9).font('Helvetica');
        }

        const accountLabel = line.account
          ? `${line.account.code || '-'} - ${line.account.name || '-'}`
          : line.accountId || '-';
        
        const isSystemLine = line.description?.includes('[SYSTEM]') || false;

        // Account column
        if (isSystemLine) {
          doc.font('Helvetica-Bold').fillColor('#0066cc');
        }
        doc.text(accountLabel, col1, currentY, { width: 190 });
        if (isSystemLine) {
          doc.font('Helvetica').fillColor('black');
          doc.fontSize(7).text('(System)', col1, currentY + 10);
          doc.fontSize(9);
        }

        // Description column
        doc.text(line.description || '-', col2, currentY, { width: 110 });

        // Debit column
        if (line.debit > 0) {
          doc.text(formatCurrency(line.debit), col3, currentY, { align: 'right' });
          totalDebit += line.debit;
        } else {
          doc.text('-', col3, currentY, { align: 'right' });
        }

        // Credit column
        if (line.credit > 0) {
          doc.text(formatCurrency(line.credit), col4, currentY, { align: 'right' });
          totalCredit += line.credit;
        } else {
          doc.text('-', col4, currentY, { align: 'right' });
        }

        // Draw row separator
        doc.moveTo(tableLeft, currentY + 12).lineTo(550, currentY + 12).stroke();
        currentY += itemHeight;
      });

      // Totals Row
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.moveTo(tableLeft, currentY - 5).lineTo(550, currentY - 5).stroke();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('TOTAL', col1, currentY);
      doc.text(formatCurrency(totalDebit), col3, currentY, { align: 'right' });
      doc.text(formatCurrency(totalCredit), col4, currentY, { align: 'right' });

      // Balance check
      currentY += 20;
      const balance = Math.abs(totalDebit - totalCredit);
      if (balance < 0.01) {
        doc.fontSize(9).font('Helvetica').fillColor('#00aa00');
        doc.text('✓ Voucher is Balanced', col1, currentY);
      } else {
        doc.fontSize(9).font('Helvetica').fillColor('#cc0000');
        doc.text(`⚠ Difference: ${formatCurrency(balance)}`, col1, currentY);
      }
      doc.fillColor('black');

      doc.y = currentY + 20;
    }

    // ============ WORKFLOW INFORMATION ============
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold').text('Workflow Information', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    
    currentY = doc.y;
    if (data.voucher.preparedBy) {
      doc.text(`Prepared By: ${data.voucher.preparedBy.username || data.voucher.preparedBy.email || '-'}`, leftCol, currentY);
      if (data.voucher.createdAt) {
        doc.text(`on ${formatDate(data.voucher.createdAt)}`, rightCol, currentY);
      }
      currentY += 15;
    }
    if (data.voucher.approvedBy) {
      doc.text(`Approved By: ${data.voucher.approvedBy.username || data.voucher.approvedBy.email || '-'}`, leftCol, currentY);
      currentY += 15;
    }
    if (data.voucher.postedAt) {
      doc.text(`Posted At: ${formatDate(data.voucher.postedAt)}`, leftCol, currentY);
      currentY += 15;
    }

    doc.y = currentY + 10;

    // ============ FOOTER ============
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica');
    doc.text(
      'This is a computer-generated voucher document. No signature required. | Real Estate Management System',
      pageWidth / 2,
      pageHeight - 40,
      { align: 'center', width: pageWidth - 100 }
    );

    doc.end();
  });
}

