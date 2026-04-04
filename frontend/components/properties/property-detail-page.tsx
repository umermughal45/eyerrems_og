"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Home,
  MapPin,
  Receipt,
  Users,
  User,
  Phone,
  DollarSign,
  Upload,
  Loader2,
  Eye,
  Download,
} from "lucide-react"
import { apiService } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { getPropertyImageSrc } from "@/lib/property-image-utils"
import { PropertyReportHTML } from "@/components/reports/property-report-html"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ImageLightbox } from "@/components/shared/image-lightbox"
import { DocumentViewer } from "@/components/shared/document-viewer"
import { AccountsFooterBar } from "@/components/shared/accounts-footer-bar"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PropertyResponse = {
  id: string | number
  tid?: string
  name?: string
  propertyCode?: string
  manualUniqueId?: string
  type?: string
  status?: string
  address?: string
  location?: string
  totalArea?: number
  amenities?: string[]
  description?: string
  units?: number | any[]
  occupied?: number
  yearBuilt?: string | number
  salePrice?: number | string
  imageUrl?: string
  ownerName?: string
  ownerPhone?: string
  dealerName?: string
  dealerContact?: string
  dealer?: {
    id?: string
    name?: string
    phone?: string
    email?: string
  }
  subsidiaryOptionId?: string | null
  subsidiaryOption?: {
    id?: string
    name?: string
  }
  financeSummary?: {
    totalReceived?: number
    totalExpenses?: number
    pendingAmount?: number
    entries?: number
  }
  deals?: Array<{
    id?: string | number
    title?: string
    stage?: string
    amount?: number
    dealAmount?: number
    contactName?: string
    contactPhone?: string
    client?: {
      name?: string
    }
    payments?: Array<{
      amount?: number
    }>
    paymentPlan?: {
      id?: string | number
      totalAmount?: number
      downPayment?: number
      installments?: Array<{
        installmentNumber?: number
        amount?: number
        dueDate?: string | Date
        paidAmount?: number
        status?: string
      }>
    }
  }>
}

const formatArea = (sqFt?: number) => {
  if (!sqFt) return "N/A"
  if (sqFt >= 5445) {
    const kanal = Math.floor(sqFt / 5445)
    const remainingMarla = Math.round((sqFt % 5445) / 272.25)
    return remainingMarla > 0 ? `${kanal} Kanal ${remainingMarla} Marla (${sqFt.toLocaleString()} sq ft)` : `${kanal} Kanal (${sqFt.toLocaleString()} sq ft)`
  }
  const marla = Math.round(sqFt / 272.25)
  return `${marla} Marla (${sqFt.toLocaleString()} sq ft)`
}

