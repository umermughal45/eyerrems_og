"use client"

import { UnifiedReportLayout, UnifiedReportData, ReportSection } from "./unified-report-layout"
import { formatCurrency } from "@/lib/utils"

type PropertyReportHTMLProps = {
  property: {
    id?: string | number
    name?: string
    propertyCode?: string
    type?: string
    status?: string
    yearBuilt?: string | number
    totalArea?: string | number
    units?: number | any[]
    occupied?: number
    salePrice?: number | string
    address?: string
  }
  financeSummary?: {
    totalReceived?: number
    totalExpenses?: number
    pendingAmount?: number
    entries?: number
  }
  paymentPlan?: {
    totalAmount?: number
    downPayment?: number
    installments?: number
    installmentAmount?: number
    duration?: string
    schedule?: Array<{
      no: number
      date: string
      amount: string
      status: string
    }>
  }
  deals?: Array<{
    title?: string
    contactName?: string
    amount?: number
    received?: number
    pending?: number
    stage?: string
  }>
  hideActions?: boolean // Hide download/print buttons when true
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

export function PropertyReportHTML({ property, financeSummary = {}, paymentPlan, deals = [], hideActions = false }: PropertyReportHTMLProps) {
  // Prepare data for unified layout
  const unitsValue = typeof property.units === "number" ? property.units : Array.isArray(property.units) ? property.units.length : 0
  const totalAreaValue = typeof property.totalArea === "number" ? property.totalArea : typeof property.totalArea === "string" ? parseFloat(property.totalArea.replace(/[^0-9.]/g, "")) || 0 : 0

  const sections: ReportSection[] = []

  // Basic Information section
  sections.push({
    title: "Basic Information",
    data: {
      "Property Name": property.name || "N/A",
      "Type": property.type || "N/A",
      "Status": property.status || "N/A",
      "Year Built": property.yearBuilt || "N/A",
      "Area": formatArea(totalAreaValue),
      "Units": `${property.occupied || 0} / ${unitsValue}`,
      "Sale Price": property.salePrice ? formatCurrency(Number(property.salePrice)) : "Rs 0",
      "Address": property.address || "N/A"
    }
  })

  // Finance Summary section
  sections.push({
    title: "Finance Summary",
    data: {
      "Total Received": formatCurrency(financeSummary.totalReceived || 0),
      "Total Expenses": formatCurrency(financeSummary.totalExpenses || 0),
      "Pending Amount": formatCurrency(financeSummary.pendingAmount || 0),
      "Active Deals": financeSummary.entries || 0
    }
  })

  // Payment Plan section (if exists)
  if (paymentPlan) {
    sections.push({
      title: "Payment Plan Summary",
      data: {
        "Total Amount": formatCurrency(paymentPlan.totalAmount || 0),
        "Down Payment": formatCurrency(paymentPlan.downPayment || 0),
        "Installments": paymentPlan.installments || 0,
        "Installment Amount": formatCurrency(paymentPlan.installmentAmount || 0),
        "Duration": paymentPlan.duration || "N/A"
      }
    })

    // Payment schedule table
    if (paymentPlan.schedule && paymentPlan.schedule.length > 0) {
      sections.push({
        title: "Payment Schedule",
        tableData: paymentPlan.schedule.map(s => ({
          no: s.no,
          date: s.date,
          amount: s.amount,
          status: s.status
        })),
        tableColumns: [
          { key: 'no', label: '#', type: 'number' },
          { key: 'date', label: 'Due Date', type: 'date' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status' }
        ]
      })
    }
  }

  // Deals section
  if (deals && deals.length > 0) {
    sections.push({
      title: "Active Deals",
      tableData: deals.map(deal => ({
        title: deal.title || "N/A",
        client: deal.contactName || "N/A",
        amount: deal.amount || 0,
        received: deal.received || 0,
        pending: deal.pending || 0,
        stage: deal.stage || "N/A"
      })),
      tableColumns: [
        { key: 'title', label: 'Deal Title' },
        { key: 'client', label: 'Client' },
        { key: 'amount', label: 'Amount', type: 'currency' },
        { key: 'received', label: 'Received', type: 'currency' },
        { key: 'pending', label: 'Pending', type: 'currency' },
        { key: 'stage', label: 'Stage' }
      ]
    })
  }

  const reportData: UnifiedReportData = {
    title: "Property Report",
    systemId: property.propertyCode ? `PROP-${property.propertyCode}` : `PROP-${property.id}`,
    generatedOn: new Date().toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),
    sections
  }

  return <UnifiedReportLayout data={reportData} hideActions={hideActions} />
}
