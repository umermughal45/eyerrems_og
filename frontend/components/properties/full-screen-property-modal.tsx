// Full-Screen Property Detail Modal Component
"use client"

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, X } from 'lucide-react'
import { apiService } from '@/lib/api'
import { PropertyDetail, PropertyDetailResponse } from './types/property-detail'
import { DealerLedgerTable } from './dealer-ledger-table'

interface FullScreenPropertyModalProps {
  propertyId: number | string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FullScreenPropertyModal({ propertyId, open, onOpenChange }: FullScreenPropertyModalProps) {
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (open && propertyId) {
      fetchPropertyDetails()
    }
  }, [open, propertyId])

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.properties.getById(String(propertyId))
      const responseData = response.data as any
      const propertyData = responseData?.data || responseData
      
      // Transform the data to match our interface
      const transformedProperty: PropertyDetail = {
        id: propertyData.id,
        type: propertyData.type || 'N/A',
        status: propertyData.status || 'N/A',
        yearBuilt: propertyData.yearBuilt,
        totalArea: propertyData.totalArea,
        salesPrice: propertyData.salesPrice || propertyData.salePrice,
        units: propertyData.units || propertyData._count?.units || 0,
        address: propertyData.address || 'Address not available',
        dealer: propertyData.dealerName || propertyData.dealer?.name || 'N/A',
        owner: propertyData.ownerName || 'N/A',
        ownerContact: propertyData.ownerPhone || 'N/A',
        manualId: propertyData.manualUniqueId || propertyData.propertyCode || 'N/A',
        finance: {
          totalReceived: propertyData.financeSummary?.totalReceived || 0,
          totalExpenses: propertyData.financeSummary?.totalExpenses || 0,
          pendingAmount: propertyData.financeSummary?.pendingAmount || 0,
          entries: propertyData.financeSummary?.entryCount || 0,
          totalDue: propertyData.financeSummary?.totalDue || 0,
          totalOutstanding: propertyData.financeSummary?.totalOutstanding || 0
        },
        runningDeals: (propertyData.activeDeals || []).map((deal: any) => ({
          id: deal.id,
          title: deal.title || 'Deal',
          client: deal.clientName || 'N/A',
          amount: deal.amount || 0,
          received: deal.received || 0,
          pending: deal.pending || 0,
          stage: deal.stage || 'N/A'
        })),
        dealerLedger: propertyData.dealerLedger || []
      }
      
      setProperty(transformedProperty)
    } catch (err: any) {
      console.error("Failed to fetch property details:", err)
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch property details")
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePDF = async () => {
    if (!propertyId) return
    try {
      setPdfLoading(true)
      const response = await fetch(`/api/properties/${propertyId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${(property?.type || "property").replace(/\s+/g, "-").toLowerCase()}-report.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to generate property report", error)
      alert("Failed to generate PDF report. Please try again.")
    } finally {
      setPdfLoading(false)
    }
  }

  // Disable scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
    
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [open])

  if (!open) return null

  const formatCurrency = (amount?: number) => {
    if (!amount || amount === 0) return 'Rs 0'
    return `Rs ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen shadow-xl rounded-none p-0">

        {/* HEADER */}
        <div className="w-full bg-gradient-to-r from-[#052e2b] to-[#0f766e] text-white p-5 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Modal Town — Property Report</h1>
            <p className="text-sm opacity-70">Generated by REMS</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={pdfLoading || loading}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <FileText className="h-4 w-4 mr-2" />
              {pdfLoading ? "Preparing..." : "Generate PDF Report"}
            </Button>

            <button
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md flex items-center gap-2"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 max-w-5xl mx-auto">

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-destructive">{error}</div>
          ) : property ? (
            <>
              {/* BASIC INFO */}
              <section className="bg-white shadow-md rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Basic Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <InfoRow label="Type" value={property.type} />
                    <InfoRow label="Status" value={property.status} />
                    <InfoRow label="Year Built" value={property.yearBuilt} />
                  </div>

                  <div>
                    <InfoRow label="Total Area" value={property.totalArea ? `${property.totalArea.toLocaleString()} sq ft` : 'N/A'} />
                    <InfoRow label="Units" value={property.units.toString()} />
                    <InfoRow label="Sales Price" value={formatCurrency(property.salesPrice)} />
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600">{property.address}</p>
              </section>

              {/* FINANCE SUMMARY */}
              <section className="bg-white shadow-md rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Finance Summary</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div>
                    <InfoRow label="Total Received" value={formatCurrency(property.finance.totalReceived)} />
                    <InfoRow label="Total Expenses" value={formatCurrency(property.finance.totalExpenses)} />
                    <InfoRow label="Total Due" value={formatCurrency(property.finance.totalDue)} />
                  </div>

                  <div>
                    <InfoRow label="Pending Amount" value={formatCurrency(property.finance.pendingAmount)} />
                    <InfoRow label="Total Outstanding" value={formatCurrency(property.finance.totalOutstanding)} />
                    <InfoRow label="Entries" value={property.finance.entries.toString()} />
                  </div>
                </div>

                <h3 className="font-semibold mt-5 mb-2">Running Deals</h3>
                <DealsTable deals={property.runningDeals} formatCurrency={formatCurrency} />
              </section>

              {/* DEALER LEDGER SECTION */}
              <section className="bg-white shadow-md rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Dealer Ledger</h2>
                <DealerLedgerTable dealerLedger={property.dealerLedger} loading={loading} />
              </section>

              {/* COMMERCIALS & OWNERSHIP */}
              <section className="bg-white shadow-md rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Commercials & Ownership</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <InfoRow label="Dealer Assigned" value={property.dealer} />
                    <InfoRow label="Owner" value={property.owner} />
                  </div>
                  <div>
                    <InfoRow label="Owner Contact" value={property.ownerContact} />
                    <InfoRow label="Manual ID" value={property.manualId} />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Property not found</div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm text-gray-700 py-1">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value ?? "-"}</span>
    </div>
  )
}

function DealsTable({ deals, formatCurrency }: { deals: any[]; formatCurrency: (amount?: number) => string }) {
  if (!deals.length) {
    return <p className="text-gray-500">No running deals.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-t mt-2">
        <thead>
          <tr className="text-left text-sm text-gray-500">
            <th className="py-2">Deal</th>
            <th>Client</th>
            <th>Amount</th>
            <th>Received</th>
            <th>Pending</th>
            <th>Stage</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={d.id || i} className="border-t text-sm">
              <td className="py-2">{d.title}</td>
              <td>{d.client}</td>
              <td>{formatCurrency(d.amount)}</td>
              <td>{formatCurrency(d.received)}</td>
              <td>{formatCurrency(d.pending)}</td>
              <td>{d.stage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
