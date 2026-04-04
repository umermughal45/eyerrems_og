import { redirect } from "next/navigation"

export default function NotificationsRemindersPage() {
  redirect("/notifications?tab=reminders")
}

