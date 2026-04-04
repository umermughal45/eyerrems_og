"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  User, 
  ExternalLink,
  MessageSquare,
  Tag,
  Briefcase,
  DollarSign,
  Plus,
  CheckCircle2,
  Loader2,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CRMActivityTimeline } from "./crm-activity-timeline"
import { TransactionHeader } from "@/components/shared/transaction-header"
import { TransactionTimeline } from "@/components/shared/transaction-timeline"
import { useCRMAutomation } from "@/hooks/use-crm-automation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const STAGES = [
  { value: "new", label: "New Lead", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-cyan-500" },
  { value: "qualified", label: "Qualified", color: "bg-emerald-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { value: "won", label: "Won", color: "bg-green-600" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
]

interface LeadSideDrawerProps {
  lead: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenFullProfile: (lead: any) => void
  onStatusChange?: (leadId: string, newStatus: string) => Promise<void>
}

export function LeadSideDrawer({ lead, open, onOpenChange, onOpenFullProfile, onStatusChange }: LeadSideDrawerProps) {
  const { suggestions } = useCRMAutomation(lead)
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)
  const { toast } = useToast()
  
  const handleUpdateStage = async (newStage: string) => {
    if (!lead) return
    try {
      setUpdatingStage(true)
      if (onStatusChange) {
        await onStatusChange(lead.id, newStage)
      } else {
        await apiService.leads.update(lead.id, { status: newStage })
      }
      
      // Activity Engine Hook: Log stage change
      await apiService.communications.create({
        leadId: lead.id,
        channel: "stage_change",
        content: `Moved from ${lead.status || 'new'} to ${newStage}`,
        activityType: "stage_change",
      })

      toast({ title: `Stage updated to ${newStage}` })
    } catch (err: any) {
      toast({ title: "Failed to update stage", variant: "destructive" })
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleLogCall = async () => {
    if (!lead) return
    try {
      if (lead.phone) {
        window.open(`tel:${lead.phone}`)
      }
      // Activity Engine Hook: Log call attempt/occurrence
      await apiService.communications.create({
        leadId: lead.id,
        channel: "call",
        content: `Outgoing call to ${lead.phone || 'unknown number'}`,
        activityType: "call",
      })
      toast({ title: "Call logged in activity timeline" })
    } catch (err: any) {
      console.error("Failed to log call:", err)
    }
  }

  const handleSaveNote = async () => {
    if (!lead || !noteText.trim()) return
    try {
      setSavingNote(true)
      await apiService.communications.create({
        leadId: lead.id,
        channel: "note",
        content: noteText,
        activityType: "note",
      })
      toast({ title: "Note saved" })
      setNoteText("")
    } catch (err: any) {
      toast({ title: "Failed to save note", variant: "destructive" })
    } finally {
      setSavingNote(false)
    }
  }
  
  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {lead.tid || lead.id?.slice(0, 8)}
            </Badge>
            <Badge 
              variant={
                lead.status === "new" ? "secondary" : 
                lead.status === "qualified" ? "default" : 
                "outline"
              }
              className="capitalize"
            >
              {lead.status}
            </Badge>
          </div>
          <SheetTitle className="text-2xl font-bold">{lead.name}</SheetTitle>
          <SheetDescription>
            Lead details and activity history
          </SheetDescription>
          <div className="mt-4">
            <TransactionHeader tid={lead.tid} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Action Command Center */}
            <div className="space-y-4 bg-muted/30 p-4 rounded-xl border-2 border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Zap className="h-4 w-4 fill-primary" />
                  Quick Actions
                </h4>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleLogCall}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
                <Button 
                  className="h-10 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    if (lead.phone) {
                      const phone = lead.phone.replace(/\D/g, '')
                      window.open(`https://wa.me/${phone}`)
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Move Stage</p>
                <Select 
                  value={lead.status || "new"} 
                  onValueChange={handleUpdateStage}
                  disabled={updatingStage}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                          {stage.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">Add Quick Note</p>
                <Textarea 
                  placeholder="Note content..."
                  className="min-h-[80px] text-sm resize-none bg-background"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <Button 
                  className="w-full h-9" 
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                >
                  {savingNote ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                  Save Note
                </Button>
              </div>
            </div>

            <Button variant="ghost" className="w-full text-xs" onClick={() => onOpenFullProfile(lead)}>
              <ExternalLink className="h-3 w-3 mr-2" />
              Open Full Profile
            </Button>

            {/* Automation Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div 
                    key={suggestion.id} 
                    className={cn(
                      "p-3 rounded-lg border flex items-start gap-3",
                      suggestion.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-900 shadow-sm" :
                      suggestion.type === "urgent" ? "bg-red-50 border-red-200 text-red-900 shadow-sm" :
                      "bg-blue-50 border-blue-200 text-blue-900 shadow-sm"
                    )}
                  >
                    <suggestion.icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold leading-none">{suggestion.title}</p>
                      <p className="text-[11px] leading-normal opacity-90">{suggestion.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Contact Information */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</h4>
              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{lead.email || "No email"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{lead.phone || "No phone"}</span>
                </div>
                <div className="flex items-center gap-3">
                   <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{lead.address || "No address"}</span>
                </div>
              </div>
            </section>

            <Separator />

            {/* Lead Details */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lead Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem icon={Tag} label="Source" value={lead.source} />
                <DetailItem icon={Briefcase} label="Interest" value={lead.interest} />
                <DetailItem icon={DollarSign} label="Budget" value={lead.budget} />
                <DetailItem icon={User} label="Assigned To" value={lead.assignedTo} />
                <DetailItem icon={Calendar} label="Created" value={lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : null} />
              </div>
            </section>

            <Separator />

            {/* Activity History Placeholder */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Activity Timeline</h4>
                <Badge variant="secondary" className="text-[10px]">Beta</Badge>
              </div>
              
              
              <CRMActivityTimeline lead={lead} />
            </section>

            <Separator />

            {/* Global Transaction Lifecycle */}
            <section className="space-y-4 pb-12">
              <TransactionTimeline tid={lead.tid} />
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function DetailItem({ icon: Icon, label, value }: any) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}
