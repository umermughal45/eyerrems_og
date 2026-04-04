"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, FileSpreadsheet } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export interface ReportSection {
  title: string
  data?: Record<string, any>
  tableData?: Array<Record<string, any>>
  tableColumns?: Array<{ key: string; label: string; type?: 'currency' | 'date' | 'number' | 'text' }>
}

export interface UnifiedReportData {
  title: string
  systemId?: string
  generatedOn: string
  sections: ReportSection[]
}

interface UnifiedReportLayoutProps {
  data?: UnifiedReportData
  hideActions?: boolean
  title?: string
  description?: string
  filters?: any
  onDownload?: (format: 'pdf' | 'excel') => void
  downloading?: 'pdf' | 'excel' | null
  children?: React.ReactNode
}

const formatArea = (sqFt?: number | string): string => {
  if (!sqFt) return "N/A"
  const numSqFt = typeof sqFt === "string" ? parseFloat(sqFt) : sqFt
  if (isNaN(numSqFt)) return String(sqFt)

  if (numSqFt >= 5445) {
    const kanal = Math.floor(numSqFt / 5445)
    const remainingMarla = Math.round((numSqFt % 5445) / 272.25)
    return remainingMarla > 0 ? `${kanal} Kanal ${remainingMarla} Marla (${numSqFt.toLocaleString()} sq ft)` : `${kanal} Kanal (${numSqFt.toLocaleString()} sq ft)`
  }
  const marla = Math.round(numSqFt / 272.25)
  return `${marla} Marla (${numSqFt.toLocaleString()} sq ft)`
}

const formatValue = (value: any, type?: string): string => {
  if (value == null || value === "") return "N/A"

  switch (type) {
    case 'currency':
      return formatCurrency(Number(value))
    case 'date':
      return new Date(value).toLocaleDateString()
    case 'number':
      return Number(value).toLocaleString()
    default:
      return String(value)
  }
}

export function UnifiedReportLayout({ data, hideActions = false, title, description, filters, onDownload, downloading, children }: UnifiedReportLayoutProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!data || !iframeRef.current) return

    const iframe = iframeRef.current
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document

    if (!iframeDoc) return

    // Generate HTML
    const sectionsHtml = data.sections.map(section => {
      let content = `<section class="card">
<h2>${section.title}</h2>`

      if (section.tableData && section.tableColumns) {
        content += `
<table class="payment-table">
<thead>
<tr>
  ${section.tableColumns.map(col => `<th>${col.label}</th>`).join('')}
</tr>
</thead>
<tbody>
  ${section.tableData.map(row => `
  <tr>
    ${section.tableColumns!.map(col => `<td>${formatValue(row[col.key], col.type)}</td>`).join('')}
  </tr>
  `).join('')}
</tbody>
</table>`
      } else if (section.data) {
        content += `
<div class="grid">
  ${Object.entries(section.data).map(([key, value]) => `
  <div class="row">
    <span class="label">${key}:</span>
    <span class="value">${formatValue(value)}</span>
  </div>
  `).join('')}
</div>`
      }

      content += `
</section>`
      return content
    }).join('')

    const actionsHtml = hideActions ? "" : `<div class="actions">
    <button class="download" id="download">Download Report</button>
    <button class="print" onclick="window.print()">Print / PDF</button>
</div>`

    const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${data.title} — Modal Town</title>
