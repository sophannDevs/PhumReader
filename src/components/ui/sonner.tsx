"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

/**
 * White card, green check dot, md shadow, 2.6 s, bottom-right
 * (bottom-centre above the tab bar on phones). Light theme only.
 * Use `toast.success(...)` for the green check, `toast.error(...)` for
 * cancelled / failed.
 */
const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
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
          toast: "!shadow-md !text-sm !font-medium !gap-2.5 max-md:!bottom-[72px]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
