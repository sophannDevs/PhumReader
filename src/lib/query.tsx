"use client"

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { OfflineBanner } from "@/components/pr/offline-banner"
import { ReportProvider } from "@/components/pr/report-dialog"
import { Toaster } from "@/components/ui/sonner"
import { ApiError } from "@/lib/api/client"
import { reportError } from "@/lib/error-report"
import { SessionSync } from "@/lib/session-sync"
import { ModerationSync } from "@/lib/moderation"
import { SettingsSync } from "@/lib/settings-sync"
import { StoreHydrator } from "@/lib/store-hydrator"
import { ThemeProvider } from "@/lib/theme"

/**
 * Theme (light / dark / system), TanStack Query, the stored state, the API session and the Sonner
 * toaster, mounted once in the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 402 || error.status === 404)) {
              return
            }
            reportError(error)
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 402 || error.status === 404)) {
              return
            }
            reportError(error)
          },
        }),
        defaultOptions: { queries: { retry: 0, staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  )
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <OfflineBanner />
        <StoreHydrator />
        <SessionSync />
        <SettingsSync />
        <ModerationSync />
        <ReportProvider>{children}</ReportProvider>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
