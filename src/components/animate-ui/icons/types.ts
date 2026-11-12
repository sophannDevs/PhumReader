import type * as React from "react"

/** Any icon component (animated or lucide-react) that takes the props we pass. */
export type AnimatedIcon = React.ComponentType<{
  className?: string
  strokeWidth?: number
  size?: number
  "aria-hidden"?: boolean | "true" | "false"
}>
