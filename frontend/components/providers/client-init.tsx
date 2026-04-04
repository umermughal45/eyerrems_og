"use client"

import { useEffect } from "react"
import { useSettingsStore } from "@/lib/store/settings-store"

export function ClientInit() {
  const { initialize } = useSettingsStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const updateActivity = () => {
      if (typeof window !== "undefined") {
        const token = sessionStorage.getItem("token")
        if (token) {
          sessionStorage.setItem("lastActivity", Date.now().toString())
        }
      }
    }

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity)
      })
    }
  }, [])

  return null
}
