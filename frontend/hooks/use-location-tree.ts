"use client";

import useSWR from "swr";
import { apiService } from "@/lib/api";
import type { LocationTreeNode } from "@/lib/location";

const fetchLocationTree = async () => {
  const response = await apiService.locations.getTree();
  const responseData = response.data as any;
  return responseData?.data ?? responseData;
};

export function useLocationTree() {
  const { data, error, mutate, isValidating } = useSWR<LocationTreeNode[]>(
    "locations/tree",
    fetchLocationTree,
    {
      revalidateOnFocus: false, // Disabled to prevent rate limiting
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Reduced to 5 seconds for better responsiveness
      errorRetryCount: 2, // Retry only 2 times on error
      errorRetryInterval: 1000, // Wait 1 second between retries
      shouldRetryOnError: true,
    },
  );

  return {
    tree: data ?? [],
    isLoading: isValidating && !data && !error, // Only show loading if actively validating and no data/error
    isError: !!error,
    refresh: (options?: { revalidate?: boolean }) => {
      // Force revalidation when refresh is called
      if (options?.revalidate === false) {
        return mutate()
      }
      return mutate(undefined, { revalidate: true })
    },
    isValidating,
  };
}
