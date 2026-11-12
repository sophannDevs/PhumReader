import { InboxIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Muted icon tile, title, description and an optional action (usually a
 * Button). Pass translated strings; `useTranslations("states")` has defaults.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = InboxIcon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }}>
      <div
        data-slot="empty-state"
        className={cn("flex flex-col items-center gap-3 px-4 py-12 text-center", className)}
      >
        <span className="flex size-12 items-center justify-center rounded-card bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
        <div className="flex max-w-sm flex-col gap-1">
          <h3 className="type-h3">{title}</h3>
          {description ? <p className="type-body text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </Effect>
  )
}
