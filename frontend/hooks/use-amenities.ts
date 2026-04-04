"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const useAmenities = () => {
  const { data, error, mutate, isLoading } = useSWR(
    "amenities",
    () =>
      apiService.advanced.getAmenities().then((response) => {
        const payload = response.data as any
        return payload?.data || payload || []
      }),
    { revalidateOnFocus: false }
  )

  return {
    amenities: data || [],
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}

