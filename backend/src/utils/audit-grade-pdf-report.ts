/**
 * Audit-grade PDF Report Generator
 * ERP-standard list reports and voucher reports
 * - Fixed column widths, no auto-flow
 * - Repeating headers, page breaks
 * - Print-safe typography
 */

import PDFDocument from 'pdfkit';
import { Response } from 'express';

export interface ReportColumnDef {
  key: string;
  header: string;
  width: number;
  type?: 'string' | 'number' | 'date' | 'currency' | 'boolean';
  format?: (v: any, row?: any) => string;
}

export interface ListReportOptions {
  companyName?: string;
  reportTitle?: string;
  generatedAt?: Date;
  rowsPerPage?: number;
}

const PAGE_MARGIN = 40;
const ROWS_PER_PAGE = 25;

function getCellValue(row: any, col: ReportColumnDef): any {
  const path = col.key;
  const parts = path.split('.');
  let v: any = row;
  for (const p of parts) {
    v = v?.[p];
    if (v == null) break;
  }
  return v;
}

function formatCell(val: any, col: ReportColumnDef, row?: any): string {
  if (val === null || val === undefined) return '-';
  if (col.format) {
    const out = col.format(val, row);
    return out === null || out === undefined || out === '' ? '-' : String(out);
  }
  if (col.type === 'date') {
    if (val instanceof Date) return val.toISOString().split('T')[0];
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? '-' : d.toISOString().split('T')[0];
    } catch {
      return '-';
    }
  }
  if (col.type === 'boolean') {
    return val === true || val === 'true' || val === 1 ? 'Yes' : 'No';
  }
  if (col.type === 'currency' || col.type === 'number') {
    const n = typeof val === 'string' ? parseFloat(val) : Number(val);
    if (isNaN(n)) return '-';
    if (col.type === 'currency') return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return String(n);
  }
  return String(val);
}

/**
 * Generate list report PDF and stream to response
 */
export function generateListReportPDF(
  data: any[],
  columns: ReportColumnDef[],
  options: ListReportOptions,
  res: Response
): void {
  const companyName = options.companyName ?? 'Real Estate Management System';
  const reportTitle = options.reportTitle ?? 'Report';
  const generatedAt = options.generatedAt ?? new Date();
  const rowsPerPage = options.rowsPerPage ?? ROWS_PER_PAGE;

  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${reportTitle.replace(/\s+/g, '-')}-${generatedAt.toISOString().split('T')[0]}.pdf"`
  );
  doc.pipe(res);

  const pageW = doc.page.width;
  const usableW = pageW - PAGE_MARGIN * 2;
  const totalColWidth = columns.reduce((s, c) => s + (c.width || 100), 0);
  const scale = usableW / totalColWidth;
  const colWidths = columns.map((c) => Math.floor((c.width || 100) * scale));

  const addFooter = () => {
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text(
      `Page ${doc.bufferedPageRange().count} | Generated ${generatedAt.toLocaleString('en-IN')}`,
      pageW / 2,
      doc.page.height - 24,
      { align: 'center', width: pageW - 80 }
    );
  };

  const drawTableHeader = (y: number): number => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    let x = PAGE_MARGIN;
    columns.forEach((col, i) => {
      doc.rect(x, y, colWidths[i], 18).fill('#e5e5e5').stroke('#333');
      doc.text(col.header, x + 4, y + 4, { width: colWidths[i] - 8 });
      x += colWidths[i];
    });
    return y + 18;
  };

  const drawRow = (row: any, y: number): number => {
    doc.fontSize(8).font('Helvetica').fillColor('#000000');
    let x = PAGE_MARGIN;
    columns.forEach((col, i) => {
      const val = getCellValue(row, col);
      const text = formatCell(val, col, row);
      doc.rect(x, y, colWidths[i], 14).stroke('#ccc');
      doc.text(text, x + 3, y + 3, { width: colWidths[i] - 6, ellipsis: true });
      x += colWidths[i];
    });
    return y + 14;
  };

  doc.fontSize(10).font('Helvetica').fillColor('#666666').text(companyName, PAGE_MARGIN, PAGE_MARGIN);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(reportTitle, PAGE_MARGIN, PAGE_MARGIN + 14);
  doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`Generated: ${generatedAt.toLocaleString('en-IN')}`, PAGE_MARGIN, PAGE_MARGIN + 34);
  let currentY = PAGE_MARGIN + 55;

  if (data.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No data to display.', PAGE_MARGIN, currentY);
    addFooter();
    doc.end();
    return;
  }

  currentY = drawTableHeader(currentY);
  let rowsOnPage = 0;

  data.forEach((row) => {
    if (rowsOnPage >= rowsPerPage) {
      addFooter();
      doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN });
      currentY = PAGE_MARGIN + 20;
      currentY = drawTableHeader(currentY);
      rowsOnPage = 0;
    }
    currentY = drawRow(row, currentY);
    rowsOnPage++;
  });

  addFooter();
  doc.end();
}

