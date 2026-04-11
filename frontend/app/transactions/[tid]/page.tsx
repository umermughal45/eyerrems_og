import { DashboardLayout } from "@/components/dashboard-layout"
import { TransactionDetailView } from "@/components/crm/transaction-detail-view"

export const dynamic = 'force-dynamic'

export default async function TransactionDetailPage({ params }: { params: Promise<{ tid: string }> }) {
  const { tid } = await params
  return (
    <DashboardLayout>
      <TransactionDetailView tid={decodeURIComponent(tid)} />
    </DashboardLayout>
  )
}
