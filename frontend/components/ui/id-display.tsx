"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface IdDisplayProps {
  systemId?: string | null
  manualUniqueId?: string | null
  systemIdLabel?: string
  manualIdLabel?: string
  className?: string
}

/**
 * Reusable component to display both system ID and manual unique ID
 * Used in detail pages and forms
 */
export function IdDisplay({
  systemId,
  manualUniqueId,
  systemIdLabel = "System ID",
  manualIdLabel = "Manual Unique ID",
  className = "",
}: IdDisplayProps) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      <div className="space-y-2">
        <Label>{systemIdLabel}</Label>
        <Input
          value={systemId || "N/A"}
          disabled
          className="bg-muted text-muted-foreground font-mono"
        />
      </div>
      {manualUniqueId && (
        <div className="space-y-2">
          <Label>{manualIdLabel}</Label>
          <Input
            value={manualUniqueId}
            disabled
            className="bg-muted text-muted-foreground font-mono"
          />
        </div>
      )}
    </div>
  )
}