/**
 * Generate list report PDF and return as Buffer
 */
export function generateListReportPDFBuffer(
  data: any[],
  columns: ReportColumnDef[],
  options: ListReportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const companyName = options.companyName ?? 'Real Estate Management System';
    const reportTitle = options.reportTitle ?? 'Report';
    const generatedAt = options.generatedAt ?? new Date();
    const rowsPerPage = options.rowsPerPage ?? ROWS_PER_PAGE;

    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', layout: 'landscape' });
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const usableW = pageW - PAGE_MARGIN * 2;
    const totalColWidth = columns.reduce((s, c) => s + (c.width || 100), 0);
    const scale = usableW / totalColWidth;
    const colWidths = columns.map((c) => Math.floor((c.width || 100) * scale));

    const addFooter = () => {
      doc.fontSize(8).font('Helvetica').fillColor('#666666');
      doc.text(
        `Page ${doc.bufferedPageRange().count} | Generated ${generatedAt.toLocaleString('en-IN')}`,
        pageW / 2,
        doc.page.height - 24,
        { align: 'center', width: pageW - 80 }
      );
    };

    const drawTableHeader = (y: number): number => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      let x = PAGE_MARGIN;
      columns.forEach((col, i) => {
        doc.rect(x, y, colWidths[i], 18).fill('#e5e5e5').stroke('#333');
        doc.text(col.header, x + 4, y + 4, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      return y + 18;
    };

    const drawRow = (row: any, y: number): number => {
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      let x = PAGE_MARGIN;
      columns.forEach((col, i) => {
        const val = getCellValue(row, col);
        const text = formatCell(val, col, row);
        doc.rect(x, y, colWidths[i], 14).stroke('#ccc');
        doc.text(text, x + 3, y + 3, { width: colWidths[i] - 6, ellipsis: true });
        x += colWidths[i];
      });
      return y + 14;
    };

    doc.fontSize(10).font('Helvetica').fillColor('#666666').text(companyName, PAGE_MARGIN, PAGE_MARGIN);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(reportTitle, PAGE_MARGIN, PAGE_MARGIN + 14);
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`Generated: ${generatedAt.toLocaleString('en-IN')}`, PAGE_MARGIN, PAGE_MARGIN + 34);
    let currentY = PAGE_MARGIN + 55;

    if (data.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No data to display.', PAGE_MARGIN, currentY);
      addFooter();
      doc.end();
      return;
    }

    currentY = drawTableHeader(currentY);
    let rowsOnPage = 0;

    data.forEach((row) => {
      if (rowsOnPage >= rowsPerPage) {
        addFooter();
        doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN });
        currentY = PAGE_MARGIN + 20;
        currentY = drawTableHeader(currentY);
        rowsOnPage = 0;
      }
      currentY = drawRow(row, currentY);
      rowsOnPage++;
    });

    addFooter();
    doc.end();
  });
}

