"use client";

import useSWR from "swr";
import { apiService } from "@/lib/api";
import type { LocationSubtreePayload } from "@/lib/location";

const fetchSubtree = async (id: string) => {
  const response = await apiService.locations.getSubtree(id);
  const responseData = response.data as any;
  return responseData?.data ?? responseData;
};

export function useSubtree(locationId?: string | null) {
  const shouldFetch = Boolean(locationId);
  const { data, error, mutate, isValidating } = useSWR<LocationSubtreePayload | null>(
    shouldFetch ? ["locations/subtree", locationId] : null,
    () => fetchSubtree(locationId!),
    {
      revalidateOnFocus: false,
    },
  );

  return {
    subtree: data,
    propertyCount: data?.propertyCount ?? 0,
    isLoading: shouldFetch && !data && !error,
    isError: !!error,
    refresh: mutate,
    isValidating,
  };
}

