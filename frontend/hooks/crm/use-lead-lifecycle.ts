"use client"

export const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
] as const

export const DEFAULT_LEAD_STAGE = "new"

export function useLeadLifecycle() {
  const getStageLabel = (value: string) => {
    return LEAD_STAGES.find((s) => s.value === value)?.label || value
  }

  return {
    LEAD_STAGES,
    DEFAULT_LEAD_STAGE,
    getStageLabel,
  }
}
