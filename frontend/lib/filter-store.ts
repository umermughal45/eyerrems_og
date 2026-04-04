/**
 * Filter Store
 * Persists FilterState per entity/tab using localStorage.
 * Single source of truth for all list filters.
 */

import type { FilterState } from "@/components/shared/unified-filter-drawer"

const STORAGE_PREFIX = "rems_filters_"

function getStorageKey(entity: string, tab?: string): string {
  return `${STORAGE_PREFIX}${entity}${tab ? `_${tab}` : ""}`
}

/**
 * Save filters for an entity/tab (unified FilterState)
 */
export function saveFilters(entity: string, tab: string | undefined, filters: FilterState): void {
  if (typeof window === "undefined") return
  try {
    const key = getStorageKey(entity, tab)
    localStorage.setItem(key, JSON.stringify(filters))
  } catch (error) {
    console.error("Failed to save filters:", error)
  }
}

/**
 * Load filters for an entity/tab
 */
export function loadFilters(entity: string, tab: string | undefined): FilterState | null {
  if (typeof window === "undefined") return null
  try {
    const key = getStorageKey(entity, tab)
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as FilterState
    }
  } catch (error) {
    console.error("Failed to load filters:", error)
  }
  return null
}

/**
 * Clear filters for an entity/tab
 */
export function clearFilters(entity: string, tab: string | undefined): void {
  if (typeof window === "undefined") return
  try {
    const key = getStorageKey(entity, tab)
    localStorage.removeItem(key)
  } catch (error) {
    console.error("Failed to clear filters:", error)
  }
}
