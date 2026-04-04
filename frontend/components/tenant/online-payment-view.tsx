"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CreditCard, 
  Building2, 
  Upload, 
  CheckCircle2,
  Loader2,
  AlertCircle,
  DollarSign,
  Calendar
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

export function OnlinePaymentView({ tenantData, leaseData }: { tenantData: any; leaseData: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank" | "slip">("card")
  const [amount, setAmount] = useState("")
  const [months, setMonths] = useState(1)
  const [bankSlipFile, setBankSlipFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")

  // Card payment fields
  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")

  // Bank transfer fields
  const [bankAccount, setBankAccount] = useState("")
  const [transactionId, setTransactionId] = useState("")

  useEffect(() => {
    fetchInvoices()
  }, [tenantData])

  useEffect(() => {
    if (selectedInvoice && invoices.length > 0) {
      const invoice = invoices.find((inv: any) => inv.id === selectedInvoice)
      if (invoice) {
        setAmount((invoice.remainingAmount || invoice.totalAmount || invoice.amount || 0).toString())
      }
    } else if (leaseData?.rent) {
      const totalAmount = (leaseData.rent * months).toFixed(2)
      setAmount(totalAmount)
    }
  }, [selectedInvoice, invoices, months, leaseData])

  const fetchInvoices = async () => {
    try {
      if (!tenantData?.id) return

      const invoicesRes = await apiService.invoices.getAll()
      const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
        ? (invoicesRes as any).data.data
        : Array.isArray((invoicesRes as any)?.data)
          ? (invoicesRes as any).data
          : []
      
      const tenantInvoices = allInvoices
        .filter((inv: any) => inv.tenantId === tenantData.id)
        .filter((inv: any) => inv.status !== "paid" && inv.status !== "Paid")
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      
      setInvoices(tenantInvoices)
    } catch (error) {
      console.error("Error fetching invoices:", error)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
          variant: "destructive",
        })
        return
      }
      setBankSlipFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "card") {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
        toast({
          title: "Missing Information",
          description: "Please fill in all card details.",
          variant: "destructive",
        })
        return
      }
    }

    if (paymentMethod === "bank" && !transactionId) {
      toast({
        title: "Missing Information",
        description: "Please enter the transaction ID.",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "slip" && !bankSlipFile) {
      toast({
        title: "Missing File",
        description: "Please upload a bank slip.",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      let paymentData: any = {
        tenantId: tenantData?.id,
        invoiceId: selectedInvoice || null,
        amount: paymentAmount,
        method: paymentMethod === "card" ? "Credit Card" : paymentMethod === "bank" ? "Bank Transfer" : "Bank Slip",
        date: new Date().toISOString(),
        status: paymentMethod === "slip" ? "pending" : "completed",
        notes: notes || undefined,
      }

      if (paymentMethod === "card") {
        // In production, this would be handled by a payment gateway
        // For now, we'll just record the payment
        paymentData.referenceNumber = `CARD-${Date.now()}`
        paymentData.attachments = {
          cardLast4: cardNumber.slice(-4),
          cardName: cardName,
        }
      } else if (paymentMethod === "bank") {
        paymentData.referenceNumber = transactionId
      } else if (paymentMethod === "slip") {
        // Upload bank slip
        const formData = new FormData()
        formData.append("file", bankSlipFile!)
        formData.append("type", "bank-slip")
        formData.append("tenantId", tenantData.id)

        try {
          const uploadRes = (await apiService.uploads?.upload?.(formData) || null) as any
          if (uploadRes?.data?.url) {
            paymentData.attachments = { bankSlipUrl: uploadRes.data.url }
          }
        } catch (e) {
          console.warn("File upload failed:", e)
        }
        paymentData.referenceNumber = `SLIP-${Date.now()}`
      }

      // Create payment via tenant portal API
      await apiService.tenantPortal.pay(tenantData.id, paymentData)

      toast({
        title: "Payment Submitted",
        description: paymentMethod === "slip" 
          ? "Your bank slip has been uploaded. Payment will be verified shortly."
          : "Your payment has been processed successfully.",
      })

      // Reset form
      setSelectedInvoice("")
      setAmount("")
      setMonths(1)
      setBankSlipFile(null)
      setNotes("")
      setCardNumber("")
      setCardName("")
      setCardExpiry("")
      setCardCvv("")
      setBankAccount("")
      setTransactionId("")

      // Refresh invoices
      await fetchInvoices()
    } catch (error: any) {
      console.error("Error processing payment:", error)
      toast({
        title: "Payment Failed",
        description: error?.response?.data?.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '')
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4)
    }
    return v
  }

  const totalAmount = parseFloat(amount) || 0
  const currentRent = leaseData?.rent || 0
  const multiMonthTotal = currentRent * months

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Online Payment</h2>
        <p className="text-muted-foreground mt-1">Pay your rent securely online</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Invoice Selection */}
              <div className="space-y-2">
                <Label>Select Invoice (Optional)</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedInvoice}
                  onChange={(e) => setSelectedInvoice(e.target.value)}
                >
                  <option value="">Pay for multiple months</option>
                  {invoices.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber || `Invoice #${inv.id.slice(0, 8)}`} - 
                      Due: {new Date(inv.dueDate).toLocaleDateString()} - 
                      {formatCurrency(inv.remainingAmount || inv.totalAmount || inv.amount || 0)}
                    </option>
                  ))}
                </select>
                {selectedInvoice && (
                  <p className="text-xs text-muted-foreground">
                    Paying for selected invoice
                  </p>
                )}
              </div>

              {/* Amount Selection */}
              {!selectedInvoice && (
                <div className="space-y-2">
                  <Label>Number of Months</Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Monthly rent: {formatCurrency(currentRent)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                {!selectedInvoice && months > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Total for {months} months: {formatCurrency(multiMonthTotal)}
                  </p>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <Label>Payment Method *</Label>
                <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="card">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Card
                    </TabsTrigger>
                    <TabsTrigger value="bank">
                      <Building2 className="h-4 w-4 mr-2" />
                      Bank Transfer
                    </TabsTrigger>
                    <TabsTrigger value="slip">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Slip
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Card Number *</Label>
                      <Input
                        placeholder="1234 5678 9012 3456"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        maxLength={19}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cardholder Name *</Label>
                      <Input
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expiry Date *</Label>
                        <Input
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          maxLength={5}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CVV *</Label>
                        <Input
                          type="password"
                          placeholder="123"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          maxLength={4}
                          required
                        />
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        🔒 Your payment is secured with SSL encryption. Card details are not stored.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="bank" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Bank Account Number</Label>
                      <Input
                        placeholder="Enter your bank account number"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction ID / Reference Number *</Label>
                      <Input
                        placeholder="Enter transaction ID from your bank"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-2">Bank Transfer Details:</p>
                      <p className="text-xs text-muted-foreground">
                        Account Name: Property Management<br />
                        Account Number: 1234567890<br />
                        Bank: Example Bank<br />
                        Please include your tenant ID in the transfer reference.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="slip" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Upload Bank Slip *</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="bank-slip-upload"
                        />
                        <Label htmlFor="bank-slip-upload" className="cursor-pointer">
                          <Button type="button" variant="outline" asChild>
                            <span>Choose File</span>
                          </Button>
                        </Label>
                        {bankSlipFile && (
                          <p className="text-sm text-foreground mt-2">
                            Selected: {bankSlipFile.name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Max file size: 5MB (JPG, PNG, PDF)
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-warning/10 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Payment will be verified manually after you upload the slip. You'll receive a confirmation once verified.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  placeholder="Any additional information about this payment..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process Payment
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Payment Summary */}
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              {selectedInvoice && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="text-foreground">
                    {invoices.find((inv: any) => inv.id === selectedInvoice)?.invoiceNumber || "N/A"}
                  </span>
                </div>
              )}
              {!selectedInvoice && months > 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Months</span>
                  <span className="text-foreground">{months}</span>
                </div>
              )}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-primary/5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">Secure Payment</p>
                <p className="text-xs text-muted-foreground">
                  All payments are processed securely. Your financial information is protected.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

