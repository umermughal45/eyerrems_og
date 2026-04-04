"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  ArrowRight, 
  StickyNote, 
  CheckSquare, 
  History,
  AlertCircle,
  Phone,
  MessageSquare,
  Zap,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiService } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"

interface Activity {
  id: string
  type: "status_change" | "note" | "call" | "system" | "stage_change" | "whatsapp"
  title: string
  description?: string
  timestamp: string | Date
  icon: any
  color: string
}

interface CRMActivityTimelineProps {
  lead: any
}

const CHANNEL_MAP: Record<string, { icon: any; color: string; title: string }> = {
  note:         { icon: StickyNote,    color: "text-blue-500",     title: "Note Added" },
  call:         { icon: Phone,         color: "text-emerald-500",  title: "Call Logged" },
  whatsapp:     { icon: MessageSquare, color: "text-green-500",    title: "WhatsApp" },
  stage_change: { icon: ArrowRight,    color: "text-purple-500",   title: "Stage Changed" },
  email:        { icon: Zap,           color: "text-amber-500",    title: "Email Sent" },
  sms:          { icon: MessageSquare, color: "text-cyan-500",     title: "SMS Sent" },
}

export function CRMActivityTimeline({ lead }: CRMActivityTimelineProps) {
  const [communications, setCommunications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lead?.id) return
    setLoading(true)
    apiService.communications.getAll()
      .then((res: any) => {
        const data = res?.data?.data || res?.data || []
        // Filter to only this lead's communications
        const leadComms = Array.isArray(data)
          ? data.filter((c: any) => c.leadId === lead.id || c.lead?.id === lead.id)
          : []
        setCommunications(leadComms)
      })
      .catch(() => {
        setCommunications([])
      })
      .finally(() => setLoading(false))
  }, [lead?.id])

  const activities = useMemo(() => {
    if (!lead) return []
    const items: Activity[] = []

    // 1. Lead Created system event
    const createdTime = lead.createdAt || lead.createdDate
    if (createdTime) {
      items.push({
        id: "create",
        type: "system",
        title: "Lead Created",
        description: `Source: ${lead.source || "Unknown"}`,
        timestamp: createdTime,
        icon: History,
        color: "text-blue-500",
      })
    }

    // 2. Last Update signal (if meaningfully different from created)
    if (lead.updatedAt && lead.updatedAt !== lead.createdAt && lead.updatedAt !== lead.createdDate) {
      items.push({
        id: "update",
        type: "status_change",
        title: "Lead Updated",
        description: `Current Status: ${(lead.status || "new").toUpperCase()}`,
        timestamp: lead.updatedAt,
        icon: CheckSquare,
        color: "text-purple-500",
      })
    }

    // 3. Real communications from API
    for (const comm of communications) {
      const mapping = CHANNEL_MAP[comm.channel] || { icon: Zap, color: "text-slate-500", title: comm.channel }
      items.push({
        id: comm.id,
        type: comm.channel as any,
        title: mapping.title,
        description: comm.content || comm.subject || undefined,
        timestamp: comm.createdAt || comm.date,
        icon: mapping.icon,
        color: mapping.color,
      })
    }

    // Sort descending
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [lead, communications])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading activity...</span>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">Actions like calls, notes, and stage changes will appear here.</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className="relative flex items-start gap-4 animate-in fade-in slide-in-from-left-2 duration-300"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm z-10",
            activity.color
          )}>
            <activity.icon className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 pt-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="text-sm font-semibold leading-none">{activity.title}</h5>
              <span className="text-[10px] text-muted-foreground font-medium">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </span>
            </div>
            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {activity.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
