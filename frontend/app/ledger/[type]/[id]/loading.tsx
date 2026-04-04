import { DashboardLayout } from "@/components/dashboard-layout"
import { Loader2 } from "lucide-react"

export default function LedgerLoading() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading ledger data...</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

