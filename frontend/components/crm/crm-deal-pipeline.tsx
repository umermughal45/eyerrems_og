"use client"

import { useState, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  MoreVertical, 
  Mail, 
  Phone, 
  Calendar, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Zap,
  ArrowRight,
  MessageSquare,
  History,
  AlertTriangle,
  Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCRMAutomation } from "@/hooks/use-crm-automation"
import { formatDistanceToNow } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

// Define Pipeline Stages based on enterprise requirements
const STAGES = [
  { id: "new", title: "NEW", color: "bg-blue-500" },
  { id: "contacted", title: "CONTACTED", color: "bg-cyan-500" },
  { id: "qualified", title: "QUALIFIED", color: "bg-emerald-500" },
  { id: "negotiation", title: "NEGOTIATION", color: "bg-amber-500" },
  { id: "won", title: "WON", color: "bg-green-600" },
  { id: "lost", title: "LOST", color: "bg-red-500" },
]

interface CRMDealPipelineProps {
  leads: any[]
  onLeadClick: (lead: any) => void
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>
}

export function CRMDealPipeline({ leads, onLeadClick, onStatusChange }: CRMDealPipelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeLead, setActiveLead] = useState<any | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Group leads by status
  const columns = useMemo(() => {
    return STAGES.map(stage => ({
      ...stage,
      leads: leads.filter(l => (l.status || "new").toLowerCase() === stage.id)
    }))
  }, [leads])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    setActiveLead(leads.find(l => l.id === active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setActiveLead(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find if we dropped onto a column or an item in another column
    const drugLead = leads.find(l => l.id === activeId)
    if (!drugLead) return

    let newStatus = overId
    // If overId is a lead ID, find its status
    const overLead = leads.find(l => l.id === overId)
    if (overLead) {
      newStatus = overLead.status || "new"
    }

    // Only update if status changed
    if (drugLead.status !== newStatus && STAGES.some(s => s.id === newStatus)) {
      await onStatusChange(activeId, newStatus)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
        {columns.map((column) => (
          <PipelineColumn
            key={column.id}
            id={column.id}
            title={column.title}
            color={column.color}
            leads={column.leads}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeId && activeLead ? (
          <div className="w-[300px] rotate-3 opacity-90">
            <LeadCard lead={activeLead} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function PipelineColumn({ id, title, color, leads, onLeadClick }: any) {
  return (
    <div className="flex-shrink-0 w-[300px] flex flex-col gap-3">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-6 rounded-full", color)} />
          <h3 className="font-semibold text-sm uppercase tracking-wider">{title}</h3>
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5">
            {leads.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext
        id={id}
        items={leads.map((l: any) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <ScrollArea className="flex-1 rounded-xl bg-muted/30 p-2 min-h-[500px]">
          <div className="space-y-3 pb-4">
            {leads.map((lead: any) => (
              <SortableLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead)}
              />
            ))}
            {leads.length === 0 && (
              <div className="h-24 flex items-center justify-center border-2 border-dashed rounded-lg border-muted-foreground/10 px-4 text-center">
                <p className="text-xs text-muted-foreground">Move leads here or update stage</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  )
}

function SortableLeadCard({ lead, onClick }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "opacity-0")}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  )
}

function LeadCard({ lead, isDragging, onClick }: any) {
  const { hasSuggestions } = useCRMAutomation(lead)
  const { toast } = useToast()

  const lastActivityDate = lead.updatedAt ? new Date(lead.updatedAt) : lead.createdAt ? new Date(lead.createdAt) : null
  const isStale = lastActivityDate && (new Date().getTime() - lastActivityDate.getTime() > 2 * 24 * 60 * 60 * 1000)
  
  const handleQuickAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    if (action === "call" && lead.phone) {
      window.open(`tel:${lead.phone}`)
    } else if (action === "whatsapp" && lead.phone) {
      const phone = lead.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`)
    } else {
      // For Note or Stage, we open the drawer which now has these actions front and center
      onClick?.()
    }
  }

  return (
    <Card 
      onClick={onClick}
      className={cn(
      "p-3 cursor-pointer hover:shadow-md transition-all border-l-4 group relative overflow-hidden",
      lead.status === "negotiation" ? "border-l-orange-500 shadow-orange-500/5" : 
      lead.status === "qualified" ? "border-l-purple-500 shadow-purple-500/5" : 
      lead.status === "new" ? "border-l-blue-500 shadow-blue-500/5" :
      "border-l-slate-400",
      isDragging && "shadow-xl border-primary ring-2 ring-primary/20",
      isStale && "bg-amber-50/30 dark:bg-amber-900/10"
    )}>
      {/* Background execution layer hint */}
      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
         <div className="flex bg-background/80 backdrop-blur-sm rounded-md border shadow-sm p-1 gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={(e) => handleQuickAction(e, "call")}>
              <Phone className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={(e) => handleQuickAction(e, "whatsapp")}>
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
         </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm leading-none truncate">{lead.name}</p>
              {isStale && (
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" title="Follow-up Required" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
               <Phone className="h-2.5 w-2.5" /> {lead.phone || "No Phone"}
            </p>
          </div>
          <Badge variant="outline" className="text-[9px] h-4 px-1 bg-background shrink-0">
            {lead.assignedTo || "Unassigned"}
          </Badge>
        </div>

        {/* Activity Signal Row */}
        {isStale && (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-sm border border-amber-100 dark:border-amber-900/30">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-medium">Follow-up required</span>
          </div>
        )}

        <div className="space-y-1">
          {lead.interest && (
            <div className="flex items-center gap-2 text-[10px] font-medium text-foreground px-1.5 py-0.5 bg-muted/50 rounded flex-wrap">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="truncate">{lead.interest}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-primary transition-colors">
            <History className="h-3 w-3" />
            <span>{lastActivityDate ? `${formatDistanceToNow(lastActivityDate)} ago` : "No activity"}</span>
          </div>
          <div className="flex items-center gap-2">
            {lead.budget && (
              <span className="font-bold text-primary">{lead.budget}</span>
            )}
            <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
          </div>
        </div>
      </div>
    </Card>
  )
}
