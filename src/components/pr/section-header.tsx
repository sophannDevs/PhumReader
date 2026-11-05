import { cn } from "@/lib/utils"

/** Home / page section heading: H2, optional muted subtitle, optional action on the right. */
export function SectionHeader({
  title,
  subtitle,
  action,
  id,
  className,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  id?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className="type-h2">
          {title}
        </h2>
        {subtitle ? <p className="type-body text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}
