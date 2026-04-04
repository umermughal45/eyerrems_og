import { DashboardLayout } from "@/components/dashboard-layout"
import { EmployeesDetailsView } from "@/components/hr/employees-details-view"
import { getEmployeesDetailsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function EmployeesDetailsPage() {
  const initialData = await getEmployeesDetailsServer()

  return (
    <DashboardLayout>
      <EmployeesDetailsView initialData={initialData} />
    </DashboardLayout>
  )
}
