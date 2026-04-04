import { DashboardLayout } from "@/components/dashboard-layout"
import { FinanceView } from "@/components/finance/finance-view"
import { getFinancePageStatsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const financeData = await getFinancePageStatsServer()

  return (
    <DashboardLayout>
      <FinanceView initialData={financeData} />
    </DashboardLayout>
  )
}
