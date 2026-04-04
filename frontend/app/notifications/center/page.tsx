import { redirect } from "next/navigation"

export default function NotificationsCenterPage() {
  redirect("/notifications?tab=center")
}

