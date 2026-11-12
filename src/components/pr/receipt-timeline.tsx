import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

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
        <Effect key={i} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(i, 8) * 120} inView>
          <li
            className={cn(
              "relative flex items-start gap-3",
              i > 0 && "before:absolute before:-top-3.5 before:left-[5px] before:h-3.5 before:w-0.5 before:bg-border"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1 size-3 shrink-0 rounded-full",
                s.tone === "failed" ? "bg-destructive" : s.tone === "waiting" ? "bg-track" : "bg-primary"
              )}
            />
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-[13px] leading-[18px] font-semibold">{s.title}</span>
              {s.detail ? <span className="text-xs leading-4 text-muted-foreground">{s.detail}</span> : null}
            </span>
          </li>
        </Effect>
      ))}
    </ol>
  )
}