/** Voucher report types */
export interface VoucherReportData {
  companyName?: string;
  voucher: {
    voucherNumber: string;
    type: string;
    date: Date | string;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    amount: number;
    status: string;
    account?: { code?: string | null; name?: string | null } | null;
    property?: { name?: string | null; code?: string | null } | null;
    unit?: { unitName?: string | null; unitNumber?: string | null } | null;
    preparedBy?: { username?: string | null; email?: string | null } | null;
    checkedBy?: { username?: string | null; email?: string | null } | null;
    approvedBy?: { username?: string | null; email?: string | null } | null;
    postedAt?: Date | string | null;
    createdAt?: Date | string | null;
  };
  lines: Array<{
    account?: { code?: string | null; name?: string | null } | null;
    accountId?: string;
    debit: number;
    credit: number;
    description?: string | null;
  }>;
}

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  BPV: 'Bank Payment Voucher',
  BRV: 'Bank Receipt Voucher',
  CPV: 'Cash Payment Voucher',
  CRV: 'Cash Receipt Voucher',
  JV: 'Journal Voucher',
};

function stripDebugText(desc: string | null | undefined): string {
  if (!desc) return '-';
  return desc.replace(/\s*\[SYSTEM\].*$/i, '').replace(/\s*\[.*?\]/g, '').trim() || '-';
}

function truncateDescription(s: string, maxLen: number = 70): string {
  if (!s || s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3).trim() + '...';
}

/**
 * Generate audit-grade voucher PDF (single page, fixed column widths)
 */
