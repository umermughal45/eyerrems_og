"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Zap, ArrowRight, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"

interface QuickLeadCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenAdvanced: (data: any) => void
  onSuccess?: (leadId: string) => void
}

const SOURCE_OPTIONS = [
  "website",
  "referral",
  "social",
  "event",
  "walk-in",
  "advertisement",
  "other",
] as const

export function QuickLeadCaptureModal({
  open,
  onOpenChange,
  onOpenAdvanced,
  onSuccess,
}: QuickLeadCaptureModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    source: "",
    assignedToUserId: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [agents, setAgents] = useState<any[]>([])
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (open) {
      fetchAgents()
    }
  }, [open])

  const fetchAgents = async () => {
    try {
      // In a real app, this would be apiService.auth.getUsers or similar
      const response: any = await apiService.auth.getUsers()
      const users = response.data?.data || response.data || []
      setAgents(users)
    } catch (err) {
      console.error("Failed to fetch agents:", err)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast({
        title: "Missing Information",
        description: "Full Name and Phone Number are required for quick capture.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        source: formData.source || null,
        assignedToUserId: formData.assignedToUserId === "unassigned" ? null : (formData.assignedToUserId || null),
        status: "new", // Default for quick capture
      }

      const response: any = await apiService.leads.create(payload)
      const newLead = response.data?.data || response.data

      toast({
        title: "Lead Captured!",
        description: `${formData.name} has been added to the system.`,
        variant: "success",
      })

      onSuccess?.(newLead.id)
      onOpenChange(false)
      
      // Redirect to Lead Profile for enrichment as per requirement
      router.push(`/details/leads?id=${newLead.id}`)
    } catch (err: any) {
      console.error("Quick capture failed:", err)
      const errorMessage = err.response?.data?.error || err.message || "An unexpected error occurred."
      toast({
        title: "Capture Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-slate-50">
        {/* Visual Polish: Gradient Header */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
        
        <div className="p-6">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-2 text-indigo-400 mb-1">
              <Zap size={18} fill="currentColor" />
              <span className="text-xs font-bold uppercase tracking-wider">Speed Entry Mode</span>
            </div>
            <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
              Quick Lead Capture
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter the essentials now. Enrich the profile later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="quick-name" className="text-sm font-medium text-slate-300">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-name"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-phone" className="text-sm font-medium text-slate-300">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-phone"
                placeholder="+92 XXX XXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quick-source" className="text-sm font-medium text-slate-300">
                  Source
                </Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger id="quick-source" className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Select Source" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="capitalize">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quick-agent" className="text-sm font-medium text-slate-300">
                  Assign To
                </Label>
                <Select
                  value={formData.assignedToUserId}
                  onValueChange={(value) => setFormData({ ...formData, assignedToUserId: value })}
                >
                  <SelectTrigger id="quick-agent" className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.username || agent.name || agent.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <Button
              onClick={handleSave}
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 rounded-xl shadow-lg shadow-indigo-900/20 group transition-all"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              )}
              Create Lead
            </Button>

            <button
              onClick={() => onOpenAdvanced(formData)}
              className="w-full text-center text-sm text-slate-500 hover:text-indigo-400 flex items-center justify-center gap-1 transition-colors"
            >
              Need more fields? <span className="font-semibold underline">Open Advanced Form</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
