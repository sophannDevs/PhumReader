"use client"

import { useEffect } from "react"
import { ErrorState } from "@/components/pr/error-state"

/** Route error boundary body: ErrorState whose Retry calls Next's `reset()`. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return <ErrorState className="container flex-1 justify-center py-24" onRetry={reset} />
}
