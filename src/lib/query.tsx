"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/lib/theme"
import { useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { SessionSync } from "@/lib/session-sync"
import { StoreHydrator } from "@/lib/store-hydrator"

/**
 * Theme (light / dark / system), TanStack Query, the stored state, the API session and the Sonner
 * toaster, mounted once in the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 0, staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  )
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <StoreHydrator />
        <SessionSync />
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
