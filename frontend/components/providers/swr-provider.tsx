"use client"

import { SWRConfig } from "swr"

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 60000,
        focusThrottleInterval: 60000,
        errorRetryCount: 2,
        errorRetryInterval: 2000,
        onError: (error) => {
          if (error?.response?.status !== 429) {
            console.error("SWR Error:", error)
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  )
}