<style>
:root{
  --bg:#f6f8fb;
  --card:#ffffff;
  --muted:#6b7280;
  --accent:#0f766e;
  --danger:#b91c1c;
  --shadow:0 6px 18px rgba(15,15,15,0.06);
  font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial;
}
body{margin:0;background:var(--bg);color:#0b1220;padding:20px}
.container{max-width:1000px;margin:0 auto}
header{
  display:flex;justify-content:space-between;gap:20px;
  background:linear-gradient(90deg,#052e2b,#0f766e);
  color:#fff;padding:18px;border-radius:10px;margin-bottom:20px;
}
.brand{font-size:20px;font-weight:700}
.system-info{font-size:13px;opacity:.9;text-align:right}
.card{
  background:var(--card);
  margin-bottom:18px;
  padding:18px;
  border-radius:10px;
  box-shadow:var(--shadow)
}
h2{margin:0 0 15px 0;font-size:18px;color:var(--accent);font-weight:600;border-bottom:2px solid var(--accent);padding-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.row{display:flex;justify-content:space-between;margin-bottom:8px}
.label{color:var(--muted);font-size:13px}
.value{font-weight:600}
.money{color:var(--danger)}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{padding:10px;border-bottom:1px solid #eef1f5;text-align:left}
.payment-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.payment-table thead{background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff}
.payment-table thead th{padding:14px 12px;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border:none}
.payment-table tbody tr{border-bottom:1px solid #eef1f5;transition:background 0.2s}
.payment-table tbody tr:hover{background:#f8fafc}
.payment-table tbody tr:last-child{border-bottom:none}
.payment-table tbody td{padding:12px;font-size:14px;color:#1f2937}
.payment-table tbody td:first-child{font-weight:600;color:#0f766e}
.payment-table tbody td:nth-child(3){font-weight:600;color:#059669}
.payment-table .status-badge{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.3px}
.payment-table .status-paid{background:#d1fae5;color:#065f46}
.payment-table .status-pending{background:#fef3c7;color:#92400e}
.payment-table .status-overdue{background:#fee2e2;color:#991b1b}
.payment-table .summary-row{background:#f0fdf4;font-weight:700;border-top:2px solid #0f766e}
.payment-table .summary-row td{color:#065f46;padding:14px 12px;font-size:15px}
.payment-table .summary-label{text-transform:uppercase;font-size:12px;letter-spacing:0.5px;opacity:0.8}
.actions{display:flex;gap:10px;margin-top:24px;justify-content:center}
button{
  border:0;border-radius:8px;
  padding:12px 20px;
  font-weight:600;cursor:pointer;font-size:14px
}
.print{background:#0f766e;color:#fff}
.download{background:#111827;color:#fff}
@media(max-width:720px){
  .grid{grid-template-columns:1fr}
  header{flex-direction:column}
}
@media print{
  .actions{display:none !important}
  body{background:#fff;padding:10px}
}
</style>
</head>
<body>
<div class="container">
<header>
  <div>
    <div class="brand">Modal Town — ${data.title}</div>
    <div style="font-size:13px;opacity:.9">Generated by REMS</div>
  </div>
  <div class="system-info">
    <div>Generated: ${data.generatedOn}</div>
    ${data.systemId ? `<div>System ID: ${data.systemId}</div>` : ''}
  </div>
</header>

${sectionsHtml}

${actionsHtml}
</div>
<script>
(function() {
  const downloadBtn = document.getElementById('download');
  if (downloadBtn) {
    downloadBtn.onclick = function() {
      const htmlContent = document.documentElement.outerHTML;
      const b = new Blob([htmlContent], {type: "text/html"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "${data.title.replace(/\s+/g, '-').toLowerCase()}-report.html";
      a.click();
    };
  }

  // Hide actions if page is opened standalone
  function hideActionsIfStandalone() {
    try {
      const isInIframe = window.self !== window.top;
      if (!isInIframe) {
        const actionsEl = document.querySelector('.actions');
        if (actionsEl) {
          actionsEl.style.display = 'none';
        }
      }
    } catch (e) {
      const actionsEl = document.querySelector('.actions');
      if (actionsEl) {
        actionsEl.style.display = 'none';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideActionsIfStandalone);
  } else {
    hideActionsIfStandalone();
  }
})();
</script>
</body>
</html>`

    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()
  }, [data, hideActions])

  if (data) {
    return (
      <div className="w-full h-full">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          style={{ minHeight: "800px" }}
          title={data.title}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {onDownload && (
            <>
              <Button variant="outline" onClick={() => onDownload('pdf')} disabled={downloading === 'pdf'}>
                {downloading === 'pdf' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                PDF
              </Button>
              <Button variant="outline" onClick={() => onDownload('excel')} disabled={downloading === 'excel'}>
                {downloading === 'excel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {filters && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Filters applied: {JSON.stringify(filters)}</p>
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  )
}
