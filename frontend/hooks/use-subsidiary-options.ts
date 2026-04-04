"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const useSubsidiaryOptions = (locationId: string | null) => {
  const { data, error, mutate, isLoading } = useSWR(
    locationId ? `subsidiary-options-${locationId}` : null,
    () =>
      apiService.subsidiaries.getOptionsByLocation(locationId!).then((response) => {
        const payload = response.data as any
        const data = payload?.data || payload || []
        return Array.isArray(data)
          ? data.map((opt: any) => ({ id: opt.id, name: opt.name }))
          : []
      }).catch((err) => {
        console.warn('Failed to load subsidiary options:', err)
        return []
      }),
    { revalidateOnFocus: false }
  )

  return {
    options: data || [],
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}
