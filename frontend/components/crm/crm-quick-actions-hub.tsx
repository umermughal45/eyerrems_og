"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Search, 
  Phone, 
  MessageSquare, 
  Plus, 
  Calendar, 
  Loader2, 
  ArrowRight,
  User,
  Mail,
  Zap,
  CheckCircle2,
  Clock,
  ExternalLink
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CRMActivityTimeline } from "./crm-activity-timeline"

const STAGES = [
  { value: "new", label: "New Lead", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-cyan-500" },
  { value: "qualified", label: "Qualified", color: "bg-emerald-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { value: "won", label: "Won", color: "bg-green-600" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
]

export default function CRMQuickActionsHub() {
  const [searchTerm, setSearchTerm] = useState("")
  const [leads, setLeads] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)
  const [updatingStage, setUpdatingStage] = useState(false)
  const { toast } = useToast()

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setLeads([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const response: any = await apiService.leads.getAll({ search: searchTerm })
        const responseData = response.data as any
        const data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
        setLeads(data.slice(0, 5)) // Limit to top 5 results
      } catch (err) {
        console.error("Search failed:", err)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead)
    setLeads([])
    setSearchTerm("")
  }

  const handleSaveNote = async () => {
    if (!selectedLead || !noteText.trim()) return

    try {
      setSavingNote(true)
      await apiService.communications.create({
        leadId: selectedLead.id,
        channel: "note",
        content: noteText,
        status: "completed"
      })
      
      toast({ title: "Note saved successfully" })
      setNoteText("")
      
      // Refresh selected lead to show in activity (mocking refresh by just triggering a re-render if needed)
      // In a real app, we'd fetch the latest lead data or use a query provider
    } catch (err: any) {
      toast({ 
        title: "Failed to save note", 
        description: err.response?.data?.message || "An error occurred",
        variant: "destructive" 
      })
    } finally {
      setSavingNote(false)
    }
  }

  const handleUpdateStage = async (newStage: string) => {
    if (!selectedLead) return

    try {
      setUpdatingStage(true)
      await apiService.leads.update(selectedLead.id, { status: newStage })
      
      setSelectedLead({ ...selectedLead, status: newStage })
      toast({ title: `Stage updated to ${newStage}` })
    } catch (err: any) {
      toast({ 
        title: "Failed to update stage", 
        description: err.response?.data?.message || "An error occurred",
        variant: "destructive" 
      })
    } finally {
      setUpdatingStage(false)
    }
  }

  const handleCall = () => {
    if (selectedLead?.phone) {
      window.open(`tel:${selectedLead.phone}`)
    }
  }

  const handleWhatsApp = () => {
    if (selectedLead?.phone) {
      const phone = selectedLead.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-280px)]">
      {/* Left Column: Selection & Actions */}
      <div className="lg:col-span-2 space-y-6 flex flex-col overflow-hidden">
        {/* Search Header */}
        <Card className="p-4 bg-white/60 dark:bg-[#0d212c]/60 backdrop-blur-md border shadow-sm flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, or phone..."
              className="pl-10 h-12 text-lg border-none bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {leads.length > 0 && (
            <Card className="absolute left-0 right-0 mt-2 z-50 p-2 shadow-xl border animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                {leads.map((lead) => (
                  <button
                    key={lead.id}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted text-left transition-colors"
                    onClick={() => handleSelectLead(lead)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "No contact info"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{lead.status || "New"}</Badge>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </Card>

        {/* Selected Lead Workspace */}
        {selectedLead ? (
          <ScrollArea className="flex-1">
            <div className="space-y-6 pb-6">
              {/* Lead Info Card */}
              <Card className="p-6 bg-white/60 dark:bg-[#0d212c]/60 backdrop-blur-md border shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                      {selectedLead.name?.charAt(0) || "L"}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedLead.name}</h2>
                      <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                        <span className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" /> {selectedLead.phone || "N/A"}</span>
                        <span className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3" /> {selectedLead.email || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge 
                      className={cn(
                        "px-3 py-1 text-sm font-semibold text-white",
                        STAGES.find(s => s.value === (selectedLead.status || "new"))?.color || "bg-slate-500"
                      )}
                    >
                      {(selectedLead.status || "New").toUpperCase()}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-xs" asChild>
                      <a href={`/details/leads?id=${selectedLead.id}`} target="_blank" rel="noreferrer">
                        View Full Profile <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Action Buttons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Button 
                    className="h-20 flex flex-col gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-md transition-all hover:scale-105"
                    onClick={handleCall}
                  >
                    <Phone className="h-6 w-6" />
                    <span>Call Now</span>
                  </Button>
                  <Button 
                    className="h-20 flex flex-col gap-2 bg-green-500 hover:bg-green-600 shadow-md transition-all hover:scale-105"
                    onClick={handleWhatsApp}
                  >
                    <MessageSquare className="h-6 w-6" />
                    <span>WhatsApp</span>
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-20 flex flex-col gap-2 border-2 hover:bg-muted shadow-sm transition-all hover:scale-105"
                  >
                    <Calendar className="h-6 w-6 text-primary" />
                    <span>Follow-up</span>
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-20 flex flex-col gap-2 border-2 hover:bg-muted shadow-sm transition-all hover:scale-105"
                  >
                    <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
                    <span>Automation</span>
                  </Button>
                </div>
              </Card>

              {/* Stage & Note Workspace */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Status Switcher */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-primary" />
                    Change Stage
                  </h3>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Move this lead to the next stage in the pipeline.</p>
                    <Select 
                      value={selectedLead.status || "new"} 
                      onValueChange={handleUpdateStage}
                      disabled={updatingStage}
                    >
                      <SelectTrigger className="w-full h-12 text-lg">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value} className="h-10">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                              {stage.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                {/* Inline Note System */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Add Quick Note
                  </h3>
                  <div className="space-y-4">
                    <Textarea 
                      placeholder="Type a quick observation or update..."
                      className="min-h-[100px] resize-none border-2 focus-visible:ring-primary/20"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Button 
                      className="w-full h-11" 
                      onClick={handleSaveNote}
                      disabled={savingNote || !noteText.trim()}
                    >
                      {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Save Note
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <Card className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white/40 dark:bg-black/20 backdrop-blur-sm border-dashed border-2">
            <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
              <Zap className="h-10 w-10 text-slate-400 opacity-50" />
            </div>
            <h2 className="text-2xl font-bold text-slate-500">Quick Actions Hub</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Search and select a lead to perform rapid actions. Call, messages, notes, and pipeline updates - all from one screen.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="p-4 rounded-xl border bg-background/50 text-left">
                <Clock className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-semibold">Fast Execution</p>
                <p className="text-xs text-muted-foreground">Zero-latency outreach</p>
              </div>
              <div className="p-4 rounded-xl border bg-background/50 text-left">
                <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
                <p className="text-sm font-semibold">One-Click Updates</p>
                <p className="text-xs text-muted-foreground">Easy stage switching</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Right Column: Mini Activity Feed */}
      <div className="space-y-6 overflow-hidden flex flex-col">
        <Card className="flex-1 p-6 flex flex-col bg-white/60 dark:bg-[#0d212c]/60 backdrop-blur-md border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h3 className="text-lg font-bold">Activity Feed</h3>
            {selectedLead && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {selectedLead.name}
              </Badge>
            )}
          </div>
          
          <ScrollArea className="flex-1 pr-4">
            {selectedLead ? (
              <CRMActivityTimeline lead={selectedLead} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 py-20">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">Select a lead to view history</p>
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  )
}
