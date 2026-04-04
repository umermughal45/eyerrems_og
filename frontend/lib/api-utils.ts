/**
 * API Response Utilities
 * Provides type-safe helpers for handling API responses
 */

/**
 * Safely extract array data from API response
 * Handles both { data: [...] } and { data: { data: [...] } } structures
 */
export function extractArrayData<T = any>(responseData: any): T[] {
  if (Array.isArray(responseData?.data)) {
    return responseData.data as T[]
  }
  if (Array.isArray(responseData)) {
    return responseData as T[]
  }
  return []
}

/**
 * Safely extract object data from API response
 * Handles both { data: {...} } and { data: { data: {...} } } structures
 */
export function extractObjectData<T = any>(responseData: any): T | null {
  if (responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
    // Check if it's nested
    if (responseData.data.data && typeof responseData.data.data === 'object' && !Array.isArray(responseData.data.data)) {
      return responseData.data.data as T
    }
    return responseData.data as T
  }
  if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
    return responseData as T
  }
  return null
}

/**
 * Safely extract data from API response (works for both arrays and objects)
 */
export function extractData<T = any>(responseData: any): T | T[] | null {
  if (Array.isArray(responseData?.data)) {
    return responseData.data as T[]
  }
  if (Array.isArray(responseData)) {
    return responseData as T[]
  }
  if (responseData?.data && typeof responseData.data === 'object') {
    // Check if it's nested
    if (responseData.data.data) {
      return responseData.data.data as T
    }
    return responseData.data as T
  }
  if (responseData && typeof responseData === 'object') {
    return responseData as T
  }
  return null
}

