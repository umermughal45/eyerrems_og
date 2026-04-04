"use client"

import { useMemo } from "react"
import { 
  AlertCircle, 
  MessageCircle, 
  Zap, 
  Clock,
  TrendingUp,
  CalendarClock,
  PhoneCall,
  AlertTriangle
} from "lucide-react"

export interface AutomationSuggestion {
  id: string
  type: "warning" | "info" | "success" | "urgent"
  title: string
  message: string
  icon: any
}

/**
 * useCRMAutomation
 * 
 * Frontend-only automation engine. Computes non-blocking suggestions
 * based on lead stage, budget, and activity recency. Zero backend dependency.
 */
export function useCRMAutomation(lead: any | null) {
  const suggestions = useMemo(() => {
    if (!lead) return []

    const items: AutomationSuggestion[] = []
    const now = new Date()
    const createdDate = lead.createdDate ? new Date(lead.createdDate) : now
    const updatedDate = lead.updatedAt ? new Date(lead.updatedAt) : createdDate

    const daysSinceUpdate = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysSinceCreate = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

    // Rule 1: New lead → suggest follow-up
    if (lead.status === "new") {
      items.push({
        id: "new-followup",
        type: "urgent",
        title: "Add Follow-Up",
        message: "New leads convert faster with a follow-up within 4 hours. Schedule one now.",
        icon: PhoneCall,
      })
    }

    // Rule 2: Contacted → suggest qualification
    if (lead.status === "contacted") {
      items.push({
        id: "qualify-next",
        type: "info",
        title: "Qualify this Lead",
        message: "Lead has been contacted. Assess budget and interest to move to Qualified.",
        icon: MessageCircle,
      })
    }

    // Rule 3: Negotiation → suggest meeting scheduling
    if (lead.status === "negotiation") {
      items.push({
        id: "schedule-meeting",
        type: "urgent",
        title: "Schedule a Meeting",
        message: "Lead is in Negotiation. A physical or virtual meeting can accelerate closing.",
        icon: CalendarClock,
      })
    }

    // Rule 4: Qualified but stale → push toward negotiation
    if (lead.status === "qualified" && daysSinceUpdate >= 5) {
      items.push({
        id: "push-to-negotiation",
        type: "warning",
        title: "Ready to Negotiate?",
        message: `This lead has been Qualified for ${daysSinceUpdate} days. Consider moving to Negotiation.`,
        icon: TrendingUp,
      })
    }

    // Rule 5: Inactive lead badge (3+ days without update, non-won/lost)
    if (daysSinceUpdate >= 3 && lead.status !== "won" && lead.status !== "lost") {
      items.push({
        id: "inactive-lead",
        type: "warning",
        title: "Inactive Lead",
        message: `No activity for ${daysSinceUpdate} days. Reach out to keep this deal moving.`,
        icon: Clock,
      })
    }

    // Rule 6: High-value prospect alert
    const budgetVal = lead.budget ? parseFloat(String(lead.budget).replace(/[^0-9.]/g, '')) : 0
    if (budgetVal > 1000000) {
      items.push({
        id: "high-value",
        type: "success",
        title: "High Value Prospect",
        message: "Premium budget detected. Consider assigning a senior agent or direct outreach by management.",
        icon: TrendingUp,
      })
    }

    // Rule 7: Missing notes gap
    if (!lead.notes || String(lead.notes).length < 10) {
      items.push({
        id: "missing-notes",
        type: "info",
        title: "Add Internal Notes",
        message: "Detailed notes help the team provide better context and continuity for this lead.",
        icon: Zap
      })
    }

    // Deduplicate by ID (safety measure)
    const seen = new Set<string>()
    return items.filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [lead])

  return {
    suggestions,
    hasSuggestions: suggestions.length > 0
  }
}
