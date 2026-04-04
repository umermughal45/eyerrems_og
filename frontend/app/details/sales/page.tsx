import { DashboardLayout } from "@/components/dashboard-layout"
import { SalesDetailsView } from "@/components/sales/sales-details-view"
import { getSalesDetailsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const initialData = await getSalesDetailsServer()

  return (
    <DashboardLayout>
      <SalesDetailsView initialData={initialData} />
    </DashboardLayout>
  )
}
