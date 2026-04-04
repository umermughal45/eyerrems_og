import { DashboardLayout } from "@/components/dashboard-layout"
import { HRView } from "@/components/hr/hr-view"
import { getHRStatsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function HRPage() {
  const hrData = await getHRStatsServer()

  return (
    <DashboardLayout>
      <HRView initialData={hrData} />
    </DashboardLayout>
  )
}
