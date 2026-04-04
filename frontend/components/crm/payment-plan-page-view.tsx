"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, CalendarIcon, Plus, Trash2, Loader2, Save, Edit, DollarSign, FileText, Download, Receipt, Upload, X, ImageIcon, Printer } from "lucide-react"
import { ReceiptCreationDialog } from "./receipt-creation-dialog"
import { ClientLedgerView } from "./client-ledger-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useDropdownOptions } from "@/hooks/use-dropdowns"

interface PaymentPlanPageViewProps {
  dealId: string
}

interface InstallmentRow {
  id: number
  installmentNumber: number
  type: string // monthly, quarterly, yearly, custom
  amount: number
  period: string
  dueDate: Date | null
  paymentMode: string
  notes: string
  paidAmount?: number
  status?: string
}

export function PaymentPlanPageView({ dealId }: PaymentPlanPageViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deal, setDeal] = useState<any>(null)
  const [paymentPlan, setPaymentPlan] = useState<any>(null)
  const [apiSummary, setApiSummary] = useState<any>(null)
  const [isEditMode, setIsEditMode] = useState(false) // Track if we're editing the plan

  // Form state - CREATE MODE or EDIT MODE
  const [downPaymentType, setDownPaymentType] = useState<"percentage" | "manual">("manual")
  const [downPaymentPercentage, setDownPaymentPercentage] = useState<string>("")
  const [downPaymentAmount, setDownPaymentAmount] = useState<string>("")
  // Get installment types from advance options
  const { options: installmentTypeOptions } = useDropdownOptions("installment.type")

  const [selectedInstallmentType, setSelectedInstallmentType] = useState<string>("")
  const [numberOfInstallments, setNumberOfInstallments] = useState(3)
  const [installmentsInput, setInstallmentsInput] = useState<string>("3")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [installments, setInstallments] = useState<InstallmentRow[]>([]) // Form installments (always empty on load)
  const [viewInstallments, setViewInstallments] = useState<InstallmentRow[]>([]) // View installments (for existing plans)
  const [notes, setNotes] = useState("")

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentRow | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMode, setPaymentMode] = useState("cash")
  const [paymentDate, setPaymentDate] = useState<Date>(new Date())
  const [paymentReferenceNumber, setPaymentReferenceNumber] = useState("")
  const [paymentAttachments, setPaymentAttachments] = useState<Array<{ url: string; name: string; mimeType?: string }>>([])
  const [uploadingPaymentAttachments, setUploadingPaymentAttachments] = useState(false)

  // Report generation
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    loadDeal()
  }, [dealId])

  // ALWAYS OPEN IN CREATE MODE - DO NOT LOAD PREVIOUS VALUES INTO FORM
  const loadDeal = async () => {
    try {
      setLoading(true)

      // Load deal only
      let dealResponse
      if (apiService.deals?.getById) {
        try {
          dealResponse = await apiService.deals.getById(dealId)
        } catch (error) {
          console.error('Failed to load deal via apiService:', error)
        }
      }

      if (!dealResponse) {
        const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api` : 'https://eyer-rems-v1-production-f00e.up.railway.app/api'
        const fetchResponse = await fetch(`${apiBaseUrl}/crm/deals/${dealId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!fetchResponse.ok) {
          const contentType = fetchResponse.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await fetchResponse.json()
            throw new Error(errorData.error || errorData.message || `Failed to load deal: ${fetchResponse.status}`)
          } else {
            const text = await fetchResponse.text()
            throw new Error(`Server error (${fetchResponse.status}): ${text.substring(0, 200)}`)
          }
        }

        const contentType = fetchResponse.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await fetchResponse.text()
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 200)}`)
        }

        dealResponse = await fetchResponse.json()
      }

      // Handle different response structures - backend returns { success: true, data: {...} }
      let dealData = null
      if (dealResponse?.data) {
        // Check if response.data has a nested data property
        if (dealResponse.data.data) {
          dealData = dealResponse.data.data
        } else if (dealResponse.data.success && dealResponse.data.data) {
          dealData = dealResponse.data.data
        } else {
          dealData = dealResponse.data
        }
      } else if (dealResponse?.success && dealResponse?.data) {
        dealData = dealResponse.data
      } else {
        dealData = dealResponse
      }

      // Validate deal data exists and has required fields
      if (!dealData || !dealData.id) {
        throw new Error('Deal data is invalid or missing')
      }

      // Validate dealAmount exists
      if (!dealData.dealAmount || dealData.dealAmount <= 0) {
        console.warn('Deal amount is missing or invalid:', dealData.dealAmount)
        toast({
          title: "Warning",
          description: "Deal amount is missing or invalid. Please update the deal before creating a payment plan.",
          variant: "destructive",
        })
      }

      setDeal(dealData)

      // Check if payment plan exists (for display only in view section, NOT for form editing)
      try {
        const planResponse: any = await apiService.paymentPlans.getByDealId(dealId)
        const responseData = planResponse?.data || planResponse

        // Debug: log the response structure
        console.log('Payment plan response:', { planResponse, responseData })

        // Handle both response structures: { success: true, data: {...} } or direct data
        const planData = responseData?.success ? responseData.data : responseData

        if (planData) {
          // Extract the actual payment plan object - it's nested in paymentPlan property
          // The response structure from backend is: { paymentPlan: {id, ...}, installments: [...], summary: {...} }
          // So we need to extract planData.paymentPlan which has the id
          const actualPlan = planData.paymentPlan || planData

          // Always use planData.paymentPlan if it exists (it has the id)
          if (planData.paymentPlan && planData.paymentPlan.id) {
            setPaymentPlan(planData.paymentPlan)
          } else if (actualPlan.id) {
            setPaymentPlan(actualPlan)
          } else {
            // Fallback: try to find id anywhere in the structure
            console.warn('Payment plan structure unexpected:', planData)
            setPaymentPlan(planData)
          }

          // Load installments for VIEW section only (NOT for form - form is always in create mode)
          const installments = planData.installments || actualPlan.installments || []
          if (installments.length > 0) {
            setViewInstallments(
              installments.map((inst: any) => ({
                id: inst.id || Date.now() + Math.random(),
                installmentNumber: inst.installmentNumber,
                type: inst.type || 'custom', // Each installment has its own type
                amount: inst.amount,
                period: inst.period || "",
                dueDate: inst.dueDate ? new Date(inst.dueDate) : null,
                paymentMode: inst.paymentMode || "bank",
                notes: inst.notes || "",
                paidAmount: inst.paidAmount || 0,
                status: inst.status,
              }))
            )
          } else {
            setViewInstallments([])
          }

          // Set summary if available
          if (planData.summary) {
            setApiSummary(planData.summary)
          }
        }
      } catch (error) {
        // No payment plan exists - this is fine, we're in create mode
        console.log('No payment plan found (this is OK for new deals):', error)
        setPaymentPlan(null)
        setViewInstallments([])
        setApiSummary(null)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load deal",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Calculate down payment amount
  const calculatedDownPayment = () => {
    if (downPaymentType === "percentage") {
      const percentage = parseFloat(downPaymentPercentage) || 0
      if (percentage > 0 && percentage <= 100 && deal?.dealAmount) {
        return Math.round((deal.dealAmount * percentage / 100) * 100) / 100
      }
      return 0
    } else {
      return parseFloat(downPaymentAmount) || 0
    }
  }

  // Calculate remaining amount after down payment
  const remainingAmount = () => {
    const downPayment = calculatedDownPayment()
    return Math.max(0, (deal?.dealAmount || 0) - downPayment)
  }


  // Generate installments based on selected type
  const handleApplyInstallmentType = () => {
    if (!selectedInstallmentType) {
      toast({
        title: "Error",
        description: "Please select an installment type",
        variant: "destructive",
      })
      return
    }

    if (!deal || (deal.dealAmount || 0) <= 0) {
      toast({
        title: "Error",
        description: "Deal amount is required",
        variant: "destructive",
      })
      return
    }

    if (numberOfInstallments <= 0) {
      toast({
        title: "Error",
        description: "Number of installments must be greater than 0",
        variant: "destructive",
      })
      return
    }

    const newInstallments: InstallmentRow[] = []
    // Determine months per installment based on type value
    const typeValue = selectedInstallmentType.toLowerCase()
    const monthsPerInstallment = typeValue.includes('quarterly') || typeValue.includes('quarter') ? 3
      : typeValue.includes('yearly') || typeValue.includes('year') || typeValue.includes('annual') ? 12
        : typeValue.includes('monthly') || typeValue.includes('month') ? 1
          : typeValue.includes('bi-annual') || typeValue.includes('biannual') ? 6
            : 1 // Default to monthly

    const currentMaxNumber = installments.length > 0
      ? Math.max(...installments.map(inst => inst.installmentNumber))
      : 0

    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(startDate)
      dueDate.setMonth(dueDate.getMonth() + (i * monthsPerInstallment))

      newInstallments.push({
        id: Date.now() + i, // Unique ID
        installmentNumber: currentMaxNumber + i + 1,
        type: selectedInstallmentType, // Use the selected type from dropdown
        amount: 0, // Manual entry - NO auto-calculation
        period: "",
        dueDate,
        paymentMode: "bank",
        notes: "",
      })
    }

    setInstallments([...installments, ...newInstallments])

    // Get the label for the type
    const typeLabel = installmentTypeOptions?.find(opt => opt.value === selectedInstallmentType)?.label || selectedInstallmentType

    toast({
      title: "Success",
      description: `${numberOfInstallments} ${typeLabel} installment(s) generated. Please enter amounts manually.`,
    })

    // Reset selection and number input for next type
    setSelectedInstallmentType("")
    setInstallmentsInput("3")
    setNumberOfInstallments(3)
  }

  // Add one more installment of the same type
  const handleAddOneMore = (type: string) => {
    // Determine months per installment based on type value
    const typeValue = type.toLowerCase()
    const monthsPerInstallment = typeValue.includes('quarterly') || typeValue.includes('quarter') ? 3
      : typeValue.includes('yearly') || typeValue.includes('year') || typeValue.includes('annual') ? 12
        : typeValue.includes('monthly') || typeValue.includes('month') ? 1
          : typeValue.includes('bi-annual') || typeValue.includes('biannual') ? 6
            : 1 // Default to monthly

    const sameTypeInstallments = installments.filter(inst => inst.type === type)
    const lastSameTypeIndex = installments.findLastIndex(inst => inst.type === type)
    const lastDueDate = lastSameTypeIndex >= 0 && installments[lastSameTypeIndex].dueDate
      ? new Date(installments[lastSameTypeIndex].dueDate)
      : new Date(startDate)

    const newDueDate = new Date(lastDueDate)
    newDueDate.setMonth(newDueDate.getMonth() + monthsPerInstallment)

    const currentMaxNumber = installments.length > 0
      ? Math.max(...installments.map(inst => inst.installmentNumber))
      : 0

    const newInstallment: InstallmentRow = {
      id: Date.now(),
      installmentNumber: currentMaxNumber + 1,
      type: type,
      amount: 0,
      period: "",
      dueDate: newDueDate,
      paymentMode: "bank",
      notes: "",
    }

    setInstallments([...installments, newInstallment])
  }

  // ID-based update handler - EXACT as specified
  const updateInstallment = (id: number, field: keyof InstallmentRow, value: any) => {
    setInstallments(prev =>
      prev.map(inst =>
        inst.id === id
          ? { ...inst, [field]: value }
          : inst
      )
    )
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Validate down payment (only for create, not update)
      if (!isEditMode && calculatedDownPayment() <= 0) {
        toast({
          title: "Validation Error",
          description: "Down payment is required. Please enter down payment amount.",
          variant: "destructive",
        })
        return
      }

      const dealAmount = deal?.dealAmount || 0
      const remaining = remainingAmount()
      const total = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0)
      const difference = Math.abs(total - remaining)

      // Validate that installments sum equals remaining amount after down payment (only for create)
      if (!isEditMode && difference > 0.01) {
        toast({
          title: "Validation Error",
          description: `Installments total (${total.toLocaleString()}) must equal remaining amount after down payment (${remaining.toLocaleString()}). Difference: ${difference.toFixed(2)}`,
          variant: "destructive",
        })
        return
      }

      const hasInvalidDates = installments.some((inst) => !inst.dueDate)
      if (hasInvalidDates) {
        toast({
          title: "Validation Error",
          description: "All installments must have an instalment date",
          variant: "destructive",
        })
        return
      }

      if (isEditMode && paymentPlan) {
        // Update existing plan
        const installmentsPayload = installments.map((inst) => ({
          id: inst.id,
          type: inst.type || null,
          amount: inst.amount,
          dueDate: inst.dueDate?.toISOString(),
          paymentMode: inst.paymentMode || null,
          notes: inst.notes || null,
          paidAmount: inst.paidAmount || 0, // Preserve paid amounts
        }))

        // Ensure we have the payment plan ID - handle nested structure
        // paymentPlan might be the object itself or nested in paymentPlan property
        const planId = paymentPlan?.id || (paymentPlan as any)?.paymentPlan?.id
        if (!planId) {
          console.error('Payment plan object:', paymentPlan)
          toast({
            title: "Error",
            description: "Payment plan ID not found. Please refresh the page.",
            variant: "destructive",
          })
          return
        }

        // Preserve down payment when updating - get it from existing plan or use calculated one
        const downPaymentToSave = paymentPlan?.downPayment || calculatedDownPayment() || 0

        const response: any = await apiService.paymentPlans.update(planId, {
          installments: installmentsPayload,
          downPayment: downPaymentToSave, // Preserve down payment
          notes: notes || null,
        })

        const responseData = response?.data || response
        if (responseData?.success) {
          toast({
            title: "Success",
            description: "Payment plan updated successfully",
          })
          await loadDeal()
          setIsEditMode(false)
          setInstallments([])
          setDownPaymentPercentage("")
          setDownPaymentAmount("")
          setNotes("")
        }
      } else {
        // Create new plan
        const installmentsPayload = installments.map((inst) => ({
          type: inst.type || null, // Each installment has its own type
          amount: inst.amount,
          dueDate: inst.dueDate?.toISOString(),
          paymentMode: inst.paymentMode || null,
          notes: inst.notes || null,
        }))

        const response: any = await apiService.paymentPlans.create({
          dealId,
          clientId: deal?.clientId || "",
          downPayment: calculatedDownPayment(), // Include down payment for backend validation
          installments: installmentsPayload,
          notes: notes || null,
        })

        const responseData = response?.data || response
        if (responseData?.success) {
          toast({
            title: "Success",
            description: "Payment plan created successfully",
          })
          await loadDeal()
          // Reset form and exit edit mode
          setInstallments([])
          setDownPaymentPercentage("")
          setDownPaymentAmount("")
          setIsEditMode(false)
          setNotes("")
        }
      }
    } catch (error: any) {
      console.error('Payment plan creation error:', error)
      let errorMessage = "Failed to save payment plan"

      if (error.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })

  const handlePaymentAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !files.length) return

    setUploadingPaymentAttachments(true)
    try {
      const uploads: Array<{ url: string; name: string; mimeType?: string }> = []
      
      for (const file of Array.from(files)) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          toast({
            title: "Invalid file type",
            description: `File "${file.name}" is not supported. Only PDF, JPG, PNG, GIF, and WEBP files are allowed`,
            variant: "destructive",
          })
          continue
        }

        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `File "${file.name}" exceeds 10MB limit`,
            variant: "destructive",
          })
          continue
        }

        const base64 = await toBase64(file)
        uploads.push({
          url: base64,
          name: file.name,
          mimeType: file.type,
        })
      }

      if (uploads.length > 0) {
        setPaymentAttachments((prev) => [...prev, ...uploads])
        toast({ title: `${uploads.length} file(s) added successfully` })
      }
    } catch (error: any) {
      toast({
        title: "Failed to add attachment",
        description: error?.message || "Upload failed",
        variant: "destructive",
      })
    } finally {
      setUploadingPaymentAttachments(false)
      if (e.target) {
        e.target.value = ""
      }
    }
  }

  const handleRemovePaymentAttachment = (index: number) => {
    setPaymentAttachments((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleRecordPayment = async () => {
    if (!selectedInstallment || !paymentAmount) return

    try {
      setSaving(true)
      const amount = parseFloat(paymentAmount)
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid payment amount",
          variant: "destructive",
        })
        return
      }

      // Use smart allocation for automatic distribution
      const response: any = await apiService.deals.smartAllocatePayment(dealId, {
        amount,
        method: paymentMode,
      })

      const responseData = response?.data || response
      if (responseData?.success) {
        let message = responseData.message || "Payment allocated successfully"
        if (responseData.excessIgnored > 0) {
          message += ` Excess amount (${responseData.excessIgnored}) ignored.`
        }
        if (responseData.dealClosed) {
          message += " Deal has been closed."
        }

        toast({
          title: "Success",
          description: message,
        })
        setPaymentDialogOpen(false)
        setPaymentAmount("")
        setPaymentReferenceNumber("")
        setPaymentAttachments([])
        setSelectedInstallment(null)
        await loadDeal()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSmartAllocatePayment = async (amount: number, method: string) => {
    try {
      setSaving(true)
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid payment amount",
          variant: "destructive",
        })
        return false
      }

      const response: any = await apiService.deals.smartAllocatePayment(dealId, {
        amount,
        method,
      })

      const responseData = response?.data || response
      if (responseData?.success) {
        // Update view installments in real-time if provided
        if (responseData.updatedInstallments && responseData.updatedInstallments.length > 0) {
          setViewInstallments((prev) => {
            const updated = [...prev]
            responseData.updatedInstallments.forEach((updatedInst: any) => {
              const index = updated.findIndex((inst) => inst.id === updatedInst.id)
              if (index >= 0) {
                updated[index] = {
                  ...updated[index],
                  paidAmount: updatedInst.paidAmount,
                  status: updatedInst.status,
                }
              }
            })
            return updated
          })
        }

        // Update summary if provided
        if (responseData.summary) {
          setApiSummary(responseData.summary)
        }

        let message = responseData.message || "Payment allocated successfully"
        if (responseData.excessIgnored > 0) {
          message += ` Excess amount (${responseData.excessIgnored.toFixed(2)}) ignored.`
        }
        if (responseData.dealClosed) {
          message += " Deal has been closed."
        }

        toast({
          title: "Success",
          description: message,
        })

        // Clear payment amount
        setPaymentAmount("")

        // Reload full data to ensure consistency
        await loadDeal()
        return true
      }
      return false
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate payment",
        variant: "destructive",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return "Rs 0.00"
    }
    return `Rs ${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: "default",
      unpaid: "secondary",
      overdue: "destructive",
      partial: "outline",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  const handleGenerateReport = async () => {
    if (!deal) return

    try {
      setGeneratingReport(true)

      // Prepare data for unified report
      const reportData = {
        title: "Payment Plan Report",
        systemId: deal.dealCode ? `DEAL-${deal.dealCode}` : `DEAL-${deal.id}`,
        generatedOn: new Date().toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        sections: [
          {
            title: "Deal Information",
            data: {
              "Deal Title": deal.title || "N/A",
              "Deal Code": deal.dealCode || "N/A",
              "Client": deal.client?.name || "N/A",
              "Total Amount": deal.dealAmount ? `Rs ${Number(deal.dealAmount).toLocaleString("en-IN")}` : "Rs 0",
              "Status": deal.status || "N/A",
              "Created": deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "N/A"
            }
          },
          {
            title: "Payment Plan Summary",
            data: {
              "Total Amount": `Rs ${Number(finalSummary.totalAmount).toLocaleString("en-IN")}`,
              "Total Paid": `Rs ${Number(finalSummary.paidAmount).toLocaleString("en-IN")}`,
              "Outstanding": `Rs ${Number(finalSummary.remainingAmount).toLocaleString("en-IN")}`,
              "Progress": `${finalSummary.progress.toFixed(1)}%`,
              "Status": finalSummary.status
            }
          },
          ...(viewInstallments.length > 0 ? [{
            title: "Installment Schedule",
            tableData: viewInstallments.map(inst => ({
              number: inst.installmentNumber,
              type: inst.type || 'Custom',
              amount: inst.amount || 0,
              dueDate: inst.dueDate ? format(inst.dueDate, "PPP") : "N/A",
              paidAmount: inst.paidAmount || 0,
              remaining: (inst.amount || 0) - (inst.paidAmount || 0),
              status: inst.status || 'Pending'
            })),
            tableColumns: [
              { key: 'number', label: '#', type: 'number' as 'number' },
              { key: 'type', label: 'Type' },
              { key: 'amount', label: 'Amount', type: 'currency' as 'currency' },
              { key: 'dueDate', label: 'Due Date', type: 'date' as 'date' },
              { key: 'paidAmount', label: 'Paid', type: 'currency' as 'currency' },
              { key: 'remaining', label: 'Remaining', type: 'currency' as 'currency' },
              { key: 'status', label: 'Status' }
            ]
          }] : [])
        ]
      }

      // Open in new tab
      const { openReportInNewTab } = await import("@/components/reports/report-utils")
      openReportInNewTab(reportData)

      toast({
        title: "Success",
        description: "Report opened in new tab",
      })
    } catch (error: any) {
      console.error('Report generation error:', error)
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to generate report",
        variant: "destructive",
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  const handlePrintReport = async () => {
    if (!deal) return

    try {
      setGeneratingReport(true)

      // Generate PDF report from backend
      const response = await apiService.deals.getPaymentPlanPDF(dealId)

      // Handle blob response properly
      let blob: Blob | null = null
      if (response.data instanceof Blob) {
        // Check if it's an error JSON response (small size or JSON type)
        if (response.data.type === 'application/json' || (response.data.size < 1000 && response.data.size > 0)) {
          // Clone blob before reading to avoid consuming it
          const clonedBlob = response.data.slice()
          const text = await clonedBlob.text()
          try {
            const errorData = JSON.parse(text)
            if (errorData.error) {
              throw new Error(errorData.error)
            }
            // If JSON parsed successfully but no error field, it's still an error (we expected PDF)
            throw new Error('Received JSON response instead of PDF')
          } catch (parseError: any) {
            // If it's our error, re-throw it
            if (parseError instanceof Error && parseError.message.includes('Received JSON')) {
              throw parseError
            }
            // Not JSON or parsing failed, might be valid small PDF - use original blob
            blob = response.data
          }
        } else {
          blob = response.data
        }
      } else if (response.data instanceof ArrayBuffer) {
        blob = new Blob([response.data], { type: 'application/pdf' })
      } else if (typeof response.data === 'string') {
        // Check if it's JSON error
        if (response.data.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(response.data)
            if (parsed.error) {
              throw new Error(parsed.error)
            }
          } catch {
            throw new Error('Invalid response from server')
          }
        }
        // Not JSON, treat as base64 string
        try {
          const binaryString = atob(response.data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          blob = new Blob([bytes], { type: 'application/pdf' })
        } catch {
          throw new Error('Failed to decode PDF data')
        }
      } else {
        blob = new Blob([response.data as any], { type: 'application/pdf' })
      }

      // Verify blob is valid PDF
      if (!blob) {
        throw new Error('Failed to process PDF response')
      }
      if (blob.size === 0) {
        throw new Error('Received empty PDF file')
      }

      const url = URL.createObjectURL(blob)
      
      // Use iframe for more reliable printing
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.src = url
      
      document.body.appendChild(iframe)
      
      // Wait for iframe to load, then print
      iframe.onload = () => {
        try {
          // Small delay to ensure PDF is fully loaded
          setTimeout(() => {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus()
              iframe.contentWindow.print()
            }
            
            // Clean up after printing
            setTimeout(() => {
              document.body.removeChild(iframe)
              URL.revokeObjectURL(url)
            }, 1000)
          }, 500)
        } catch (printError) {
          console.error('Print error:', printError)
          document.body.removeChild(iframe)
          URL.revokeObjectURL(url)
          throw new Error('Failed to open print dialog')
        }
      }

      // Fallback: if iframe doesn't load, try window.open
      iframe.onerror = () => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
        
        // Fallback to window.open method
        const printWindow = window.open(url, '_blank')
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print()
              setTimeout(() => {
                URL.revokeObjectURL(url)
              }, 1000)
            }, 500)
          }
        } else {
          throw new Error('Please allow popups to print the PDF')
        }
      }

      toast({
        title: "Success",
        description: "Opening print dialog...",
      })
    } catch (error: any) {
      console.error('PDF print error:', error)
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to open print dialog",
        variant: "destructive",
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  // Calculate paid amount including down payment
  // Backend summary includes down payment for existing plans
  // For new plans or when user applies down payment, we need to add it
  let totalPaidAmount = apiSummary?.paidAmount || 0

  // Get saved down payment from payment plan (handle nested structure)
  const savedDownPayment = paymentPlan?.downPayment || (paymentPlan as any)?.paymentPlan?.downPayment || 0

  // Down payment is now automatically included as installment #0 when plan is created
  // So it's already counted in the installments and doesn't need special handling here
  // The summary from backend already includes all installments including down payment

  // Calculate final summary with down payment included
  // If no apiSummary and no deal, show zeros (but still show the summary card)
  const totalAmount = deal?.dealAmount || 0
  const summaryRemainingAmount = Math.max(0, totalAmount - totalPaidAmount)
  const progress = totalAmount > 0
    ? Math.round((totalPaidAmount / totalAmount) * 10000) / 100
    : 0

  const finalSummary = {
    totalAmount: totalAmount || 0,
    paidAmount: totalPaidAmount || 0,
    remainingAmount: summaryRemainingAmount || 0,
    progress: progress || 0,
    status: apiSummary?.status || (totalPaidAmount > 0 ? 'Partially Paid' : 'Pending'),
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading deal and payment plan...</p>
        </div>
      </div>
    )
  }

  // Empty state - deal not loaded
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

  // Empty state - deal amount missing
  if (!deal.dealAmount || deal.dealAmount <= 0) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="text-center py-12">
          <p className="text-destructive text-lg font-semibold mb-2">Deal amount is missing</p>
          <p className="text-muted-foreground">
            The deal "{deal.dealCode || deal.title || 'Deal'}" does not have a valid deal amount.
            Please update the deal with a valid amount before creating a payment plan.
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/details/deals/${dealId}`)}
            >
              Go to Deal Details
            </Button>
            <Button 
              variant="outline" 
              onClick={() => loadDeal()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
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
            <h1 className="text-3xl font-bold">Payment Plan</h1>
            <p className="text-muted-foreground">
              {deal?.dealCode || deal?.title || "Deal"} - {deal?.client?.name || "Client"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {paymentPlan && (
            <>
              <Button variant="outline" onClick={handlePrintReport} disabled={generatingReport}>
                {generatingReport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Print
              </Button>
              <Button variant="outline" onClick={handleGenerateReport} disabled={generatingReport}>
                {generatingReport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Card with Dues & Outstanding */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
          <CardDescription>Total amount, paid amount, outstanding and dues breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Main Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <Label className="text-muted-foreground text-xs">Total Deal Amount</Label>
              <p className="text-2xl font-bold">{formatCurrency(finalSummary.totalAmount)}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <Label className="text-muted-foreground text-xs">Total Paid</Label>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(finalSummary.paidAmount)}</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <Label className="text-muted-foreground text-xs">Outstanding</Label>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(finalSummary.remainingAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total − Paid</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <Label className="text-muted-foreground text-xs">Dues (Overdue)</Label>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  viewInstallments
                    .filter(inst => {
                      // Dues = unpaid installments with past due dates
                      const isPastDue = inst.dueDate && new Date(inst.dueDate) < new Date();
                      const isUnpaid = (inst.paidAmount || 0) < (inst.amount || 0);
                      return isPastDue && isUnpaid;
                    })
                    .reduce((sum, inst) => sum + ((inst.amount || 0) - (inst.paidAmount || 0)), 0)
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Past due installments</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Payment Progress</span>
              <span>{finalSummary.progress.toFixed(1)}%</span>
            </div>
            <Progress value={finalSummary.progress} className="h-2" />
          </div>

          {/* Installment Summary Stats */}
          {viewInstallments.length > 0 && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Installments:</span>
                <span className="ml-2 font-medium">{viewInstallments.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Paid:</span>
                <span className="ml-2 font-medium text-green-600">
                  {viewInstallments.filter(inst => inst.status === 'paid').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Pending:</span>
                <span className="ml-2 font-medium text-yellow-600">
                  {viewInstallments.filter(inst => inst.status !== 'paid' && (!inst.dueDate || new Date(inst.dueDate) >= new Date())).length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Overdue:</span>
                <span className="ml-2 font-medium text-red-600">
                  {viewInstallments.filter(inst => {
                    const isPastDue = inst.dueDate && new Date(inst.dueDate) < new Date();
                    const isUnpaid = inst.status !== 'paid';
                    return isPastDue && isUnpaid;
                  }).length}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Plan Form - Only show if no plan exists OR in edit mode */}
      {(!paymentPlan || isEditMode) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{isEditMode ? "Update Payment Plan" : "Create Payment Plan"}</CardTitle>
                <CardDescription>Set up installments with amounts and instalment dates. Total amount: {formatCurrency(deal?.dealAmount || 0)}</CardDescription>
              </div>
              {isEditMode && (
                <Button variant="outline" onClick={() => {
                  setIsEditMode(false)
                  setInstallments([])
                  setDownPaymentPercentage("")
                  setDownPaymentAmount("")
                  setNotes("")
                }}>
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Down Payment Section - AT THE TOP */}
            <div className="space-y-4 border-b pb-4">
              <div>
                <Label className="text-base font-semibold">Down Payment <span className="text-destructive">*</span></Label>
                <p className="text-sm text-muted-foreground">Enter down payment amount (required). It will be deducted from total deal amount.</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Down Payment Type</Label>
                  <Select value={downPaymentType} onValueChange={(value: "percentage" | "manual") => {
                    setDownPaymentType(value)
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="manual">Manual Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {downPaymentType === "percentage" ? (
                    <>
                      <Label>Down Payment Percentage (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={downPaymentPercentage}
                        onChange={(e) => {
                          const value = e.target.value
                          const num = parseFloat(value)
                          if (value === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
                            setDownPaymentPercentage(value)
                          }
                        }}
                        placeholder="0.00"
                      />
                      {downPaymentPercentage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Amount: Rs {calculatedDownPayment().toLocaleString("en-IN")}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Label>Down Payment Amount (Rs)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        max={deal?.dealAmount || 0}
                        value={downPaymentAmount}
                        onChange={(e) => {
                          const value = e.target.value
                          const num = parseFloat(value)
                          if (value === "" || (!isNaN(num) && num >= 0 && num <= (deal?.dealAmount || 0))) {
                            setDownPaymentAmount(value)
                          }
                        }}
                        placeholder="0.00"
                      />
                    </>
                  )}
                </div>
              </div>
              {calculatedDownPayment() > 0 && (
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Down Payment:</span>
                    <span className="text-sm font-semibold">Rs {calculatedDownPayment().toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Remaining Amount for Installments:</span>
                    <span className="text-sm font-semibold">Rs {remainingAmount().toLocaleString("en-IN")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    Note: Down payment will be automatically included as a pending installment when you create the plan.
                  </div>
                </div>
              )}
            </div>

            {/* Installments Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Installments</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={installmentsInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setInstallmentsInput(value)
                      const num = parseInt(value, 10)
                      if (!isNaN(num) && num > 0) {
                        setNumberOfInstallments(num)
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (isNaN(value) || value < 1) {
                        setInstallmentsInput("1")
                        setNumberOfInstallments(1)
                      } else {
                        setInstallmentsInput(value.toString())
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Generate Installments - Dynamic Type Selection */}
              <div className="space-y-2">
                <Label>Generate Installments</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Select an installment type and number of installments, then click Apply. You can apply multiple types sequentially.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Installment Type</Label>
                    <Select
                      value={selectedInstallmentType}
                      onValueChange={(value) => {
                        setSelectedInstallmentType(value)
                        // Prompt user to enter number of installments when type is selected
                        if (value && numberOfInstallments <= 0) {
                          setInstallmentsInput("3")
                          setNumberOfInstallments(3)
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select installment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {installmentTypeOptions && installmentTypeOptions.length > 0 ? (
                          installmentTypeOptions
                            .filter(opt => opt.isActive !== false)
                            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                            .map((option) => (
                              <SelectItem key={option.id} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No installment types available. Add types in Advanced Options.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {installmentTypeOptions && installmentTypeOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No installment types available. Add types in Advanced Options.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Installments</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={installmentsInput}
                      onChange={(e) => {
                        const value = e.target.value
                        setInstallmentsInput(value)
                        const num = parseInt(value, 10)
                        if (!isNaN(num) && num > 0) {
                          setNumberOfInstallments(num)
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value, 10)
                        if (isNaN(value) || value < 1) {
                          setInstallmentsInput("1")
                          setNumberOfInstallments(1)
                        } else {
                          setInstallmentsInput(value.toString())
                        }
                      }}
                      placeholder="Enter number"
                      disabled={!selectedInstallmentType}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Button
                      type="button"
                      variant="default"
                      onClick={handleApplyInstallmentType}
                      disabled={!deal || (deal.dealAmount || 0) <= 0 || !selectedInstallmentType || numberOfInstallments <= 0}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
              </div>

              {/* Installments Table - Grouped by Type with "Add One More" */}
              <div className="space-y-4">
                {installments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 border rounded-lg">
                    No installments yet. Enter down payment and generate installments by type.
                  </div>
                ) : (
                  (() => {
                    // Group installments by type
                    const grouped = installments.reduce((acc, inst) => {
                      const type = inst.type || 'custom'
                      if (!acc[type]) acc[type] = []
                      acc[type].push(inst)
                      return acc
                    }, {} as Record<string, InstallmentRow[]>)

                    return Object.entries(grouped).map(([type, typeInstallments]) => (
                      <div key={type} className="space-y-2 border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-base px-3 py-1">
                              {type.charAt(0).toUpperCase() + type.slice(1)} Installments ({typeInstallments.length})
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddOneMore(type)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add One More
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>Instalment Date</TableHead>
                              <TableHead>Payment Mode</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {typeInstallments.map((inst) => (
                              <TableRow key={inst.id}>
                                <TableCell className="font-medium">{inst.installmentNumber}</TableCell>
                                <TableCell>
                                  <Select
                                    value={inst.type}
                                    onValueChange={(value) => updateInstallment(inst.id, "type", value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {/* Options from advance options */}
                                      {installmentTypeOptions && installmentTypeOptions.length > 0 ? (
                                        installmentTypeOptions
                                          .filter(opt => opt.isActive !== false)
                                          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                          .map((option) => (
                                            <SelectItem key={option.id} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))
                                      ) : (
                                        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                          No installment types available. Add types in Advanced Options.
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={inst.amount || ''}
                                    onChange={(e) => updateInstallment(inst.id, "amount", Number(e.target.value) || 0)}
                                    className="w-32"
                                    placeholder="Enter amount"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={inst.period}
                                    onChange={(e) => updateInstallment(inst.id, "period", e.target.value)}
                                    placeholder="Period"
                                    className="w-24"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {inst.dueDate ? format(inst.dueDate, "PPP") : "Pick a date"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={inst.dueDate || undefined}
                                        onSelect={(date) => updateInstallment(inst.id, "dueDate", date)}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={inst.paymentMode}
                                    onValueChange={(value) => updateInstallment(inst.id, "paymentMode", value)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cash">Cash</SelectItem>
                                      <SelectItem value="bank">Bank</SelectItem>
                                      <SelectItem value="online">Online</SelectItem>
                                      <SelectItem value="cheque">Cheque</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={inst.notes || ''}
                                    onChange={(e) => updateInstallment(inst.id, "notes", e.target.value)}
                                    placeholder="Optional notes..."
                                    className="w-48"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setInstallments(prev => prev.filter(i => i.id !== inst.id))
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))
                  })()
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setInstallments([])
                setDownPaymentPercentage("")
                setDownPaymentAmount("")
                setNotes("")
              }}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isEditMode ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update Plan Button - Show when plan exists and not in edit mode */}
      {paymentPlan && !isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Plan Management</CardTitle>
            <CardDescription>Update payment plan or record new payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => {
                setIsEditMode(true)
                // Load existing installments into form for editing
                if (viewInstallments.length > 0) {
                  setInstallments(viewInstallments.map(inst => ({
                    ...inst,
                    id: inst.id || Date.now() + Math.random(),
                  })))
                  // Set down payment if available (you may need to get this from paymentPlan)
                  // For now, we'll leave it empty and user can re-apply
                }
              }}
              variant="outline"
              className="w-full"
            >
              <Edit className="mr-2 h-4 w-4" />
              Update Plan
            </Button>
          </CardContent>
        </Card>
      )}


      {/* Installments List and Client Ledger */}
      {paymentPlan && (
        <Tabs defaultValue="installments" className="w-full">
          <TabsList>
            <TabsTrigger value="installments">Installments</TabsTrigger>
            <TabsTrigger value="ledger">Client Ledger</TabsTrigger>
          </TabsList>
          <TabsContent value="installments">
            <Card>
              <CardHeader>
                <CardTitle>Installments</CardTitle>
                <CardDescription>Payment milestones and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Instalment Date</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewInstallments.map((inst) => {
                      const remaining = (inst.amount || 0) - (inst.paidAmount || 0)
                      const isPaid = (inst.paidAmount || 0) >= (inst.amount || 0)
                      const isPartiallyPaid = (inst.paidAmount || 0) > 0 && !isPaid
                      return (
                        <TableRow
                          key={inst.id || inst.installmentNumber}
                          className={isPaid ? "bg-green-50 dark:bg-green-950" : isPartiallyPaid ? "bg-yellow-50 dark:bg-yellow-950" : ""}
                        >
                          <TableCell>{inst.installmentNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{inst.type ? inst.type.charAt(0).toUpperCase() + inst.type.slice(1) : 'Custom'}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(inst.amount)}</TableCell>
                          <TableCell>{inst.dueDate ? format(inst.dueDate, "PPP") : "N/A"}</TableCell>
                          <TableCell className={isPaid ? "font-bold text-green-600" : isPartiallyPaid ? "font-semibold text-yellow-600" : ""}>
                            {formatCurrency(inst.paidAmount || 0)}
                          </TableCell>
                          <TableCell>{formatCurrency(remaining)}</TableCell>
                          <TableCell>{inst.status ? getStatusBadge(inst.status) : <Badge>Pending</Badge>}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ledger">
            <ClientLedgerView dealId={dealId} />
          </TabsContent>
        </Tabs>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Payment will be automatically allocated across installments in order
              {selectedInstallment && ` (Starting from installment #${selectedInstallment.installmentNumber})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={paymentDate} onSelect={(d) => d && setPaymentDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Reference/Cheque No (Optional)</Label>
              <Input
                type="text"
                value={paymentReferenceNumber}
                onChange={(e) => setPaymentReferenceNumber(e.target.value)}
                placeholder="Enter reference or cheque number"
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments (Bank Receipt, etc.)</Label>
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <Label htmlFor="payment-attachment-upload" className="cursor-pointer">
                    <span className="text-sm text-muted-foreground">Click to upload documents</span>
                    <Input
                      id="payment-attachment-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                      multiple
                      onChange={handlePaymentAttachmentUpload}
                      disabled={uploadingPaymentAttachments}
                      className="hidden"
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG, GIF, WEBP up to 10MB each</p>
                </div>
                {uploadingPaymentAttachments && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading attachments...
                  </div>
                )}
                {paymentAttachments.length > 0 && (
                  <div className="space-y-2">
                    {paymentAttachments.map((attachment, idx) => {
                      const isImage = attachment.mimeType?.startsWith('image/') || attachment.url.startsWith('data:image')
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isImage ? (
                              <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <span className="text-sm truncate">{attachment.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePaymentAttachment(idx)}
                            className="flex-shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Creation Dialog */}
      {deal && (
        <ReceiptCreationDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          dealId={dealId}
          clientId={deal.clientId || ""}
          onSuccess={() => {
            loadDeal()
          }}
        />
      )}
    </div>
  )
}

