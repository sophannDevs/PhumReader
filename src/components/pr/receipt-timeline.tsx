import { cn } from "@/lib/utils"

export type TimelineStep = {
  title: string
  detail?: string
  /** done = green dot, failed = red dot, waiting = grey dot */
  tone?: "done" | "failed" | "waiting"
}

/**
 * Timeline (foundations §8, prototype Receipt `.rc-tl`): 12 px dots (green done, red failed, grey waiting) joined
 * by a 2 px line, each with a bold title and a caption.
 */
export function Timeline({ steps, className, ...props }: { steps: TimelineStep[]; className?: string } & React.ComponentProps<"ol">) {
  return (
    <ol className={cn("m-0 flex list-none flex-col gap-3.5 p-0", className)} {...props}>
      {steps.map((s, i) => (
        <li
          key={i}
          className={cn(
            "relative flex items-start gap-3",
            i > 0 && "before:absolute before:-top-3.5 before:left-[5px] before:h-3.5 before:w-0.5 before:bg-border"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "mt-1 size-3 shrink-0 rounded-full",
              s.tone === "failed" ? "bg-destructive" : s.tone === "waiting" ? "bg-[#d4d4d8]" : "bg-primary"
            )}
          />
          <span className="flex min-w-0 flex-col gap-px">
            <span className="text-[13px] leading-[18px] font-semibold">{s.title}</span>
            {s.detail ? <span className="text-xs leading-4 text-muted-foreground">{s.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
