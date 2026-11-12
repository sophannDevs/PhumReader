import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { LoaderIcon as Loader2Icon } from "@/components/animate-ui/icons/loader"
import { Slot } from "radix-ui"
import { AnimateIcon } from "@animate-ui/react/icons"

const buttonVariants = cva(
  // 8 px radius, 2 px --ring focus ring with a 2 px gap in the page colour.
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // dark
        default: "bg-foreground text-background hover:bg-foreground/90",
        // green: dark green text, never white
        brand:
          "bg-primary font-semibold text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-border",
        outline:
          "border-border bg-background text-foreground shadow-xs hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        link: "rounded-sm px-0 text-brand-ink underline underline-offset-4 hover:text-brand-ink/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        default: "h-9 px-4",
        lg: "h-11 rounded-[10px] px-[22px] text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner and disables the button (prevents double submits). */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    // Hovering anywhere on the button plays the animation of the icons inside it.
    <AnimateIcon asChild animateOnHover>
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2Icon className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
    </AnimateIcon>
  )
}

export { Button, buttonVariants }
