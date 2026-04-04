"use client"

import useSWR from "swr"
import { apiService } from "@/lib/api"

type DropdownCategoryResponse = {
  data: {
    id: string
    key: string
    name: string
    description?: string
    options: {
      id: string
      label: string
      value: string
      sortOrder: number
      isActive: boolean
    }[]
  }[]
}

type DropdownByKeyResponse = {
  data: {
    id: string
    key: string
    name: string
    description?: string
    options: {
      id: string
      label: string
      value: string
      sortOrder: number
      isActive: boolean
    }[]
  }
  options: {
    id: string
    label: string
    value: string
    sortOrder: number
    isActive: boolean
  }[]
}

export const useDropdownCategories = () => {
  const { data, error, mutate, isLoading } = useSWR(
    "dropdown-categories",
    async () => {
      const response = await apiService.advanced.getDropdownCategories()
      return (response.data as any as DropdownCategoryResponse).data
    },
    { revalidateOnFocus: false }
  )

  return {
    categories: data || [],
    isLoading,
    error,
    mutate,
  }
}

const EMPTY_ARRAY: any[] = []

export const useDropdownOptions = (categoryKey?: string) => {
  const { data, error, mutate, isLoading } = useSWR(
    categoryKey ? ["dropdown", categoryKey] : null,
    async () => {
      try {
        const response = await apiService.advanced.getDropdownByKey(categoryKey!)
        const payload = response.data as any as DropdownByKeyResponse
        return payload.options || payload.data?.options || []
      } catch (err: any) {
        // Only log errors that aren't permission-related
        if (err?.response?.status !== 401 && err?.response?.status !== 403) {
          console.warn("Dropdown load failed", { categoryKey, err })
        }
        return []
      }
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false, // Don't retry on error
      errorRetryCount: 0, // Don't retry failed requests
    }
  )

  return {
    options: data || EMPTY_ARRAY,
    isLoading,
    isError: Boolean(error),
    mutate,
  }
}