export function PropertyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const propertyId = params?.id

  const [property, setProperty] = useState<PropertyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ id: string; fileUrl: string; fileName: string; fileType: string }>>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; url: string; name: string; fileType: string } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (propertyId) {
      fetchProperty()
    }
  }, [propertyId])

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

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !files.length || !propertyId) return

    setUploadingAttachments(true)
    try {
      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          toast({
            title: "Invalid file type",
            description: `File "${file.name}" is not supported. Only PDF, JPG, PNG, GIF, and WEBP files are allowed`,
            variant: "destructive",
          })
          continue
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `File "${file.name}" exceeds 10MB limit`,
            variant: "destructive",
          })
          continue
        }

        const base64 = await toBase64(file)

        // Upload using property-specific endpoint for now, but ensure the backend
        // handles it by storing it in the centralized structure.
        // Ideally we should switch to a generic file upload endpoint:
        // apiService.files.upload(entity, entityId, file)
        const response: any = await apiService.properties.uploadDocument(String(propertyId), {
          file: base64,
          filename: file.name,
        })

        const responseData = response.data as any
        const uploaded = responseData?.data || responseData

        // Refresh attachments list
        await fetchAttachments()

        toast({ title: `File "${file.name}" uploaded successfully` })
      }
    } catch (error: any) {
      toast({
        title: "Failed to upload attachment",
        description: error?.response?.data?.error || error?.message || "Upload failed",
        variant: "destructive",
      })
    } finally {
      setUploadingAttachments(false)
      // Reset input
      if (e.target) {
        e.target.value = ""
      }
    }
  }

  const fetchProperty = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.properties.getById(String(propertyId))
      const data = response?.data?.data || response?.data || null
      setProperty(data)

      // Load attachments
      await fetchAttachments()
    } catch (err: any) {
      console.error("Failed to fetch property", err)
      setError(err?.response?.data?.message || err?.message || "Failed to load property")
    } finally {
      setLoading(false)
    }
  }

  // Get payment plan from first deal that has one
  const paymentPlan = useMemo(() => {
    if (!property?.deals) return null
    for (const deal of property.deals) {
      if (deal.paymentPlan) {
        const plan = deal.paymentPlan
        const installments = plan.installments || []
        const totalInstallments = installments.length
        const installmentAmount = totalInstallments > 0 ? installments[0].amount || 0 : 0

        // Calculate duration (months)
        let duration = "N/A"
        if (installments.length > 0) {
          const firstDate = new Date(installments[0].dueDate || Date.now())
          const lastDate = new Date(installments[installments.length - 1].dueDate || Date.now())
          const months = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
          duration = `${months} Months`
        }

        return {
          totalAmount: plan.totalAmount || 0,
          downPayment: plan.downPayment || 0,
          installments: totalInstallments,
          installmentAmount: installmentAmount,
          duration: duration,
          schedule: installments.map((inst, idx) => {
            let dateStr = "N/A"
            if (inst.dueDate) {
              const date = new Date(inst.dueDate)
              const day = String(date.getDate()).padStart(2, "0")
              const month = date.toLocaleDateString("en-US", { month: "short" })
              const year = date.getFullYear()
              dateStr = `${day} ${month} ${year}`
            }
            return {
              no: inst.installmentNumber || idx + 1,
              date: dateStr,
              amount: formatCurrency(inst.amount || 0),
              status: inst.status === "paid" ? "Paid" : inst.status === "overdue" ? "Overdue" : "Pending",
            }
          }),
        }
      }
    }
    return null
  }, [property])

  // Prepare deals data for report
  const dealsForReport = useMemo(() => {
    if (!property?.deals) return []
    return property.deals.map((deal) => {
      const totalReceived = deal.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const dealAmount = deal.dealAmount || deal.amount || 0
      return {
        title: deal.title || "N/A",
        contactName: deal.contactName || deal.client?.name || "N/A",
        amount: dealAmount,
        received: totalReceived,
        pending: Math.max(0, dealAmount - totalReceived),
        stage: deal.stage || "N/A",
      }
    })
  }, [property])

  const metrics = useMemo(() => {
    const unitsValue =
      typeof property?.units === "number" ? property.units : Array.isArray(property?.units) ? property?.units.length : 0
    return [
      {
        label: "Type",
        value: property?.type || "N/A",
        icon: Building2,
      },
      {
        label: "Status",
        value: property?.status || "N/A",
        icon: Receipt,
      },
      {
        label: "Address",
        value: property?.address || "Address not provided",
        icon: MapPin,
      },
      {
        label: "Total Area",
        value: formatArea(property?.totalArea),
        icon: Home,
      },
      {
        label: "Units",
        value: unitsValue ?? 0,
        icon: Users,
      },
      {
        label: "Sale Price",
        value:
          property?.salePrice !== undefined && property?.salePrice !== null
            ? `Rs ${Number(property.salePrice).toLocaleString("en-IN")}`
            : "N/A",
        icon: DollarSign,
      },
      {
        label: "Year Built",
        value: property?.yearBuilt || "N/A",
        icon: Receipt,
      },
    ]
  }, [property])

  const deals = useMemo(() => (Array.isArray(property?.deals) ? property?.deals : []), [property])
  const financeSummary = property?.financeSummary || {}

  const renderSkeleton = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )

  if (loading) {
    return renderSkeleton()
  }

  if (error || !property) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <p className="text-lg font-semibold text-foreground">Property Details</p>
          </div>
        </div>
        <Card className="p-6">
          <p className="text-destructive">{error || "Property not found"}</p>
          <Button className="mt-4" onClick={fetchProperty}>
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
          {property.propertyCode && (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              Code: {property.propertyCode}
            </span>
          )}
          {property.manualUniqueId && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              Manual ID: {property.manualUniqueId}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4">
            {property.imageUrl && (
              <img
                src={getPropertyImageSrc(propertyId, property.imageUrl)}
                alt={property.tid || "Property image"}
                className="w-full h-48 md:h-56 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none"
                }}
              />
            )}
          </div>
          <div className="md:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground leading-tight">{property.tid || "Property Details"}</h1>
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
            <p className="text-muted-foreground mt-1">{property.location || property.address || "No location provided"}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden p-0">
                  <DialogTitle className="sr-only">Property Report</DialogTitle>
                  <div className="h-[90vh] overflow-y-auto">
                    <PropertyReportHTML
                      property={{
                        ...property,
                        totalArea: property.totalArea,
                      }}
                      financeSummary={financeSummary}
                      paymentPlan={paymentPlan || undefined}
                      deals={dealsForReport}
                      hideActions={false}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.label} className="flex gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="text-base font-semibold text-foreground">{metric.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Basic Information</p>
              <p className="text-sm text-muted-foreground">Overview of the property details</p>
            </div>
            <Button onClick={() => router.push(`/ledger/property/${propertyId}`)} variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              Open Ledger
            </Button>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Property Type</span>
                <span className="font-medium text-foreground">{property.type || "N/A"}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">{property.status || "N/A"}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Year Built</span>
                <span className="font-medium text-foreground">{property.yearBuilt || "N/A"}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Total Area</span>
                <span className="font-medium text-foreground">{formatArea(property.totalArea)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium text-foreground">{property.address || "N/A"}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Units</span>
                <span className="font-medium text-foreground">
                  {typeof property.units === "number"
                    ? property.units
                    : Array.isArray(property.units)
                      ? property.units.length
                      : "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Sale Price</span>
                <span className="font-medium text-foreground">
                  {property.salePrice !== undefined && property.salePrice !== null
                    ? `Rs ${Number(property.salePrice).toLocaleString("en-IN")}`
                    : "N/A"}
                </span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Occupied Units</span>
                <span className="font-medium text-foreground">{property.occupied ?? 0}</span>
              </div>
            </div>
          </div>
          {(property.description || (property.amenities && property.amenities.length > 0)) && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                {property.description && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.description}</p>
                  </div>
                )}
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Finance Summary</p>
              <p className="text-sm text-muted-foreground">Latest financial breakdown</p>
            </div>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <span className="text-muted-foreground text-sm">Total Received</span>
              <span className="text-base font-semibold text-foreground">
                {formatCurrency(financeSummary.totalReceived || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <span className="text-muted-foreground text-sm">Total Expenses</span>
              <span className="text-base font-semibold text-foreground">
                {formatCurrency(financeSummary.totalExpenses || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <span className="text-muted-foreground text-sm">Pending Amount</span>
              <span className="text-base font-semibold text-foreground">
                {formatCurrency(financeSummary.pendingAmount || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <span className="text-muted-foreground text-sm">Entries</span>
              <span className="text-base font-semibold text-foreground">{financeSummary.entries ?? 0}</span>
            </div>
          </div>
        </Card>
      </div>

      {paymentPlan && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Payment Plan</p>
              <p className="text-sm text-muted-foreground">Installment schedule for this property</p>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <Separator className="my-4" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="text-sm font-semibold">{formatCurrency(paymentPlan.totalAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Down Payment</p>
              <p className="text-sm font-semibold">{formatCurrency(paymentPlan.downPayment)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Installments</p>
              <p className="text-sm font-semibold">{paymentPlan.installments}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Installment Amount</p>
              <p className="text-sm font-semibold">{formatCurrency(paymentPlan.installmentAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-semibold">{paymentPlan.duration}</p>
            </div>
          </div>
          {paymentPlan.schedule && paymentPlan.schedule.length > 0 && (
            <div className="rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentPlan.schedule.map((schedule, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{schedule.no}</TableCell>
                      <TableCell>{schedule.date}</TableCell>
                      <TableCell>{schedule.amount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            schedule.status === "Paid"
                              ? "default"
                              : schedule.status === "Overdue"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {schedule.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Running Deals</p>
            <p className="text-sm text-muted-foreground">Active opportunities linked to this property</p>
          </div>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No running deals
                  </TableCell>
                </TableRow>
              )}
              {deals.map((deal) => (
                <TableRow key={deal.id || deal.title}>
                  <TableCell className="font-medium text-foreground">{deal.title || "Untitled Deal"}</TableCell>
                  <TableCell>{deal.stage || "N/A"}</TableCell>
                  <TableCell>{formatCurrency(deal.amount || deal.dealAmount || 0)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{deal.contactName || deal.client?.name || "N/A"}</span>
                      {deal.contactPhone && <span className="text-xs text-muted-foreground">{deal.contactPhone}</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Ownership & Contacts</p>
            <p className="text-sm text-muted-foreground">Primary stakeholders and contact details</p>
          </div>
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex gap-3 rounded-lg border border-border/60 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Owner</p>
              <p className="text-foreground">{property.ownerName || "N/A"}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{property.ownerPhone || "No phone provided"}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-border/60 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Dealer</p>
              <p className="text-foreground">{property.dealerName || property.dealer?.name || "N/A"}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{property.dealerContact || property.dealer?.phone || "No contact provided"}</span>
              </div>
            </div>
          </div>
        </div>
        {property.subsidiaryOption && (
          <div className="mt-4 flex gap-3 rounded-lg border border-border/60 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Subsidiary</p>
              <p className="text-foreground">{property.subsidiaryOption.name || "N/A"}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Attachments Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Attachments</p>
            <p className="text-sm text-muted-foreground">Documents and images for this property</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="attachment-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              multiple
              onChange={handleAttachmentUpload}
              disabled={uploadingAttachments}
              className="hidden"
            />
            <Label htmlFor="attachment-upload" className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAttachments}
                onClick={() => document.getElementById('attachment-upload')?.click()}
              >
                {uploadingAttachments ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Add Attachment
                  </>
                )}
              </Button>
            </Label>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {attachments.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {attachments.map((attachment, idx) => {
              const isImage = attachment.fileType?.startsWith('image/')
              // Construct URL from fileUrl stored in database
              // fileUrl format: /secure-files/properties/{entityId}/{filename}
              let imageUrl = ''
              if (attachment.fileUrl) {
                // If fileUrl is already a full URL, use it
                if (attachment.fileUrl.startsWith('http://') || attachment.fileUrl.startsWith('https://')) {
                  imageUrl = attachment.fileUrl
                } else {
                  // Construct full URL from relative path
                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
                  const cleanPath = attachment.fileUrl.replace(/^\/api/, '')
                  imageUrl = `${baseUrl.replace(/\/api\/?$/, '')}/api${cleanPath}`
                }
              } else if (attachment.fileName) {
                // Fallback: use old format if fileUrl is missing
                const trackingId = String(propertyId)
                const entity = 'properties'
                imageUrl = apiService.files.getViewUrl(entity, trackingId, attachment.fileName)
              }

              const handleViewDocument = () => {
                setSelectedDocument({
                  id: attachment.id,
                  url: imageUrl, // Pass the full generic URL
                  name: attachment.fileName,
                  fileType: attachment.fileType
                })
                setDocumentViewerOpen(true)
              }

              const handleImageView = () => {
                const imageAttachments = attachments.filter(a => a.fileType?.startsWith('image/'))
                const imageIndex = imageAttachments.findIndex(a => a.id === attachment.id)
                setLightboxIndex(imageIndex >= 0 ? imageIndex : 0)
                setLightboxOpen(true)
              }

              return (
                <div
                  key={attachment.id || idx}
                  className="relative group"
                >
                  {isImage ? (
                    <div className="aspect-square rounded-lg border overflow-hidden bg-muted cursor-pointer" onClick={handleImageView}>
                      <img
                        src={imageUrl}
                        alt={attachment.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          ; (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <FileText className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square rounded-lg border bg-muted flex flex-col items-center justify-center p-2">
                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-center text-muted-foreground truncate w-full px-1">
                        {attachment.fileName}
                      </p>
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      {isImage ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageView()
                          }}
                          className="bg-white/90 hover:bg-white text-gray-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDocument()
                          }}
                          className="bg-white/90 hover:bg-white text-gray-900"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Use generic download URL
                          const downloadUrl = apiService.files.getDownloadUrl('properties', String(propertyId), attachment.fileName)
                          
                          const link = document.createElement('a')
                          link.href = downloadUrl
                          link.download = attachment.fileName
                          link.target = '_blank'
                          link.rel = 'noopener noreferrer'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                        className="bg-white/90 hover:bg-white text-gray-900"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 truncate" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No attachments yet</p>
            <p className="text-xs text-muted-foreground">Click "Add Attachment" to upload documents or images</p>
          </div>
        )}
      </Card>

      {/* Image Lightbox */}
      {attachments.length > 0 && (
        <ImageLightbox
          images={attachments
            .filter(a => a.fileType?.startsWith('image/'))
            .map(a => ({
              url: apiService.files.getViewUrl('properties', String(propertyId), a.fileName),
              name: a.fileName,
            }))}
          currentIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={(index) => {
            const imageAttachments = attachments.filter(a => a.fileType?.startsWith('image/'))
            if (index >= 0 && index < imageAttachments.length) {
              setLightboxIndex(index)
            }
          }}
        />
      )}

      {/* Document Viewer */}
      <DocumentViewer
        open={documentViewerOpen}
        onClose={() => {
          setDocumentViewerOpen(false)
          setSelectedDocument(null)
        }}
        document={selectedDocument}
      />

      {/* Accounts Footer Bar */}
      {propertyId && (
        <AccountsFooterBar
          entityType="property"
          entityId={String(propertyId)}
          onUpdate={fetchProperty}
        />
      )}
    </div>
  )
}



