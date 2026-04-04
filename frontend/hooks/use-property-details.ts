"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const usePropertyDetails = (propertyId: string | number | null, open: boolean) => {
  const { data, error, mutate, isLoading } = useSWR(
    open && propertyId ? `property-${propertyId}` : null,
    () =>
      apiService.properties.getById(String(propertyId)).then((response) => {
        const payload = (response.data as any)?.data ?? response.data
        return payload
      }),
    { revalidateOnFocus: false }
  )

  return {
    propertyData: data || null,
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}
