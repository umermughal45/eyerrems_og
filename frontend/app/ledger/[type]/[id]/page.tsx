"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { LedgerView } from "@/components/finance/ledger-view"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Loader2 } from "lucide-react"

export default function LedgerPage() {
  const params = useParams()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  const type = params?.type as string | undefined
  const id = params?.id as string | undefined

  // Validate params
  if (!type || !id) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center text-destructive">
            <p className="text-lg font-semibold mb-2">Invalid Ledger Parameters</p>
            <p className="text-sm text-muted-foreground">
              Type: {type || "missing"} | ID: {id || "missing"}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const validTypes = ["client", "dealer", "property"]
  if (!validTypes.includes(type)) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center text-destructive">
            <p className="text-lg font-semibold mb-2">Invalid Ledger Type</p>
            <p className="text-sm text-muted-foreground">
              Type "{type}" is not valid. Must be one of: {validTypes.join(", ")}
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <LedgerView 
          type={type as "client" | "dealer" | "property"} 
          id={id} 
          showBackButton={true} 
        />
      </div>
    </DashboardLayout>
  )
}

