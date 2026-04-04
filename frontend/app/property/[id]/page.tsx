import { DashboardLayout } from "@/components/dashboard-layout"
import { PropertyDetailPage } from "@/components/properties/property-detail-page"

export default function PropertyDetailRoute() {
  return (
    <DashboardLayout>
      <PropertyDetailPage />
    </DashboardLayout>
  )
}

