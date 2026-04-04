"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { apiService } from "@/lib/api"
import useSWR from "swr"

export type SearchableOption = {
  id: string
  label: string
  value: string
  subtitle?: string
  disabled?: boolean
  metadata?: Record<string, any>
}

export type SearchableDataSource =
  | "clients"
  | "properties"
  | "employees"
  | "accounts"
  | "deals"
  | "dealers"
  | "tenants"
  | "units"
  | "locations"

type UseSearchableOptionsConfig = {
  source: SearchableDataSource
  searchQuery?: string
  enabled?: boolean
  limit?: number
  filters?: Record<string, any>
  transform?: (item: any) => SearchableOption
  preload?: boolean // Preload all data for small datasets
  debounceMs?: number
}

const DEFAULT_TRANSFORMS: Record<SearchableDataSource, (item: any) => SearchableOption> = {
  clients: (item) => ({
    id: item.id,
    label: item.name || item.id,
    value: item.id,
    subtitle: item.tid ? `TID: ${item.tid}` : item.email,
    metadata: item,
  }),
  properties: (item) => ({
    id: item.id,
    label: item.name || item.address || item.id,
    value: item.id,
    subtitle: item.tid ? `[${item.tid}]` : item.type || item.propertyCode,
    disabled: item.status === "Sold",
    metadata: item,
  }),
  employees: (item) => ({
    id: item.id,
    label: item.name || item.employeeId || item.id,
    value: item.id,
    subtitle: item.employeeId || item.email,
    metadata: item,
  }),
  accounts: (item) => ({
    id: item.id,
    label: `${item.code} - ${item.name}`,
    value: item.id,
    subtitle: item.type,
    metadata: item,
  }),
  deals: (item) => ({
    id: item.id,
    label: item.title || item.id,
    value: item.id,
    subtitle: item.tid ? `TID: ${item.tid}` : item.clientName,
    metadata: item,
  }),
  dealers: (item) => ({
    id: item.id,
    label: item.name || item.id,
    value: item.id,
    subtitle: item.tid ? `TID: ${item.tid}` : item.email,
    metadata: item,
  }),
  tenants: (item) => ({
    id: item.id,
    label: item.name || item.id,
    value: item.id,
    subtitle: item.tenantCode || item.email,
    metadata: item,
  }),
  units: (item) => ({
    id: item.id,
    label: item.unitName || item.id,
    value: item.id,
    subtitle: item.propertyName || item.status,
    metadata: item,
  }),
  locations: (item) => ({
    id: item.id,
    label: item.path || item.name,
    value: item.id,
    subtitle: item.type,
    metadata: item,
  }),
}

const DATA_SOURCE_FETCHERS: Record<
  SearchableDataSource,
  (params: { search?: string; limit?: number; filters?: Record<string, any> }) => Promise<any>
> = {
  clients: async ({ search, limit, filters }) => {
    const response = await apiService.clients.getAll({ search, limit, page: 1 })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  properties: async ({ search, limit, filters }) => {
    const response = await apiService.properties.getAll({
      search,
      limit,
      page: 1,
      status: filters?.status,
      type: filters?.type,
      locationId: filters?.locationId,
    })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  employees: async ({ search, limit }) => {
    const response = await apiService.employees.getAll({ search, limit })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  accounts: async ({ search, limit, filters }) => {
    const response = await apiService.accounts.getAll({ search, limit, ...filters })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  deals: async ({ search, limit }) => {
    const response = await apiService.deals.getAll({ search, limit, page: 1 })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  dealers: async ({ search, limit }) => {
    const response = await apiService.dealers.getAll({ search, limit, page: 1 })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  tenants: async ({ search, limit }) => {
    const response = await apiService.tenants.getAll({ search })
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
  units: async ({ search, limit }) => {
    const response = await apiService.units.getAll()
    const data = (response.data as any)?.data || response.data || []
    const all = Array.isArray(data) ? data : []
    if (search) {
      const query = search.toLowerCase()
      return all
        .filter(
          (item: any) =>
            item.unitName?.toLowerCase().includes(query) ||
            item.propertyName?.toLowerCase().includes(query),
        )
        .slice(0, limit || 50)
    }
    return all.slice(0, limit || 50)
  },
  locations: async ({ search, limit }) => {
    if (search) {
      const response = await apiService.locations.search(search)
      const data = (response.data as any)?.data || response.data || []
      return Array.isArray(data) ? data : []
    }
    const response = await apiService.locations.getLeaves()
    const data = (response.data as any)?.data || response.data || []
    return Array.isArray(data) ? data : []
  },
}

export function useSearchableOptions({
  source,
  searchQuery = "",
  enabled = true,
  limit = 50,
  filters = {},
  transform,
  preload = false,
  debounceMs = 300,
}: UseSearchableOptionsConfig) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)
  const [isDebouncing, setIsDebouncing] = useState(false)

  // Debounce search query
  useEffect(() => {
    if (!enabled) return

    setIsDebouncing(true)
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setIsDebouncing(false)
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      setIsDebouncing(false)
    }
  }, [searchQuery, debounceMs, enabled])

  // Determine if we should use server-side search or local filtering
  const shouldSearchServer = useMemo(() => {
    if (preload) return false
    // Use server search for sources that support it
    return ["clients", "properties", "accounts", "dealers", "tenants", "locations"].includes(source)
  }, [source, preload])

  const transformFn = transform || DEFAULT_TRANSFORMS[source]
  const fetcher = DATA_SOURCE_FETCHERS[source]

  // Fetch data
  const { data, error, isLoading, mutate } = useSWR(
    enabled
      ? [`searchable-options`, source, shouldSearchServer ? debouncedQuery : "", limit, filters]
      : null,
    async () => {
      const results = await fetcher({
        search: shouldSearchServer ? debouncedQuery : undefined,
        limit: preload ? undefined : limit,
        filters,
      })

      // Apply local filtering if not using server search
      let filtered = results
      if (!shouldSearchServer && debouncedQuery) {
        const query = debouncedQuery.toLowerCase()
        filtered = results.filter((item: any) => {
          const option = transformFn(item)
          return (
            option.label.toLowerCase().includes(query) ||
            option.subtitle?.toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query)
          )
        })
      }

      return filtered.map(transformFn)
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  )

  // Preload all data for small datasets
  const { data: preloadedData } = useSWR(
    enabled && preload ? [`searchable-options-preload`, source] : null,
    async () => {
      const results = await fetcher({ limit: undefined, filters })
      return results.map(transformFn)
    },
    {
      revalidateOnFocus: false,
    },
  )

  const options = preload ? preloadedData || [] : data || []
  const loading = isLoading || isDebouncing

  return {
    options,
    isLoading: loading,
    error,
    mutate,
  }
}
