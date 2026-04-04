import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"
import { getDashboardDataServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function IndexPage() {
  const dashboardData = await getDashboardDataServer()

  return (
    <DashboardLayout>
      <DashboardOverview initialData={dashboardData} />
    </DashboardLayout>
  )
}
