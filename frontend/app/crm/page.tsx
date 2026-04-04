import { DashboardLayout } from "@/components/dashboard-layout"
import { CRMView } from "@/components/crm/crm-view"
import { CRMErrorBoundary } from "@/components/crm/error-boundary"
import { getCRMPageStatsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  const crmData = await getCRMPageStatsServer()

  return (
    <DashboardLayout>
      <CRMErrorBoundary>
        <CRMView initialData={crmData} />
      </CRMErrorBoundary>
    </DashboardLayout>
  )
}
