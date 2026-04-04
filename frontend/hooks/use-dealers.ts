"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const useDealers = () => {
  const { data, error, mutate, isLoading } = useSWR(
    "dealers",
    () =>
      apiService.dealers.getAll().then((response) => {
        const payload = response.data as any
        return Array.isArray(payload?.data ?? payload)
          ? (payload.data ?? payload).map((d: any) => ({ id: d.id, name: d.name, tid: d.tid }))
          : []
      }),
    { revalidateOnFocus: false }
  )

  return {
    dealers: data || [],
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}
