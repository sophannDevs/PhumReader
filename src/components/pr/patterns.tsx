"use client"

import { CheckIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { CountingNumber } from "@animate-ui/react/primitives/texts/counting-number"

/**
 * V2.1 patterns shared by several pages (foundations.md §8 "Patterns added"):
 * - StepsBar: numbered steps (Coins, Create series, Welcome). Current = dark fill, done = green with ✓.
 * - OptionCard: radio as a card (unlock choice, report reasons, payout method, reading mode). Selected = green border,
 *   1 px ring and #F6FEF9. Use inside an element with role="radiogroup".
 * - UndoBar + useUndo: dark toast-like bar with Undo for 6 s (Library, Notifications, Admin).
 * - StatCard: label, 26 px number, coloured change line (Dashboard, Earnings, Admin).
 */

export type Step = { label: string }

export function StepsBar({
  steps,
  current,
  label,
  className,
}: {
  steps: Step[]
  /** 0-based index of the current step; steps before it are done. `steps.length` = all done. */
  current: number
  label: string
  className?: string
}) {
  return (
    <ol aria-label={label} className={cn("m-0 flex list-none flex-wrap items-center gap-2.5 p-0 max-md:gap-1.5", className)}>
      {steps.map((s, i) => {
        const done = i < current
        const cur = i === current
        return (
          <li key={i} aria-current={cur ? "step" : undefined} className="flex items-center gap-2 max-md:gap-1.5">
            <span
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : cur
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground"
              )}
            >
              {done ? <CheckIcon className="size-3.5" aria-hidden /> : <Num>{i + 1}</Num>}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium whitespace-nowrap max-md:text-xs",
                cur ? "text-foreground" : done ? "text-brand-ink" : "text-muted-foreground"
              )}
            >
              {s.label}
              {done ? <span className="sr-only"> ✓</span> : null}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden className={cn("ml-0.5 h-px w-12 max-md:w-5", done ? "bg-primary" : "bg-border")} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  aside,
  disabled,
  className,
  children,
}: {
  selected: boolean
  onSelect: () => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Right side: a price, a badge… */
  aside?: React.ReactNode
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-[10px] border bg-background px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary bg-selected shadow-[0_0_0_1px_var(--primary)]" : "hover:bg-[#fafafa]",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-px inline-flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
          selected ? "border-brand-ink" : "border-[#a1a1aa]"
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-brand-ink" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-medium">{title}</span>
        {description ? <span className="text-xs leading-4 text-muted-foreground">{description}</span> : null}
        {children}
      </span>
      {aside ? <span className="shrink-0">{aside}</span> : null}
    </button>
  )
}

/** Dark bar with a message and Undo (prototype `.undo`). Render it where the page shows it, e.g. above a list. */
export function UndoBar({ text, onUndo, className }: { text: string; onUndo: () => void; className?: string }) {
  const t = useTranslations("states")
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 rounded-[10px] bg-foreground py-2.5 pr-2.5 pl-4 text-sm text-[#fafafa]",
        className
      )}
    >
      <span className="min-w-0">{text}</span>
      <Button size="sm" onClick={onUndo} className="bg-[#fafafa] text-foreground hover:bg-[#e4e4e7]">
        {t("undo")}
      </Button>
    </div>
  )
}

/**
 * State for an UndoBar: `show(text, undo)` opens it for 6 s (then it closes and the change stays); `undo()` runs the
 * saved callback and closes it. A newer `show` replaces the older one (its change stays).
 */
export function useUndo(ms = 6000) {
  const [current, setCurrent] = useState<{ text: string; undo: () => void } | null>(null)
  // The open bar, also in a ref: `undo` runs its callback outside a state updater (an updater runs during render,
  // twice in Strict Mode, so a store update there warns "Cannot update a component while rendering").
  const latest = useRef<{ text: string; undo: () => void } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const show = useCallback(
    (text: string, undo: () => void) => {
      clearTimeout(timer.current)
      latest.current = { text, undo }
      setCurrent(latest.current)
      timer.current = setTimeout(() => {
        latest.current = null
        setCurrent(null)
      }, ms)
    },
    [ms]
  )
  const undo = useCallback(() => {
    clearTimeout(timer.current)
    const open = latest.current
    latest.current = null
    setCurrent(null)
    open?.undo()
  }, [])
  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    latest.current = null
    setCurrent(null)
  }, [])

  return { current, show, undo, dismiss }
}

export function StatCard({
  label,
  value,
  change,
  tone = "muted",
  href,
  placeholder = false,
  countUp = false,
  icon,
  className,
}: {
  label: string
  value: React.ReactNode
  /** With a numeric `value`: count up when the card scrolls into view (Animate UI CountingNumber, Latin digits). */
  countUp?: boolean
  /** The coloured line under the number, e.g. "+12% vs last 14 days" */
  change?: React.ReactNode
  tone?: "up" | "down" | "muted"
  /** Makes the whole card a link (admin counts open their queue) */
  href?: string
  /** A placeholder value such as [USD AMOUNT]: 15 px muted instead of 26 px */
  placeholder?: boolean
  icon?: React.ReactNode
  className?: string
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          placeholder
            ? "text-[15px] leading-8 text-muted-foreground"
            : "text-[26px] leading-8 font-bold tracking-[-0.02em] max-md:text-[22px] max-md:leading-7"
        )}
      >
        {countUp && typeof value === "number" ? <CountingNumber number={value} thousandSeparator="," inView transition={{ duration: 1.2, ease: "easeOut" }} /> : value}
      </span>
      {change ? (
        <span
          className={cn(
            "text-xs font-semibold",
            tone === "up" ? "text-brand-ink" : tone === "down" ? "text-[#b91c1c]" : "text-muted-foreground"
          )}
        >
          {change}
        </span>
      ) : null}
    </>
  )
  const base = cn(
    "flex min-w-0 flex-col gap-1.5 rounded-card border bg-card px-5 py-[18px] shadow-xs max-md:px-4 max-md:py-3.5",
    className
  )
  if (href)
    return (
      <Link
        href={href}
        className={cn(
          base,
          "transition-colors outline-none hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {body}
      </Link>
    )
  return <div className={base}>{body}</div>
}
