import { Shine } from "@animate-ui/react/primitives/effects/shine"
import { cn } from "cn"

/** Loading placeholder: a soft highlight sweeps across it (Animate UI Shine). Still grey when motion is reduced. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Shine asChild loop loopDelay={300} duration={1400} color="#ffffff" opacity={0.7}>
      <div data-slot="skeleton" aria-hidden className={cn("rounded-md bg-muted", className)} {...props} />
    </Shine>
  )
}

export { Skeleton }
