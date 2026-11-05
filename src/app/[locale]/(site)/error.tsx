"use client"

import { RouteError } from "@/components/pr/route-error"

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />
}
