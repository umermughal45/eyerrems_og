"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, MapPin, Home, Users, DollarSign, Loader2, FileText, Receipt, Eye, Download } from "lucide-react"
import { apiService } from "@/lib/api"
import { getPropertyImageSrc } from "@/lib/property-image-utils"
import { AddUnitDialog } from "./add-unit-dialog"
import { AddTenantDialog } from "./add-tenant-dialog"
import { AddLeaseDialog } from "./add-lease-dialog"
import { AddPaymentDialog } from "@/components/finance/add-payment-dialog"
import { DocumentViewer } from "@/components/shared/document-viewer"

interface PropertyDetailsDialogProps {
  propertyId: number | string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PropertyDetailsDialog({ propertyId, open, onOpenChange }: PropertyDetailsDialogProps) {
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddUnitDialog, setShowAddUnitDialog] = useState(false)
  const [showAddTenantDialog, setShowAddTenantDialog] = useState(false)
  const [showAddLeaseDialog, setShowAddLeaseDialog] = useState(false)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)
  const [financeSummary, setFinanceSummary] = useState<any | null>(null)
  const [financeRecords, setFinanceRecords] = useState<any[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ id: string; fileUrl: string; fileName: string; fileType: string }>>([])
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; url: string; name: string; fileType: string } | null>(null)

  useEffect(() => {
    if (open && propertyId) {
      fetchPropertyDetails()
    }
  }, [open, propertyId])

  const fetchAttachments = async () => {
    if (!propertyId) return
    try {
      const attachmentsRes = await apiService.properties.getDocuments(String(propertyId))
      const attachmentsData = (attachmentsRes.data as any)?.data || attachmentsRes.data || []
      setAttachments(Array.isArray(attachmentsData) ? attachmentsData : [])
    } catch (err) {
      // Ignore if attachments endpoint fails
      console.warn("Failed to load attachments", err)
    }
  }

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.properties.getById(String(propertyId))
      // Backend returns { success: true, data: {...} }
      const responseData = response.data as any
      const propertyData = responseData?.data || responseData

      // Calculate units count from nested units array if _count is not available
      if (propertyData && !propertyData._count && propertyData.units) {
        propertyData.units = Array.isArray(propertyData.units) ? propertyData.units.length : 0
      }

      // Ensure revenue is a number, not an object
      if (propertyData && typeof propertyData.revenue !== 'number' && typeof propertyData.revenue !== 'string') {
        propertyData.revenue = 0
      }

      setProperty(propertyData)
      setFinanceSummary(propertyData.financeSummary || null)
      setFinanceRecords(Array.isArray(propertyData.financeRecords) ? propertyData.financeRecords : [])

      // Load attachments
      await fetchAttachments()
    } catch (err: any) {
      console.error("Failed to fetch property details:", err)
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch property details")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  // Convert sq ft to Marla/Kanal for display
  const formatArea = (sqFt?: number) => {
    if (!sqFt) return "N/A"
    if (sqFt >= 5445) {
      const kanal = Math.floor(sqFt / 5445)
      const remainingMarla = Math.round((sqFt % 5445) / 272.25)
      if (remainingMarla > 0) {
        return `${kanal} Kanal ${remainingMarla} Marla (${sqFt.toLocaleString()} sq ft)`
      }
      return `${kanal} Kanal (${sqFt.toLocaleString()} sq ft)`
    }
    const marla = Math.round(sqFt / 272.25)
    return `${marla} Marla (${sqFt.toLocaleString()} sq ft)`
  }

  const handleRefresh = () => {
    fetchPropertyDetails()
  }

  const handleGenerateReport = () => {
    if (!property) return

    // Prepare data for unified report
    const unitsValue = typeof property.units === "number" ? property.units : property._count?.units ?? (Array.isArray(property.units) ? property.units.length : 0)
    const totalAreaValue = typeof property.totalArea === "number" ? property.totalArea : typeof property.totalArea === "string" ? parseFloat(property.totalArea.replace(/[^0-9.]/g, "")) || 0 : 0

    const reportData = {
      title: "Property Report",
      systemId: property.propertyCode ? `PROP-${property.propertyCode}` : `PROP-${property.id}`,
      generatedOn: new Date().toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      sections: [
        {
          title: "Basic Information",
          data: {
            "Property Name": property.tid || "N/A",
            "Type": property.type || "N/A",
            "Status": property.status || "N/A",
            "Year Built": property.yearBuilt || "N/A",
            "Area": formatArea(totalAreaValue),
            "Units": `${property.occupied || 0} / ${unitsValue}`,
            "Sale Price": property.salePrice ? `Rs ${Number(property.salePrice).toLocaleString("en-IN")}` : "Rs 0",
            "Address": property.address || "N/A"
          }
        },
        {
          title: "Finance Summary",
          data: {
            "Total Received": `Rs ${Number(financeSummary?.totalReceived || 0).toLocaleString("en-IN")}`,
            "Total Expenses": `Rs ${Number(financeSummary?.totalExpenses || 0).toLocaleString("en-IN")}`,
            "Pending Amount": `Rs ${Number(financeSummary?.pendingAmount || 0).toLocaleString("en-IN")}`,
            "Active Deals": financeSummary?.entryCount || financeRecords.length || 0
          }
        }
      ]
    }

    // Import the utility and open in new tab
    import("@/components/reports/report-utils").then(({ openReportInNewTab }) => {
      openReportInNewTab(reportData)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[1100px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            {loading ? "Loading..." : property?.tid || "Property Details"}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateReport}
              disabled={reportLoading}
            >
              <FileText className="h-4 w-4 mr-2" />
              {reportLoading ? "Preparing..." : "Generate Full Report"}
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">{error}</div>
        ) : property ? (
          <div className="space-y-6">
            {/* Hero image */}
            {property.imageUrl && (
              <div className="h-56 w-full overflow-hidden rounded-lg border border-border">
                <img
                  src={getPropertyImageSrc(propertyId, property.imageUrl)}
                  alt={property.tid || "Property image"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ; (e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{property.type || "N/A"}</Badge>
              <Badge
                variant={
                  property.status === "Active"
                    ? "default"
                    : property.status === "Maintenance"
                      ? "destructive"
                      : property.status === "For Sale"
                        ? "secondary"
                        : "outline"
                }
              >
                {property.status || "N/A"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* 1. Property Summary */}
              <Card className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Property Summary</p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground">{property.tid || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">System ID</span>
                    <span className="font-mono text-foreground">
                      {property.propertyCode || property.code || "N/A"}
                    </span>
                  </div>
                  {property.manualUniqueId && (
                    <div className="grid grid-cols-[120px,1fr] gap-2">
                      <span className="text-muted-foreground">Manual ID</span>
                      <span className="font-mono text-foreground">
                        {property.manualUniqueId}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground">{property.type || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-foreground">{property.status || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Sales Price</span>
                    <span className="text-foreground">
                      {property.salePrice !== undefined && property.salePrice !== null
                        ? `Rs ${Number(property.salePrice).toLocaleString("en-IN")}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="text-foreground">{property.ownerName || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Owner Phone</span>
                    <span className="text-foreground">{property.ownerPhone || "N/A"}</span>
                  </div>
                </div>
              </Card>

              {/* 2. Address */}
              <Card className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Address</p>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {property.address || "Address not available"}
                  </p>
                  {property.location && (
                    <p className="text-xs text-muted-foreground">{property.location}</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* 3. Structure Details */}
              <Card className="space-y-4 p-4 md:col-span-1">
                <p className="text-sm font-semibold tracking-wide text-muted-foreground">Structure Details</p>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Floors</span>
                    <span className="text-foreground">
                      {property.totalFloors ?? property._count?.floors ??
                        (Array.isArray(property.floors) ? property.floors.length : "N/A")}
                    </span>
                  </div>
                  {Array.isArray(property.floors) && property.floors.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-muted-foreground text-xs">Floor List:</span>
                      <div className="flex flex-wrap gap-1">
                        {property.floors.map((floor: any) => (
                          <Badge key={floor.id} variant="outline" className="text-xs">
                            {floor.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Unit Count</span>
                    <span className="text-foreground">
                      {typeof property.units === "number"
                        ? property.units
                        : property._count?.units ??
                        (Array.isArray(property.units) ? property.units.length : "N/A")}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Year Built</span>
                    <span className="text-foreground">{property.yearBuilt || "N/A"}</span>
                  </div>
                  {property.totalArea && (
                    <div className="grid grid-cols-[120px,1fr] gap-2">
                      <span className="text-muted-foreground">Total Area</span>
                      <span className="text-foreground">{formatArea(property.totalArea)}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* 4. Current Occupancy Summary */}
              <Card className="space-y-4 p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Current Occupancy</p>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                {(() => {
                  const totalUnits =
                    typeof property.units === "number"
                      ? property.units
                      : property._count?.units ??
                      (Array.isArray(property.units) ? property.units.length : 0)
                  const occupiedUnits = property.occupied ?? property.occupiedUnits ?? 0
                  const vacantUnits = property.vacantUnits ?? Math.max(totalUnits - occupiedUnits, 0)
                  const upcomingVacantUnits = property.upcomingVacantUnits ?? 0
                  const occupancyPercent = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

                  return (
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total Units</p>
                        <p className="text-lg font-semibold text-foreground">{totalUnits || 0}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Occupied Units</p>
                        <p className="text-lg font-semibold text-foreground">{occupiedUnits}</p>
                        <p className="text-xs text-muted-foreground">{occupancyPercent}% occupancy</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Vacant Units</p>
                        <p className="text-lg font-semibold text-foreground">{vacantUnits}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Upcoming Vacancies</p>
                        <p className="text-lg font-semibold text-foreground">{upcomingVacantUnits}</p>
                      </div>
                    </div>
                  )
                })()}
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* 5. Amenities List */}
              <Card className="space-y-4 p-4 md:col-span-1">
                <p className="text-sm font-semibold tracking-wide text-muted-foreground">Amenities</p>
                {Array.isArray(property.amenities) && property.amenities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity: string) => (
                      <Badge key={amenity} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No amenities listed</p>
                )}
              </Card>

              {/* 6. Last 12 Month Income Summary */}
              <Card className="space-y-4 p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">
                    Last 12 Months Income
                  </p>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Income</p>
                    <p className="text-lg font-semibold text-foreground">
                      {(() => {
                        const v = property.incomeLast12Months ?? property.revenue
                        if (typeof v === "number" && v > 0) return `Rs ${v.toLocaleString("en-IN")}`
                        if (typeof v === "string") return v
                        return "Rs 0"
                      })()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Average / Month</p>
                    <p className="text-lg font-semibold text-foreground">
                      {(() => {
                        const v = property.incomeLast12Months ?? property.revenue
                        if (typeof v === "number" && v > 0) return `Rs ${Math.round(v / 12).toLocaleString("en-IN")}`
                        return "Rs 0"
                      })()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Reported Currency</p>
                    <p className="text-lg font-semibold text-foreground">PKR</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Finance Summary</p>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Received</span>
                    <span className="font-semibold text-foreground">
                      Rs {Number(financeSummary?.totalReceived || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending Amount</span>
                    <span className="font-semibold text-foreground">
                      Rs {Number(financeSummary?.pendingAmount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="font-semibold text-foreground">
                      Rs {Number(financeSummary?.totalExpenses || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Finance Entries</span>
                    <span className="font-semibold text-foreground">
                      {financeSummary?.entryCount || financeRecords.length || 0}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="space-y-3 p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Finance Records</p>
                  <span className="text-xs text-muted-foreground">Recent entries</span>
                </div>
                {financeRecords && financeRecords.length > 0 ? (
                  <div className="space-y-3">
                    {financeRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {record.description || record.referenceType || "Entry"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.category || "Uncategorized"} •{" "}
                            {record.date ? new Date(record.date).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          Rs {Number(record.amount || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No finance records yet.</p>
                )}
              </Card>
            </div>

            {/* 7. Quick Actions */}
            <Card className="space-y-3 p-4">
              <p className="text-sm font-semibold tracking-wide text-muted-foreground">Quick Actions</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  className="justify-start"
                  type="button"
                  onClick={() => setShowAddUnitDialog(true)}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Add Unit
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  type="button"
                  onClick={() => setShowAddTenantDialog(true)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Add Tenant
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  type="button"
                  onClick={() => setShowAddLeaseDialog(true)}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Create Lease
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  type="button"
                  onClick={() => setShowAddPaymentDialog(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </Card>

            {property.description && (
              <Card className="space-y-2 p-4">
                <p className="text-sm font-semibold tracking-wide text-muted-foreground">Description</p>
                <p className="text-sm text-muted-foreground">{property.description}</p>
              </Card>
            )}

            {property.activeDeals && property.activeDeals.length > 0 && (
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Active Deals</p>
                  <span className="text-xs text-muted-foreground">{property.activeDeals.length} deal(s)</span>
                </div>
                <div className="space-y-3">
                  {property.activeDeals.map((deal: any) => (
                    <div key={deal.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{deal.title || "Deal"}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.stage || "Open"} • {deal.status || "open"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          Rs {Number(deal.amount || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                        <span>Received: Rs {Number(deal.received || 0).toLocaleString("en-IN")}</span>
                        <span>Pending: Rs {Number(deal.pending || 0).toLocaleString("en-IN")}</span>
                        <span>Client: {deal.clientName || "N/A"}</span>
                        <span>Dealer: {deal.dealerName || "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-wide text-muted-foreground">Attachments</p>
                  <span className="text-xs text-muted-foreground">{attachments.length} file(s)</span>
                </div>
                <div className="space-y-2">
                  {attachments.map((attachment, idx) => {
                    // Construct proper URL from fileUrl stored in database
                    // fileUrl format: /secure-files/properties/{entityId}/{filename}
                    let fileUrl = ''
                    if (attachment.fileUrl) {
                      if (attachment.fileUrl.startsWith('http://') || attachment.fileUrl.startsWith('https://')) {
                        fileUrl = attachment.fileUrl
                      } else {
                        // Construct full URL from relative path
                        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
                        const cleanPath = attachment.fileUrl.replace(/^\/api/, '')
                        fileUrl = `${baseUrl}/api${cleanPath}`
                      }
                    }

                    return (
                      <div key={attachment.id || idx} className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline hover:text-blue-600 truncate flex-1"
                        >
                          {attachment.fileName}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            const link = document.createElement('a')
                            link.href = fileUrl
                            link.download = attachment.fileName
                            link.target = '_blank'
                            link.rel = 'noopener noreferrer'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">Property not found</div>
        )}
      </DialogContent>

      {/* Quick Action Dialogs */}
      <AddUnitDialog
        open={showAddUnitDialog}
        onOpenChange={setShowAddUnitDialog}
        onSuccess={() => {
          handleRefresh()
          setShowAddUnitDialog(false)
        }}
        defaultPropertyId={propertyId?.toString()}
      />
      <AddTenantDialog
        open={showAddTenantDialog}
        onOpenChange={setShowAddTenantDialog}
        onSuccess={() => {
          handleRefresh()
          setShowAddTenantDialog(false)
        }}
        defaultPropertyId={propertyId?.toString()}
      />
      <AddLeaseDialog
        open={showAddLeaseDialog}
        onOpenChange={setShowAddLeaseDialog}
        onSuccess={() => {
          handleRefresh()
          setShowAddLeaseDialog(false)
        }}
        defaultPropertyId={propertyId?.toString()}
      />
      <AddPaymentDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={() => {
          handleRefresh()
          setShowAddPaymentDialog(false)
        }}
      />

      {/* Document Viewer */}
      <DocumentViewer
        open={documentViewerOpen}
        onClose={() => {
          setDocumentViewerOpen(false)
          setSelectedDocument(null)
        }}
        document={selectedDocument}
      />
    </Dialog>
  )
}
