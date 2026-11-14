"use client"

import { CheckIcon } from "@/components/animate-ui/icons/check"
import type { AnimatedIcon } from "@/components/animate-ui/icons/types"
import { AnimateIcon } from "@animate-ui/react/icons"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { SlidingTab, SlidingTabs } from "@/components/ui/sliding-tabs"

/**
 * Small V2.1 building blocks from design/prototype-src/shared.css and the page CSS:
 * - StateBox: `.state` dashed box with a round icon (section-level loading errors and empty results)
 * - Chip: `.chip` round filter / pick button (selected = dark fill), with an optional count
 * - Segmented: `.tabs-list` pill track used as a radio group (type filters, ranking tabs)
 * - Eyebrow / SectionHead: `.eyebrow` and `.sec-head`
 */

export function StateBox({
  icon: Icon,
  tone = "default",
  title,
  text,
  action,
  className,
  role,
}: {
  icon: AnimatedIcon
  tone?: "default" | "bad"
  title: string
  text?: string
  action?: React.ReactNode
  className?: string
  role?: "alert" | "status"
}) {
  return (
    <div
      role={role ?? (tone === "bad" ? "alert" : undefined)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-border-hover px-5 py-9 text-center",
        className
      )}
    >
      {/* The icon plays once when the state comes into view. */}
      <AnimateIcon asChild animateOnView>
        <span
          aria-hidden
          className={cn(
            "mb-1 inline-flex size-11 items-center justify-center rounded-full",
            tone === "bad" ? "bg-destructive-soft text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" />
        </span>
      </AnimateIcon>
      <p className="text-[15px] leading-[22px] font-semibold">{title}</p>
      {text ? <p className="text-[13px] leading-[18px] text-muted-foreground">{text}</p> : null}
      {action}
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  count,
  check = false,
  role,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
  /** Show a check icon when selected (multi-select picks) */
  check?: boolean
  /** "radio" for single choice groups; otherwise a toggle button with aria-pressed */
  role?: "radio"
  className?: string
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "radio" ? selected : undefined}
      aria-pressed={role === "radio" ? undefined : selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected ? "border-foreground bg-foreground text-[#fafafa] dark:text-background" : "bg-background text-foreground hover:bg-accent",
        className
      )}
    >
      {check && selected ? <CheckIcon className="size-3" aria-hidden /> : null}
      {children}
      {count !== undefined ? (
        <span className={cn("text-[11px] tabular-nums", selected ? "text-[#d4d4d8] dark:text-border-strong" : "text-muted-foreground")}><Num>{count}</Num></span>
      ) : null}
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  stretch = false,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  /** Full width with equal options */
  stretch?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] text-muted-foreground [scrollbar-width:none]",
        stretch && "flex w-full",
        className
      )}
    >
      <SlidingTabs value={value} pill="inset-0 rounded-[7px] bg-background shadow-[0_1px_3px_rgba(9,9,11,0.1)]">
      {options.map((o) => {
        const on = o.value === value
        return (
          <SlidingTab key={o.value} value={o.value} className={cn("inline-flex shrink-0", stretch && "flex-1")}>
          <button
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-[30px] w-full items-center justify-center gap-1.5 rounded-[7px] px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              on && "text-foreground"
            )}
          >
            {o.label}
          </button>
          </SlidingTab>
        )
      })}
      </SlidingTabs>
    </div>
  )
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("type-eyebrow", className)}>{children}</p>
}

/** `.sec-head`: title + muted line on the left, an action on the right (wraps on narrow screens). */
export function SectionHead({
  id,
  title,
  subtitle,
  action,
  size = "h3",
  icon: Icon,
  className,
}: {
  id?: string
  title: string
  subtitle?: string
  action?: React.ReactNode
  size?: "h2" | "h3"
  icon?: AnimatedIcon
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className={cn("flex items-center gap-2", size === "h2" ? "type-h2" : "type-h3")}>
          {Icon ? <Icon className="size-[18px]" aria-hidden /> : null}
          {title}
        </h2>
        {subtitle ? <p className="text-[13px] leading-[18px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Phone swipe row (`.hrow` under 768 px): a grid on larger screens, a snapping horizontal row on phones. */
export const phoneSwipeRow =
  "max-md:grid-flow-col max-md:grid-cols-none max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:-mx-4 max-md:px-4 max-md:pb-1 max-md:scroll-px-4 max-md:gap-3 max-md:[scrollbar-width:none] max-md:[&>*]:snap-start"
