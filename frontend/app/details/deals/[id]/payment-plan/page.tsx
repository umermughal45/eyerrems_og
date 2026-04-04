"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PaymentPlanPageView } from "@/components/crm/payment-plan-page-view"

export default function PaymentPlanPage() {
  const params = useParams()
  const dealId = params.id as string

  return (
    <DashboardLayout>
      <PaymentPlanPageView dealId={dealId} />
    </DashboardLayout>
  )
}

