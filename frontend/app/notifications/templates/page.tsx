import { redirect } from "next/navigation"

export default function NotificationsTemplatesPage() {
  redirect("/notifications?tab=templates")
}

