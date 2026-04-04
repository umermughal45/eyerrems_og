"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Building2, Loader2, Mail, MapPin, MessageSquare, Phone, FileText, Paperclip, Download, File, ExternalLink, Plus, Upload, Trash2 } from "lucide-react"

import { apiService } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

const closedDealStages = new Set(["closed-won", "closed-lost", "won", "lost"])

const formatCurrency = (value: number) => {
  if (!value || Number.isNaN(value)) return "Rs 0"
  return `Rs ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

const formatDateTime = (value?: string | null, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return "—"
  return withTime ? date.toLocaleString() : date.toLocaleDateString()
}

const toTitleCase = (value: string | null | undefined) => {
  if (!value) return "—"
  return value
    .toString()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

interface Deal {
  id: string
  title: string
  value?: number | string | null
  dealAmount?: number | string | null
  stage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  dealer?: { name?: string | null } | null
}

interface Communication {
  id: string
  channel: string
  content: string
  createdAt?: string | null
  lead?: { name?: string | null } | null
}

interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

interface ClientResponse {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  deals?: Deal[]
  communications?: Communication[]
  attachments?: { notes?: string; files?: Attachment[] } | null
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string | undefined
  const { toast } = useToast()

  const [client, setClient] = useState<ClientResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchClient = useCallback(async () => {
    if (!clientId) return
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.clients.getById(clientId)
      // Handle different response structures
      const clientData = (response.data as any)?.data || response.data || response
      setClient(clientData as ClientResponse)
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Failed to fetch client"
      setError(message)
      setClient(null)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  const deals = useMemo(() => client?.deals ?? [], [client])
  const communications = useMemo(() => client?.communications ?? [], [client])
  // Handle attachments - can be in client.attachments.files or client.attachments directly
  const attachments = useMemo(() => {
    if (!client) return []
    if (Array.isArray(client.attachments)) return client.attachments
    if (client.attachments?.files && Array.isArray(client.attachments.files)) {
      return client.attachments.files
    }
    return []
  }, [client])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !clientId) return

    setUploading(true)
    try {
      const newAttachments: Attachment[] = []
      
      for (const file of Array.from(files)) {
        const reader = new FileReader()
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        
        newAttachments.push({
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size,
        })
      }

      // Update client with new attachments
      const existingFiles = client?.attachments?.files || []
      const updatedAttachments = {
        notes: client?.attachments?.notes || "",
        files: [...existingFiles, ...newAttachments]
      }

      await apiService.clients.update(clientId, { attachments: updatedAttachments })
      toast({ title: `${newAttachments.length} file(s) uploaded successfully` })
      fetchClient()
    } catch (err) {
      console.error("Failed to upload file:", err)
      toast({ title: "Failed to upload file", variant: "destructive" })
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleRemoveAttachment = async (index: number) => {
    if (!clientId || !client) return
    
    try {
      const existingFiles = client?.attachments?.files || []
      const updatedFiles = existingFiles.filter((_, i) => i !== index)
      const updatedAttachments = {
        notes: client?.attachments?.notes || "",
        files: updatedFiles
      }

      await apiService.clients.update(clientId, { attachments: updatedAttachments })
      toast({ title: "Attachment removed" })
      fetchClient()
    } catch (err) {
      console.error("Failed to remove attachment:", err)
      toast({ title: "Failed to remove attachment", variant: "destructive" })
    }
  }

  const downloadAttachment = (attachment: Attachment) => {
    const link = document.createElement("a")
    link.href = attachment.url
    link.download = attachment.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalDealValue = useMemo(() => {
    return deals.reduce((sum, deal) => {
      const amount = deal.dealAmount ?? deal.value ?? 0
      const numericValue =
        typeof amount === "number" ? amount : Number.parseFloat(String(amount ?? "0"))
      return Number.isFinite(numericValue) ? sum + numericValue : sum
    }, 0)
  }, [deals])

  const activeDealsCount = useMemo(() => {
    return deals.filter((deal) => {
      const stage = (deal.stage || "").toLowerCase()
      return stage !== "" && !closedDealStages.has(stage)
    }).length
  }, [deals])

  const lastCommunication = communications[0]
  const clientType = client?.company ? "Corporate" : "Individual"
  const statusLabel = toTitleCase(client?.status) || "Active"
  const statusVariant = client?.status?.toLowerCase() === "vip" ? "default" : "secondary"

  if (!clientId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6 text-center">
          <p className="text-lg text-muted-foreground">No client selected.</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto flex h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading client details…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <p className="text-lg text-destructive">{error}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={fetchClient}>Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6 text-center">
          <p className="text-lg text-muted-foreground">Client not found.</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase">
                  {client.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant={clientType === "Corporate" ? "default" : "secondary"}>{clientType}</Badge>
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => router.push(`/ledger/client/${client.id}`)}>
            <FileText className="mr-2 h-4 w-4" />
            Open Ledger
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deal Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {totalDealValue > 0 ? formatCurrency(totalDealValue) : "Rs 0"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Across all recorded deals</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-3xl font-bold text-foreground mt-2">{deals.length}</p>
            <p className="text-sm text-muted-foreground mt-2">Including closed and active</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Active Deals</p>
            <p className="text-3xl font-bold text-foreground mt-2">{activeDealsCount}</p>
            <p className="text-sm text-muted-foreground mt-2">Deals currently in the pipeline</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Last Communication</p>
            <p className="text-lg font-semibold text-foreground mt-2">
              {lastCommunication ? formatDateTime(lastCommunication.createdAt, true) : "No activity recorded"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {communications.length > 0 ? `${communications.length} communications logged` : "No communications yet"}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{client.email || "Not provided"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{client.phone || "Not provided"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium text-foreground">Not provided</p>
                </div>
              </div>
              {client.company && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium text-foreground">{client.company}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Account Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">Client Type</span>
                <Badge variant={clientType === "Corporate" ? "default" : "secondary"}>{clientType}</Badge>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">Total Deals</span>
                <span className="font-medium text-foreground">{deals.length}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">Total Communications</span>
                <span className="font-medium text-foreground">{communications.length}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border">
                <span className="text-muted-foreground">Created On</span>
                <span className="font-medium text-foreground">{formatDateTime(client.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium text-foreground">{formatDateTime(client.updatedAt, true)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="p-6 overflow-hidden">
            <h3 className="text-lg font-semibold mb-4">Deals</h3>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals recorded for this client yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal Title</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => {
                      const stageLabel = toTitleCase(deal.stage)
                      const amount = deal.dealAmount ?? deal.value ?? 0
                      const formattedValue =
                        typeof amount === "number" && Number.isFinite(amount)
                          ? formatCurrency(amount)
                          : typeof amount === "string" && amount !== ""
                            ? amount
                            : "Rs 0"

                      return (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">{deal.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{stageLabel}</Badge>
                          </TableCell>
                          <TableCell>{formattedValue}</TableCell>
                          <TableCell>{deal.dealer?.name || "—"}</TableCell>
                          <TableCell>{formatDateTime(deal.createdAt, true)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Communications</h3>
            {communications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No communications logged yet.</p>
            ) : (
              <div className="space-y-4">
                {communications.slice(0, 6).map((communication) => (
                  <div key={communication.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {communication.channel}
                        </Badge>
                        {communication.lead?.name && (
                          <span className="text-xs text-muted-foreground">
                            Lead: {communication.lead.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(communication.createdAt, true)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                      <p className="line-clamp-3">{communication.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Attachments Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </h3>
            <div>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="client-attachment-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              />
              <label htmlFor="client-attachment-upload">
                <Button asChild disabled={uploading}>
                  <span className="cursor-pointer">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Attachment
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          
          {attachments.length === 0 ? (
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No attachments uploaded for this client.</p>
              <label htmlFor="client-attachment-upload" className="cursor-pointer">
                <span className="text-sm text-primary hover:underline">Click to upload files</span>
              </label>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="h-8 w-8 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadAttachment(attachment)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
