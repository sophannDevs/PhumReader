"use client"

import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { useTranslations } from "@/i18n/translations"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/** Destructive icon, "Something went wrong", description and a Retry button. */
export function ErrorState({
  onRetry,
  title,
  description,
  className,
  extra,
}: {
  onRetry?: () => void
  title?: string
  description?: string
  className?: string
  extra?: React.ReactNode
}) {
  const t = useTranslations("states")
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }}>
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
        {onRetry || extra ? (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                {t("retry")}
              </Button>
            ) : null}
            {extra}
          </div>
        ) : null}
      </div>
    </Effect>
  )
}
