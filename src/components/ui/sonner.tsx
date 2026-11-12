"use client"

import { useTheme } from "@/lib/theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon } from "@/components/animate-ui/icons/check"
import { InfoIcon } from "@/components/animate-ui/icons/info"
import { TriangleAlertIcon } from "@/components/animate-ui/icons/triangle-alert"
import { XIcon } from "@/components/animate-ui/icons/x"
import { Loader2Icon } from "lucide-react"

/**
 * Popover-coloured card (follows the theme), green check dot, md shadow, top-right.
 * Errors stay a little longer (5 s) so they can be read.
 * Use `toast.success(...)` for the green check, `toast.error(...)` for
 * cancelled / failed.
 */
const Toaster = (props: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      duration={2600}
      className="toaster group"
      icons={{
        success: (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
        ),
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: (
          <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <XIcon className="size-3" strokeWidth={3} />
          </span>
        ),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-md !text-sm !font-medium !gap-2.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
