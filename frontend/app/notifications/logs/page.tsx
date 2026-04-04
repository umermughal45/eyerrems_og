import { redirect } from "next/navigation"

export default function NotificationsLogsPage() {
  redirect("/notifications?tab=logs")
}

