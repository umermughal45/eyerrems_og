import { DashboardLayout } from "@/components/dashboard-layout"
import { PropertiesDetailsView } from "@/components/properties/properties-details-view"
import { getPropertiesDetailsServer } from "@/lib/stats-server"

export const dynamic = 'force-dynamic'

export default async function PropertiesDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedSearchParams = await searchParams
  const searchTerm = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search : undefined
  const initialData = await getPropertiesDetailsServer(searchTerm)

  return (
    <DashboardLayout>
      <PropertiesDetailsView initialData={initialData} />
    </DashboardLayout>
  )
}
