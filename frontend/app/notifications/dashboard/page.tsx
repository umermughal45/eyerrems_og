import { redirect } from "next/navigation"

export default function NotificationsDashboardPage() {
  redirect("/notifications?tab=dashboard")
}

