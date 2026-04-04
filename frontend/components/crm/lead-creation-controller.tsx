"use client"

import { useState } from "react"
import { QuickLeadCaptureModal } from "./quick-lead-capture-modal"
import { AddLeadDialog } from "./add-lead-dialog"

interface LeadCreationControllerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: any
  mode?: "create" | "edit"
}

export function LeadCreationController({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: LeadCreationControllerProps) {
  const [internalMode, setInternalMode] = useState<"quick" | "advanced">(
    mode === "edit" ? "advanced" : "quick"
  )
  const [overriddenInitialData, setOverriddenInitialData] = useState<any>(null)

  const handleOpenAdvanced = (data: any) => {
    // Transform quick form data to match AddLeadDialog's initialData structure
    setOverriddenInitialData({
      name: data.name,
      phone: data.phone,
      source: data.source,
      assignedToUserId: data.assignedToUserId,
    })
    setInternalMode("advanced")
  }

  const handleSuccess = () => {
    onSuccess?.()
    onOpenChange(false)
    // Reset to quick mode for next time (if it was a creation)
    setTimeout(() => {
      setInternalMode(mode === "edit" ? "advanced" : "quick")
      setOverriddenInitialData(null)
    }, 300)
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen) {
      // Reset after closing
      setTimeout(() => {
        setInternalMode(mode === "edit" ? "advanced" : "quick")
        setOverriddenInitialData(null)
      }, 300)
    }
  }

  return (
    <>
      {internalMode === "quick" ? (
        <QuickLeadCaptureModal
          open={open}
          onOpenChange={handleOpenChange}
          onOpenAdvanced={handleOpenAdvanced}
          onSuccess={handleSuccess}
        />
      ) : (
        <AddLeadDialog
          open={open}
          onOpenChange={handleOpenChange}
          onSuccess={handleSuccess}
          initialData={overriddenInitialData || initialData}
          mode={mode}
        />
      )}
    </>
  )
}
