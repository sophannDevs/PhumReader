import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  // 22 px tall, 8 px side padding, 6 px radius, 14 px icons (prototype shared.css .badge)
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-badge border border-transparent px-2 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border bg-background text-foreground",
        // "Unlocked", "Recommended"
        brand: "bg-brand-soft text-brand-ink",
        // new-episode "UP"
        up: "bg-up text-up-foreground",
        new: "bg-primary text-primary-foreground",
        // Fast Pass price, warnings (#B45309 on #FFFBEB: 4.8:1)
        warn: "bg-warning-soft text-warning",
        // failed payments (not in the prototype; borderless like the others)
        danger: "bg-destructive-soft text-destructive-ink",
        // on top of cover art
        dark: "bg-scrim text-surface-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
