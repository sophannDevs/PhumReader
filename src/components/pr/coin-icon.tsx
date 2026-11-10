import { cn } from "@/lib/utils"

const sizes = {
  14: "size-3.5 text-[8px]",
  16: "size-4 text-[9px]",
  20: "size-5 text-[11px]",
  32: "size-8 text-[17px]",
} as const

/** Amber coin with a dark "C". Decorative: pair it with text that says "coins". */
export function CoinIcon({
  size = 16,
  className,
}: {
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-coin leading-none font-extrabold text-coin-foreground shadow-[inset_0_-2px_0_rgba(120,53,15,0.25)] select-none",
        sizes[size],
        className
      )}
    >
      C
    </span>
  )
}
