"use client"

import { useParams, useRouter } from "next/navigation"
import { DealDetailRefactored } from "@/components/crm/deal-detail-refactored"

export default function DealDetailPage() {
  const params = useParams<{ id: string }>()
  const dealId = params.id

  if (!dealId) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-destructive">Deal ID is required</div>
      </div>
    )
  }

  return <DealDetailRefactored dealId={dealId} />
}
