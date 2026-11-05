"use client"

import { AlertCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Destructive icon, "Something went wrong", description and a Retry button. */
export function ErrorState({
  onRetry,
  title,
  description,
  className,
}: {
  onRetry?: () => void
  title?: string
  description?: string
  className?: string
}) {
  const t = useTranslations("states")
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn("flex flex-col items-center gap-3 px-4 py-12 text-center", className)}
    >
      <span className="flex size-12 items-center justify-center rounded-card bg-destructive-soft text-destructive">
        <AlertCircleIcon className="size-6" />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h3 className="type-h3">{title ?? t("errorTitle")}</h3>
        <p className="type-body text-muted-foreground">{description ?? t("errorDescription")}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-1">
          {t("retry")}
        </Button>
      ) : null}
    </div>
  )
}
