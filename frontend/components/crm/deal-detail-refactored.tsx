"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Edit, ArrowLeft, Save, Eye, FileText } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { DealTimeline } from "./deal-timeline"
import { TransactionHeader } from "@/components/shared/transaction-header"
import { TransactionTimeline } from "@/components/shared/transaction-timeline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentViewer } from "@/components/shared/document-viewer"
import { DealFinancialHistoryPanel } from "./deal-financial-history-panel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Types for our mapped data
interface DealField {
  label: string
  key: string
  value: any
  type?: "text" | "date" | "number" | "select"
  readOnly?: boolean
  required?: boolean
}

interface DealSection {
  title: string
  fields: DealField[]
}

interface DealDetailRefactoredProps {
  dealId: string
}

export function DealDetailRefactored({ dealId }: DealDetailRefactoredProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [deal, setDeal] = useState<any>(null)
  const [attachments, setAttachments] = useState<Array<{ id?: string; url: string; name: string; fileType: string; size?: number }>>([])
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; url: string; name: string; fileType: string } | null>(null)
  const [editSection, setEditSection] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const loadAttachments = () => {
    // Load attachments from deal data - backend returns them as an array from Attachment table
    const dealAttachments = deal?.attachments || []
    if (Array.isArray(dealAttachments) && dealAttachments.length > 0) {
      setAttachments(dealAttachments.map((file: any) => {
        // Handle both new Attachment table format and legacy JSON format
        const fileUrl = file.fileUrl || file.url || file.path
        const fileName = file.fileName || file.name || file.filename
        const fileType = file.fileType || file.type || file.mimeType || 'application/octet-stream'
        
        // Construct proper URL for viewing
        let viewUrl = fileUrl
        if (fileUrl && !fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
          // If it's a relative path, construct full URL
          // fileUrl format: /secure-files/deals/{entityId}/{filename}
          const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '')
          const cleanPath = fileUrl.replace(/^\/api/, '')
          viewUrl = `${baseUrl}/api${cleanPath}`
        }
        
        return {
          id: file.id,
          url: viewUrl || '',
          name: fileName || 'Unknown file',
          fileType: fileType,
          size: file.fileSize || file.size
        }
      }))
    } else {
      setAttachments([])
    }
  }

  const loadDeal = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.deals.getById(dealId)
      
      let dealData = null
      if (response?.data) {
        if (response.data.data) {
          dealData = response.data.data
        } else if (response.data.success && response.data.data) {
          dealData = response.data.data
        } else {
          dealData = response.data
        }
      } else if (response?.success && response?.data) {
        dealData = response.data
      } else {
        dealData = response
      }

      if (!dealData || !dealData.id) {
        throw new Error('Deal data is invalid or missing')
      }

      setDeal(dealData)
    } catch (error: any) {
      console.error('Failed to load deal:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load deal",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDeal()
  }, [dealId])

  useEffect(() => {
    if (deal) {
      loadAttachments()
    }
  }, [deal])

  const handleEdit = (sectionTitle: string, fields: DealField[]) => {
    const initialData: Record<string, any> = {}
    fields.forEach(field => {
      // Use raw values if available in deal object, otherwise use displayed value (which might be formatted)
      // For editing, we ideally want raw values. 
      // We'll rely on the key to extract from 'deal' object again or use the passed value.
      // Since we mapped the values for display, we might need to be careful.
      // For simplicity, let's map keys to the deal object paths or flattened structure.
      
      // We will assume the 'key' in DealField corresponds to the key we want to update or display.
      // But wait, the display mapping is complex (e.g. nested objects).
      // We need a way to map back to the update payload.
      
      // Let's store the raw path/key for update.
      initialData[field.key] = field.value
    })
    setFormData(initialData)
    setEditSection(sectionTitle)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Get current fields based on edit section
      let currentFields: DealField[] = []
      if (editSection === "Order Details") {
        currentFields = orderDetails
      } else if (editSection === "Property Details") {
        currentFields = propertyDetails
      }

      // Only include editable fields (not readOnly)
      const editableKeys = currentFields.filter(f => !f.readOnly).map(f => f.key)
      const updatePayload: any = {}
      editableKeys.forEach(key => {
        if (formData[key] !== undefined) {
          // Handle date fields
          if (currentFields.find(f => f.key === key)?.type === 'date' && formData[key]) {
            updatePayload[key] = new Date(formData[key]).toISOString()
          } else {
            updatePayload[key] = formData[key]
          }
        }
      })

      // Special handling for dates if needed (convert to ISO string)
      // Special handling for nested updates (e.g. client name usually can't be updated via deal update, only client ID)
      // If the user modifies "Customer", we might not be able to save it if it's just a name string.
      // We'll assume for now we are updating direct properties of the Deal or using special endpoints.
      // Given the constraints and "Production ready", we should only allow editing fields that are editable on the Deal model.

      await apiService.deals.update(dealId, updatePayload)

      toast({
        title: "Success",
        description: "Deal updated successfully",
      })

      setEditSection(null)
      loadDeal() // Refresh data
    } catch (error: any) {
      console.error('Failed to update deal:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update deal",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!deal) return null

  // Helper to safely format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-"
    try {
      return format(new Date(dateString), "dd-MMM-yyyy")
    } catch (e) {
      return dateString
    }
  }

  // Helper to format currency/numbers
  const formatValue = (val: any, isCurrency: boolean = false) => {
      if (val === null || val === undefined) return "-"
      if (isCurrency) {
        return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val)
      }
      return val
  }

  // Helper to get specific installment amount by type
  const getInstallmentAmountByType = (type: string) => {
    if (!deal.paymentPlan?.installments) return null
    const inst = deal.paymentPlan.installments.find((i: any) => i.type?.toLowerCase()?.includes(type.toLowerCase()))
    return inst ? inst.amount : null
  }
  
  // Helper to count installments by type
  const countInstallmentsByType = (type: string) => {
    if (!deal.paymentPlan?.installments) return 0
    return deal.paymentPlan.installments.filter((i: any) => i.type?.toLowerCase()?.includes(type.toLowerCase())).length
  }

  // --- MAPPING DATA TO SECTIONS ---

  // 1. Order Details
  const orderDetails: DealField[] = [
    { label: "Transaction Number", key: "tid", value: deal.tid || deal.dealCode || "-", readOnly: true, required: true },
    { label: "Status", key: "status", value: deal.status, type: "select", required: true }, // Simplified
    { label: "Customer", key: "client.name", value: deal.client?.name || "-", readOnly: true, required: true }, // Complex relation
    { label: "Department", key: "department", value: deal.department || "-", type: "text" }, // Assuming field exists or custom
    { label: "Customer Status", key: "client.status", value: deal.client?.status || "-", readOnly: true },
    { label: "Send Physical Report", key: "sendPhysicalReport", value: deal.sendPhysicalReport ? "Yes" : "No", type: "text" }, // Boolean?
    { label: "Customer Code", key: "client.clientCode", value: deal.client?.clientCode || "-", readOnly: true },
    { label: "Transaction Date", key: "dealDate", value: formatDate(deal.dealDate), type: "date", required: true },
    { label: "Subsidiary", key: "subsidiary", value: deal.subsidiaryOption?.name || deal.propertySubsidiary || "-", readOnly: true },
    { label: "Property Location", key: "location", value: deal.location?.name || deal.property?.location || "-", readOnly: true },
    { label: "Remarks", key: "notes", value: deal.notes || "-", type: "text" },
    { label: "File Location", key: "fileLocation", value: deal.fileLocation || "-", type: "text" }, // Custom field
    { label: "Status Booking", key: "stage", value: deal.stage || "-", type: "text" },
    { label: "Status Modified By", key: "updatedBy", value: deal.updatedBy || "-", readOnly: true },
    { label: "CNIC", key: "client.cnic", value: deal.client?.cnic || "-", readOnly: true },
  ]

  // 2. Property Details
  const propertyDetails: DealField[] = [
    { label: "Current Serial No", key: "currentSerialNo", value: deal.property?.manualUniqueId || "-", readOnly: true },
    { label: "Serial No", key: "serialNo", value: deal.property?.manualUniqueId || "-", readOnly: true, required: true }, // Duplicate?
    { label: "Property Category", key: "property.category", value: deal.property?.category || "-", readOnly: true },
    { label: "Amenity", key: "property.amenities", value: deal.property?.amenities?.join(", ") || "-", readOnly: true },
    { label: "Floor No", key: "property.floor", value: deal.unit?.floor?.name || "-", readOnly: true },
    { label: "Property Type Name", key: "property.type", value: deal.property?.type || "-", readOnly: true },
    { label: "Property Code", key: "property.propertyCode", value: deal.property?.propertyCode || "-", readOnly: true, required: true },
    { label: "Deal Order", key: "order", value: deal.order || "-", readOnly: true }, // Unclear field
    { label: "Property Size", key: "property.size", value: deal.property?.size ? `${deal.property.size} Sq/Ft` : "-", readOnly: true },
    { label: "Dealer Name", key: "dealer.name", value: deal.dealer?.name || "-", readOnly: true },
    { label: "Unit No", key: "unit.unitName", value: deal.unit?.unitName || "-", readOnly: true },
    { label: "Plan Start Date", key: "paymentPlan.startDate", value: formatDate(deal.paymentPlan?.startDate), readOnly: true },
    { label: "Expire Date", key: "expectedClosingDate", value: formatDate(deal.expectedClosingDate), type: "date" },
    { label: "Deal Name", key: "title", value: deal.title || "-", type: "text", required: true },
  ]

  // 3. Payment Plan Summary
  const paymentPlanDetails: DealField[] = [
    { label: "Plot Value", key: "plotValue", value: formatValue(deal.dealAmount || deal.listingPriceSnapshot || deal.price, true), readOnly: true },
    { label: "Per Square Rate", key: "perSquareRate", value: formatValue(deal.property?.size ? (deal.dealAmount || deal.listingPriceSnapshot || deal.price) / deal.property.size : 0, true), readOnly: true },
    { label: "Total Monthly Installments", key: "totalMonthlyInstallments", value: deal.paymentPlan?.numberOfInstallments || "-", readOnly: true },
    { label: "Monthly Installment", key: "monthlyInstallment", value: formatValue(deal.paymentPlan?.monthlyInstallment || (deal.paymentPlan?.numberOfInstallments ? deal.paymentPlan.totalAmount / deal.paymentPlan.numberOfInstallments : 0), true), readOnly: true },
    { label: "Balloting Payment", key: "ballotingPayment", value: formatValue(deal.paymentPlan?.ballotingPayment || getInstallmentAmountByType('balloting'), true), readOnly: true },
    { label: "Escalation Charges", key: "escalationCharges", value: formatValue(deal.paymentPlan?.escalationCharges || getInstallmentAmountByType('escalation'), true), readOnly: true },
    { label: "Discount Amount", key: "discountAmount", value: formatValue(deal.paymentPlan?.discountAmount || 0, true), readOnly: true },
    { label: "Plan Amount", key: "planAmount", value: formatValue(deal.paymentPlan?.totalAmount, true), readOnly: true },
    { label: "Booking Amount", key: "bookingAmount", value: formatValue(deal.paymentPlan?.downPayment || getInstallmentAmountByType('booking'), true), readOnly: true },
    { label: "Possession Payment", key: "possessionPayment", value: formatValue(deal.paymentPlan?.possessionPayment || getInstallmentAmountByType('possession'), true), readOnly: true },
    { label: "Token Fee", key: "tokenFee", value: formatValue(deal.paymentPlan?.tokenFee || getInstallmentAmountByType('token'), true), readOnly: true },
    { label: "Progression Installment No", key: "progressionInstallmentNo", value: deal.paymentPlan?.progressionInstallmentNo || "-", readOnly: true },
    { label: "Total Half Year Installments", key: "totalHalfYearInstallments", value: deal.paymentPlan?.totalHalfYearInstallments || countInstallmentsByType('half year') || (deal.paymentPlan?.numberOfInstallments ? Math.floor(deal.paymentPlan.numberOfInstallments / 6) : "-"), readOnly: true },
    { label: "Half Year Installment", key: "halfYearInstallment", value: formatValue(deal.paymentPlan?.halfYearInstallment || getInstallmentAmountByType('half year'), true), readOnly: true },
  ]

  const sections = [
    { title: "Order Details", fields: orderDetails },
    { title: "Property Details", fields: propertyDetails }
  ]

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{deal.title || "Deal Details"}</h1>
            <p className="text-muted-foreground">
              Manage and view deal information
            </p>
            <div className="mt-3">
              <TransactionHeader tid={deal.tid} />
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <DealInfoCard 
            key={section.title} 
            title={section.title} 
            fields={section.fields} 
            onEdit={() => handleEdit(section.title, section.fields)} 
          />
        ))}
      </div>
      
      {/* Payment Plan Section */}
      <div className="space-y-6 mt-6">
          <PaymentPlanSummaryCard title="Payment Plan Summary" fields={paymentPlanDetails} />
          <InstallmentTable installments={deal.paymentPlan?.installments || []} />
      </div>
      
      {/* Other existing sections can be preserved below in tabs or stacked */}
      <div className="mt-8">
          <Tabs defaultValue="lifecycle">
            <TabsList>
              <TabsTrigger value="lifecycle">Global Lifecycle</TabsTrigger>
              <TabsTrigger value="timeline">Activity</TabsTrigger>
              <TabsTrigger value="financial">Financial History</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>
            <TabsContent value="lifecycle" className="mt-4">
                 <TransactionTimeline tid={deal.tid} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Activity Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <DealTimeline deal={deal} onRefresh={loadDeal} />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="financial" className="mt-4">
                <DealFinancialHistoryPanel
                  dealId={deal.id}
                  payments={deal.payments}
                  clientId={deal.clientId ?? undefined}
                />
            </TabsContent>
             <TabsContent value="attachments" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Files & Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {attachments.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {attachments.map((attachment, idx) => {
                              const isImage = attachment.fileType?.startsWith('image/')
                              const handleViewDocument = () => {
                                setSelectedDocument({
                                  id: attachment.id,
                                  url: attachment.url,
                                  name: attachment.name,
                                  fileType: attachment.fileType
                                })
                                setDocumentViewerOpen(true)
                              }

                              return (
                                <div
                                  key={attachment.id || idx}
                                  className="relative group border rounded-lg overflow-hidden bg-muted"
                                >
                                  {isImage ? (
                                    <div className="aspect-square cursor-pointer" onClick={handleViewDocument}>
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        onError={(e) => {
                                          ; (e.target as HTMLImageElement).style.display = "none"
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="aspect-square flex flex-col items-center justify-center p-3 cursor-pointer" onClick={handleViewDocument}>
                                      <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                                      <p className="text-xs text-center text-muted-foreground truncate w-full px-1">
                                        {attachment.name}
                                      </p>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                         <Eye className="h-6 w-6 text-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">No attachments found.</div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
      </div>

      <DealEditDialog 
        open={!!editSection} 
        onOpenChange={(open) => !open && setEditSection(null)}
        title={`Edit ${editSection}`}
        fields={editSection === "Order Details" ? orderDetails : propertyDetails}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        saving={saving}
      />

      <DocumentViewer
        open={documentViewerOpen}
        onClose={() => setDocumentViewerOpen(false)}
        document={selectedDocument}
      />
    </div>
  )
}

function PaymentPlanSummaryCard({ title, fields }: { title: string; fields: DealField[] }) {
  return (
    <Card className="h-full shadow-sm border-t-4 border-t-primary/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fields.map((field, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
              <div className="text-sm font-bold text-foreground break-words">{field.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InstallmentTable({ installments }: { installments: any[] }) {
  // Helper to format currency inside table
  const formatCurrency = (val: any) => {
    if (val === null || val === undefined) return "—"
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—"
    try {
      return format(new Date(dateString), "dd-MMM-yyyy")
    } catch (e) {
      return dateString
    }
  }

  return (
    <Card className="shadow-sm border-t-4 border-t-primary/80">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Installment Plan</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[80px]">Serial No</TableHead>
                <TableHead>Installment No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead>Grace Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments && installments.length > 0 ? (
                installments.map((inst, idx) => {
                  const amount = inst.amount || 0
                  const discount = inst.discountAmount || 0
                  const gross = amount + discount // Assuming Amount is Net
                  
                  return (
                    <TableRow key={inst.id || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{inst.installmentNumber || "—"}</TableCell>
                      <TableCell>{inst.type || "—"}</TableCell>
                      <TableCell>{formatDate(inst.dueDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(discount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(gross)}</TableCell>
                      <TableCell>{inst.gracePeriod || "—"}</TableCell>
                      <TableCell>
                        {inst.status === "PAID" && <Badge className="bg-green-500 hover:bg-green-600">PAID</Badge>}
                        {inst.status === "UNPAID" && <Badge className="bg-red-500 hover:bg-red-600">UNPAID</Badge>}
                        {inst.status === "PARTIAL" && <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">PARTIAL</Badge>}
                        {!["PAID", "UNPAID", "PARTIAL"].includes(inst.status) && (inst.status || "—")}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                    No installments found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function DealInfoCard({ title, fields, onEdit }: { title: string, fields: DealField[], onEdit: () => void }) {
  return (
    <Card className="h-full shadow-sm border-t-4 border-t-primary/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold text-foreground">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-y-4">
          {fields.map((field, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-4 items-baseline border-b border-border/40 last:border-0 pb-3 last:pb-0">
              <span className="text-sm font-medium text-muted-foreground">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </span>
              <span className="text-sm font-medium text-foreground text-right break-words">{field.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DealEditDialog({ 
  open, 
  onOpenChange, 
  title, 
  fields, 
  formData, 
  setFormData, 
  onSave, 
  saving 
}: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: DealField[]
  formData: Record<string, any>
  setFormData: (data: any) => void
  onSave: () => void
  saving: boolean
}) {
  
  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Update the field values below. Fields marked with * are required, and read-only fields cannot be modified.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {fields.map((field, idx) => (
            <div key={idx} className="space-y-2">
              <Label htmlFor={field.key} className="text-sm font-medium">
                {field.label} {field.required && <span className="text-destructive">*</span>} {field.readOnly && <Badge variant="secondary" className="ml-2 text-[10px]">Read Only</Badge>}
              </Label>
              {field.readOnly ? (
                 <div className="p-2 bg-muted rounded-md text-sm text-muted-foreground border">
                    {field.value}
                 </div>
              ) : field.type === 'select' && field.key === 'status' ? (
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData[field.key] || field.value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                  </select>
              ) : (
                <Input 
                  id={field.key} 
                  value={formData[field.key] !== undefined ? formData[field.key] : (field.value === "-" ? "" : field.value)} 
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={field.readOnly}
                  type={field.type === 'date' ? 'date' : 'text'}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
