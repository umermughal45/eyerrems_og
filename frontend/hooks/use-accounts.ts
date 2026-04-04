"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

export const useAccounts = () => {
  const { data, error, mutate, isLoading } = useSWR(
    "accounts",
    () =>
      apiService.accounts.getAll().then((response) => {
        const payload = response.data as any
        return Array.isArray(payload?.data ?? payload)
          ? (payload.data ?? payload)
          : []
      }),
    { revalidateOnFocus: false }
  )

  return {
    accounts: data || [],
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}
