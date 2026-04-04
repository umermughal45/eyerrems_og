"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, DollarSign, User, Building, Calendar, FileText, Loader2, CreditCard, Eye, Edit, Save, X } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { DealTimeline } from "./deal-timeline"
import { DocumentViewer } from "@/components/shared/document-viewer"
import { AccountsFooterBar } from "@/components/shared/accounts-footer-bar"
import { useDropdownOptions } from "@/hooks/use-dropdowns"

// Utility functions for frontend
const formatCurrency = (amount: number) => {
  return `Rs ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const calculateDealCompletionStatus = (dealAmount: number, totalPaid: number) => {
  const completionPercentage = dealAmount > 0 ? (totalPaid / dealAmount) * 100 : 0
  const remaining = Math.max(0, dealAmount - totalPaid)
  const isCompleted = remaining <= 0.01

  return {
    isCompleted,
    completionPercentage: Math.min(100, Math.max(0, completionPercentage)),
    remaining,
  }
}

interface DealDetailViewProps {
  dealId: string
}

export function DealDetailView({ dealId }: DealDetailViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [deal, setDeal] = useState<any>(null)
  const [attachments, setAttachments] = useState<Array<{ id?: string; url: string; name: string; fileType: string; size?: number }>>([])
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; url: string; name: string; fileType: string } | null>(null)

  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const { options: stageOptions } = useDropdownOptions("deal.stage")
  const { options: statusOptions } = useDropdownOptions("deal.status")

  useEffect(() => {
    loadDeal()
  }, [dealId])

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
      const response: any = await apiService.deals?.getById?.(dealId)
      
      // Handle different response structures
      let dealData = null
      if (response?.data) {
        // Check if response.data has a nested data property (backend returns { success: true, data: {...} })
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

      // Validate deal data exists
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
      setDeal(null) // Clear deal state on error
    } finally {
      setLoading(false)
    }
  }

  // Load attachments whenever deal data changes
  useEffect(() => {
    if (deal) {
      loadAttachments()
    }
  }, [deal])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading deal details...</p>
        </div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center py-12">
          <p className="text-destructive text-lg font-semibold mb-2">Deal not found</p>
          <p className="text-muted-foreground">The deal with ID "{dealId}" could not be loaded.</p>
          <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => loadDeal()}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Calculate payment summary
  const totalPaid = deal.totalPaid || deal.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0
  const dealAmount = deal.dealAmount || 0
  const completionStatus = calculateDealCompletionStatus(dealAmount, totalPaid)

  // Payment plan summary
  const paymentPlan = deal.paymentPlan
  const paymentPlanSummary = paymentPlan?.summary || {
    totalExpected: paymentPlan?.totalExpected || 0,
    totalPaid: paymentPlan?.totalPaid || 0,
    remaining: paymentPlan?.remaining || 0,
    status: paymentPlan?.status || "Pending",
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{deal.property?.tid || deal.title || deal.dealCode || "Deal"}</h1>
            <p className="text-muted-foreground">
              {deal.dealCode && `Code: ${deal.dealCode}`} • {deal.client?.name || "No Client"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/details/deals/${dealId}/payment-plan`)}>
            <CreditCard className="mr-2 h-4 w-4" />
            Payment Plan
          </Button>
          <Button variant="outline" onClick={() => router.push(`/finance/ledger/deal/${dealId}`)}>
            <FileText className="mr-2 h-4 w-4" />
            View Ledger
          </Button>
        </div>
      </div>

      {/* Progress Bar Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Progress</CardTitle>
          <CardDescription>Track deal completion based on payments received</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deal Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(dealAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Remaining</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(completionStatus.remaining)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion</span>
                <span>{completionStatus.completionPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={completionStatus.completionPercentage} className="h-3" />
              {completionStatus.isCompleted && (
                <div className="flex items-center gap-2 text-green-600">
                  <Badge variant="default">Completed</Badge>
                  <span className="text-sm">Deal is fully paid</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      {deal.financialSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Complete financial overview of the deal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deal Amount</p>
                <p className="text-xl font-bold">{formatCurrency(deal.financialSummary.dealAmount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(deal.financialSummary.totalPaid || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Remaining Balance</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(deal.financialSummary.remainingBalance || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Completion</p>
                <p className="text-xl font-bold">{deal.financialSummary.completionPercentage?.toFixed(1) || 0}%</p>
              </div>
            </div>
            {deal.financialSummary.commissionAmount > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Commission Rate</p>
                    <p className="text-lg font-semibold">{deal.financialSummary.commissionRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Commission Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(deal.financialSummary.commissionAmount || 0)}</p>
                  </div>
                </div>
              </div>
            )}
            {deal.financialSummary.totalPayments > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Total Payments: {deal.financialSummary.totalPayments}</p>
                {deal.financialSummary.lastPaymentDate && (
                  <p className="text-sm text-muted-foreground">
                    Last Payment: {new Date(deal.financialSummary.lastPaymentDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Plan Summary */}
      {paymentPlan && paymentPlanSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Plan Summary</CardTitle>
            <CardDescription>Installment-based payment schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Expected</p>
                <p className="text-xl font-bold">{formatCurrency(paymentPlanSummary.totalExpected)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(paymentPlanSummary.totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Remaining</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(paymentPlanSummary.remaining)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={paymentPlanSummary.status === "Fully Paid" ? "default" : "secondary"}>
                  {paymentPlanSummary.status}
                </Badge>
              </div>
            </div>
            {paymentPlanSummary.downPayment > 0 && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Down Payment</p>
                <p className="text-lg font-semibold">{formatCurrency(paymentPlanSummary.downPayment)}</p>
              </div>
            )}
            {paymentPlanSummary.installments && paymentPlanSummary.installments.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold mb-2">Installments ({paymentPlanSummary.numberOfInstallments})</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Paid: </span>
                    <span className="font-semibold text-green-600">{paymentPlanSummary.paidInstallments}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pending: </span>
                    <span className="font-semibold">{paymentPlanSummary.pendingInstallments}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Overdue: </span>
                    <span className="font-semibold text-red-600">{paymentPlanSummary.overdueInstallments}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deal Information */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Deal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{deal.client?.name || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Property</p>
                <p className="font-medium">{deal.property?.name || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Deal Date</p>
                <p className="font-medium">
                  {deal.dealDate ? new Date(deal.dealDate).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={deal.stage === "closed-won" ? "default" : "secondary"}>{deal.stage || "N/A"}</Badge>
              <Badge variant={deal.status === "closed" ? "default" : "outline"}>{deal.status || "N/A"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Deal Amount</p>
                <p className="font-medium">{formatCurrency(dealAmount)}</p>
              </div>
            </div>
            {deal.commissionRate > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="font-medium">{deal.commissionRate}%</p>
              </div>
            )}
            {deal.commissionAmount > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Commission Amount</p>
                <p className="font-medium">{formatCurrency(deal.commissionAmount)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Timeline</CardTitle>
          <CardDescription>History of all payments and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <DealTimeline deal={deal} onRefresh={loadDeal} />
        </CardContent>
      </Card>

      {/* Attachments Section */}
      {attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>Documents and files related to this deal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {attachments.map((attachment, idx) => {
                const isImage = attachment.fileType?.startsWith('image/')
                // URL is already constructed in loadAttachments
                const imageUrl = attachment.url

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
                          src={imageUrl}
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
                          <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
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
      <AccountsFooterBar
        entityType="deal"
        entityId={dealId}
        onUpdate={loadDeal}
      />
    </div>
  )
}

