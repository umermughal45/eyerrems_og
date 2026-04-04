"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const useLeafLocations = (enabled: boolean = true) => {
  const { data, error, mutate, isLoading, isValidating } = useSWR(
    enabled ? "leaf-locations" : null,
    () =>
      apiService.locations.getLeaves().then((response) => {
        const payload = response.data as any
        const data = payload?.data || payload || []
        return Array.isArray(data) ? data : []
      }),
    { 
      revalidateOnFocus: false,
      dedupingInterval: 60000 
    }
  )

  return {
    locations: data || [],
    isLoading,
    isValidating,
    isError: Boolean(error),
    mutate,
  }
}
