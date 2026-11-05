"use client"

import { RouteError } from "@/components/pr/route-error"

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <RouteError {...props} />
    </div>
  )
}