export function generateVoucherReportPDF(data: VoucherReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const pageW = 595;
    const pageH = 842;
    const margin = 40;
    const tableWidth = pageW - margin * 2;
    const colAccount = Math.floor(tableWidth * 0.30);
    const colDesc = Math.floor(tableWidth * 0.30);
    const colDebit = Math.floor(tableWidth * 0.20);
    const colCredit = Math.floor(tableWidth * 0.20);
    const tLeft = margin;
    const cAccount = tLeft + colAccount;
    const cDesc = cAccount + colDesc;
    const cDebit = cDesc + colDebit;
    const cCredit = cDebit + colDebit;
    const tRight = cCredit + colCredit;
    const rowH = 14;
    const maxRows = Math.floor((pageH - 280) / rowH);

    const v = data.voucher;
    const companyName = data.companyName ?? 'Real Estate Management System';
    const formatCurrency = (n: number | null | undefined) =>
      n != null && !isNaN(n)
        ? `Rs ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-';
    const formatDate = (d: string | Date | null | undefined) => {
      if (!d) return '-';
      try {
        const date = typeof d === 'string' ? new Date(d) : d;
        return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch {
        return '-';
      }
    };

    const typeLabel = VOUCHER_TYPE_LABELS[v.type] || v.type;
    const statusLabel = (v.status || 'Draft').charAt(0).toUpperCase() + (v.status || '').slice(1);

    let y = 36;
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(companyName, margin, y, { align: 'center' });
    y += 12;
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text(typeLabel, margin, y, { align: 'center' });
    y += 14;
    doc.fontSize(12).font('Helvetica-Bold').text(`Voucher # ${v.voucherNumber}`, margin, y, { align: 'center' });
    y += 12;
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`Status: ${statusLabel} | Generated: ${new Date().toLocaleString('en-IN')}`, margin, y, { align: 'center' });
    y += 20;

    const sumLeft = margin;
    const sumRight = margin + 180;

    doc.fontSize(8).font('Helvetica');
    doc.text('Voucher #:', sumLeft, y); doc.text(v.voucherNumber || '-', sumRight, y);
    y += 12; doc.text('Type:', sumLeft, y); doc.text(typeLabel, sumRight, y);
    y += 12; doc.text('Date:', sumLeft, y); doc.text(formatDate(v.date), sumRight, y);
    y += 12; doc.text('Total:', sumLeft, y); doc.font('Helvetica-Bold').text(formatCurrency(v.amount), sumRight, y);
    doc.font('Helvetica');
    y += 16;

    doc.fontSize(9).font('Helvetica-Bold').text('Voucher Lines', tLeft, y);
    y += 14;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
    doc.rect(tLeft, y, colAccount, rowH + 2).fill('#e5e5e5').stroke('#000');
    doc.text('Account', tLeft + 4, y + 3, { width: colAccount - 8 });
    doc.rect(cAccount, y, colDesc, rowH + 2).fill('#e5e5e5').stroke('#000');
    doc.text('Description', cAccount + 4, y + 3, { width: colDesc - 8 });
    doc.rect(cDesc, y, colDebit, rowH + 2).fill('#e5e5e5').stroke('#000');
    doc.text('Debit (Rs)', cDesc + 4, y + 3, { width: colDebit - 8, align: 'right' });
    doc.rect(cDebit, y, colCredit, rowH + 2).fill('#e5e5e5').stroke('#000');
    doc.text('Credit (Rs)', cDebit + 4, y + 3, { width: colCredit - 8, align: 'right' });
    y += rowH + 2;

    doc.font('Helvetica');
    let totalDebit = 0;
    let totalCredit = 0;
    const linesToShow = data.lines.slice(0, maxRows);

    linesToShow.forEach((line) => {
      const accLabel = line.account ? (line.account.code || '-') + ' - ' + (line.account.name || '-') : line.accountId || '-';
      const desc = truncateDescription(stripDebugText(line.description));

      doc.rect(tLeft, y, colAccount, rowH).stroke('#333');
      doc.fontSize(7).text(accLabel, tLeft + 3, y + 2, { width: colAccount - 6 });
      doc.rect(cAccount, y, colDesc, rowH).stroke('#333');
      doc.text(desc, cAccount + 3, y + 2, { width: colDesc - 6 });
      doc.rect(cDesc, y, colDebit, rowH).stroke('#333');
      doc.font('Helvetica-Bold').fillColor('#000000');
      doc.text(line.debit > 0 ? formatCurrency(line.debit) : '-', cDesc + 3, y + 2, { width: colDebit - 6, align: 'right' });
      doc.rect(cDebit, y, colCredit, rowH).stroke('#333');
      doc.text(line.credit > 0 ? formatCurrency(line.credit) : '-', cDebit + 3, y + 2, { width: colCredit - 6, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');

      if (line.debit > 0) totalDebit += line.debit;
      if (line.credit > 0) totalCredit += line.credit;
      y += rowH;
    });

    y += 4;
    doc.moveTo(tLeft, y).lineTo(tRight, y).stroke('#000');
    y += 6;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    doc.rect(tLeft, y, colAccount + colDesc, rowH + 2).fill('#d4d4d4').stroke('#000');
    doc.text('TOTAL', tLeft + 4, y + 3);
    doc.rect(cDesc, y, colDebit, rowH + 2).fill('#d4d4d4').stroke('#000');
    doc.text(formatCurrency(totalDebit), cDesc + 3, y + 3, { width: colDebit - 6, align: 'right' });
    doc.rect(cDebit, y, colCredit, rowH + 2).fill('#d4d4d4').stroke('#000');
    doc.text(formatCurrency(totalCredit), cDebit + 3, y + 3, { width: colCredit - 6, align: 'right' });
    y += rowH + 2 + 8;

    const balance = Math.abs(totalDebit - totalCredit);
    if (balance < 0.01) {
      doc.fontSize(8).font('Helvetica').fillColor('#059669');
      doc.text('[OK] Voucher balanced', tLeft, y);
    } else {
      doc.fontSize(8).font('Helvetica').fillColor('#dc2626');
      doc.text('! Difference: ' + formatCurrency(balance), tLeft, y);
    }
    doc.fillColor('#000000');
    y += 16;

    doc.fontSize(8).font('Helvetica-Bold').text('Audit / Workflow', margin, y);
    y += 12;
    doc.font('Helvetica').fontSize(7);
    doc.text('Prepared By: ' + (v.preparedBy?.username || v.preparedBy?.email || '-'), margin, y);
    y += 10;
    doc.text('Checked By: ' + (v.checkedBy?.username || v.checkedBy?.email || '-'), margin, y);
    y += 10;
    doc.text('Approved By: ' + (v.approvedBy?.username || v.approvedBy?.email || '-'), margin, y);
    y += 10;
    doc.text('Posted On: ' + formatDate(v.postedAt), margin, y);

    doc.fontSize(7).font('Helvetica').fillColor('#666666');
    doc.text(
      'Computer-generated document. No signature required. | REMS',
      pageW / 2,
      pageH - 24,
      { align: 'center', width: pageW - 80 }
    );
    doc.end();
  });
}
