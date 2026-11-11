"use client"

import { useQueryClient } from "@tanstack/react-query"
import { AlertCircleIcon, CheckIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAdminError } from "@/components/pr/admin-dialogs"
import { UndoBar, useUndo } from "@/components/pr/patterns"
import { StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Flag, Priority, QueueReport } from "@/lib/admin"
import { useLocalize } from "@/lib/localize"
import { formatDate, formatShortDate, formatTime, ictDate } from "@/lib/format"
import { useAppStore, type AdminDecision } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Shared parts of the admin screens (spec §22, prototype Admin): the decision log with its 6-second Undo, the page
 * head, cards, queue rows, labels and the text helpers that turn demo data into the current language.
 */

// ------------------------------------------------------------------------------------------------ decisions

export type AdminAction =
  | "approve"
  | "changes"
  | "reject"
  | "remove"
  | "warn"
  | "suspend"
  | "dismiss"
  | "refund"
  | "decline"
  | "addCoins"

export type Decision = {
  /** The adminLog id, e.g. "series:C2" */
  key: string
  queue: AdminDecision["queue"]
  action: AdminAction
  /** The subject in the log line: a title, case number or order number */
  label: string
  /** Store changes besides the log (demo mode and store-only queues) */
  apply?: () => void
  /** Puts the store back (Undo, or a failed API call) */
  revert?: () => void
  /** Real API call: runs when the Undo window closes (or right away when the next decision is made) */
  commit?: () => Promise<unknown>
  toast?: string
}

type Pending = { commit: () => Promise<unknown>; revert: () => void; timer: ReturnType<typeof setTimeout> }

const DecisionContext = createContext<(d: Decision) => void>(() => {})

/** Records an admin decision (store `adminLog`), shows the Undo bar for 6 s and runs any API call after it. */
export const useDecide = () => useContext(DecisionContext)

export function AdminDecisions({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin")
  const qc = useQueryClient()
  const errorText = useAdminError()
  const { current: undoing, show: showUndo, undo } = useUndo()
  const pending = useRef<Pending | null>(null)
  // The newest helpers for the timers (they outlive the render that started them).
  const helpers = useRef({ qc, errorText })
  useEffect(() => {
    helpers.current = { qc, errorText }
  })

  const run = useCallback((p: Pending) => {
    clearTimeout(p.timer)
    p.commit().then(
      () => helpers.current.qc.invalidateQueries({ queryKey: ["admin"] }),
      (err: unknown) => {
        p.revert()
        toast.error(helpers.current.errorText(err))
      }
    )
  }, [])

  // Leaving the admin area (or hiding it) sends a decision that is still waiting for its Undo window.
  useEffect(() => {
    const box = pending
    return () => {
      const p = box.current
      box.current = null
      if (p) run(p)
    }
  }, [run])

  const decide = useCallback(
    (d: Decision) => {
      const waiting = pending.current
      pending.current = null
      if (waiting) run(waiting)

      d.apply?.()
      useAppStore.getState().logAdmin({ id: d.key, queue: d.queue, label: d.label, action: d.action, at: Date.now() })
      const revert = () => {
        d.revert?.()
        useAppStore.getState().undoAdmin(d.key)
      }
      let mine: Pending | null = null
      if (d.commit) {
        const p: Pending = {
          commit: d.commit,
          revert,
          timer: setTimeout(() => {
            if (pending.current !== p) return
            pending.current = null
            run(p)
          }, 6000),
        }
        pending.current = mine = p
      }
      showUndo(t(`log_${d.action}`, { label: d.label }), () => {
        if (mine && pending.current === mine) {
          clearTimeout(mine.timer)
          pending.current = null
        } else if (mine) {
          // Already sent: the API has no undo for it.
          return
        }
        revert()
        toast(t("undone"))
      })
      if (d.toast) toast.success(d.toast)
    },
    [run, t, showUndo]
  )

  return (
    <DecisionContext.Provider value={decide}>
      {children}
      {undoing ? (
        <UndoBar
          text={undoing.text}
          onUndo={undo}
          className="fixed bottom-5 left-1/2 z-60 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 py-2 pr-2 shadow-md"
        />
      ) : null}
    </DecisionContext.Provider>
  )
}

// ------------------------------------------------------------------------------------------------ text helpers

/** "2h ago", "1d 3h ago", "just now" (prototype `age`). */
export function useAge() {
  const t = useTranslations("admin")
  return (hours: number) => {
    const h = Math.max(0, Math.floor(hours))
    if (h <= 0) return t("age_now")
    if (h < 24) return t("age_h", { h })
    return t("age_dh", { d: Math.floor(h / 24), h: h % 24 })
  }
}

/** "Nov 9, 4:12 PM" (en) / "៩ វិច្ឆិកា ៤:១២ ល្ងាច" (km), ICT, no year. */
export function useShortDateTime() {
  const locale = useLocale()
  return (at: number) => `${formatShortDate(ictDate(at), locale)}${locale === "km" ? " " : ", "}${formatTime(at, locale)}`
}

/** A decision time: "9:40 AM" today, "Yesterday", else the date. */
export function useDecisionTime() {
  const t = useTranslations("admin")
  const locale = useLocale()
  return (at: number, todayIso: string) => {
    const day = ictDate(at)
    if (day === todayIso) return formatTime(at, locale)
    const yesterday = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    if (day === yesterday) return t("yesterday")
    return formatDate(day, locale)
  }
}

/** Report reasons in the current language (the report dialog's labels), with the API's free text as fallback. */
export function useReasonLabel() {
  const tr = useTranslations("report")
  const t = useTranslations("admin")
  return (kind: string, reason: string) => {
    const id = reason.split(":")[0].trim().toLowerCase()
    const lists = [kind === "episode" ? "series" : kind, "series", "comment", "user"]
    for (const list of lists) {
      const k = `reasons.${list}.${id}.label`
      if (tr.has(k as never)) return tr(k as never)
    }
    return reason.trim() || t("reasonUnknown")
  }
}

export function useFlagText() {
  const t = useTranslations("admin")
  return (f: Flag) => {
    if (f.kind === "contact") return f.detail ? t("flag_contact", { handle: f.detail }) : t("flag_contactAny")
    if (f.kind === "watermark") return t("flag_watermark")
    if (f.kind === "similar") return t("flag_similar", { title: f.detail ?? "" })
    return f.text ?? ""
  }
}

/** The demo data's English chrome around a report (target, place, account history) in the current language. */
export function useReportText() {
  const t = useTranslations("admin")
  const locale = useLocale()
  const localize = useLocalize()
  return {
    target: (r: QueueReport) => {
      if (r.mine || r.api) return r.target
      let m = /^Comment by (.+)$/.exec(r.target)
      if (m) return t("target_comment", { who: m[1] })
      m = /^Series [“"](.+)[”"]$/.exec(r.target)
      if (m) return t("target_series", { title: m[1] })
      return r.target
    },
    where: (r: QueueReport) => {
      if (!r.where) return t("where_app")
      if (r.where === "Series page") return t("where_seriesPage")
      const parts = r.where.split(" · ")
      return parts
        .map((p) => {
          const c = /^Chapter (\d+)$/.exec(p)
          return c ? t("chapterNo", { n: c[1] }) : localize.title(p)
        })
        .join(" · ")
    },
    history: (r: QueueReport) => {
      const h = r.history.trim()
      if (!h) return t("hist_none")
      if (h === "No earlier reports.") return t("hist_none")
      let m = /^(\d+) earlier warnings? \((\w{3}) (\d{1,2})\) for harassment\.$/.exec(h)
      if (m) {
        const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m[2]) + 1
        const iso = `2026-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}`
        return t("hist_warned", { count: Number(m[1]), date: month ? formatShortDate(iso, locale) : `${m[2]} ${m[3]}` })
      }
      m = /^New account \((\d+) days? old\)\. No other series\.$/.exec(h)
      if (m) return t("hist_newAccount", { days: Number(m[1]) })
      m = /^(\d+) comments in 1 hour, all with the same link\.$/.exec(h)
      if (m) return t("hist_burst", { count: Number(m[1]) })
      return h
    },
  }
}

// ------------------------------------------------------------------------------------------------ layout bits

/** `h1.h2` + muted line (every admin screen). */
export function AdminHead({ title, line, aside }: { title: string; line?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="type-h2">{title}</h1>
        {aside}
      </div>
      {line ? <p className="text-[13px] leading-[18px] text-muted-foreground">{line}</p> : null}
    </div>
  )
}

/** `.card` with an optional `.card-head`. */
export function AdminCard({
  title,
  titleId,
  desc,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  titleId?: string
  desc?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn("min-w-0 rounded-card border bg-card shadow-xs", className)}>
      {title ? (
        <div className="flex flex-col gap-1 px-4 pt-4 md:px-5 md:pt-5">
          <h2 id={titleId} className="type-h3">
            {title}
          </h2>
          {desc ? <p className="text-[13px] leading-[18px] text-muted-foreground">{desc}</p> : null}
        </div>
      ) : null}
      <div className={cn("p-4 md:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

/** `.label` */
export function FieldLabel({ children, id, as: As = "p" }: { children: React.ReactNode; id?: string; as?: "p" | "h3" }) {
  return (
    <As id={id} className="text-sm leading-5 font-medium text-foreground">
      {children}
    </As>
  )
}

/** `.ad-quote`: grey box around quoted text. */
export function Quote({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-[8px] border bg-[#fafafa] px-3 py-2.5 text-[13px] leading-[18px] text-[#3f3f46] dark:bg-muted dark:text-foreground">
      {children}
    </p>
  )
}

/** Queue + detail (`.ad-split`): one column below 1024 px. */
export function SplitView({ children }: { children: React.ReactNode }) {
  return <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">{children}</div>
}

export function QueueList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col overflow-hidden rounded-card border bg-card p-0 [&>li+li]:border-t">
      {children}
    </ul>
  )
}

/** `.ad-qi`: a queue row; the selected one has the brand tint and a 3 px green bar (foundations §8 ListRowActions). */
export function QueueRow({ selected, onPick, children }: { selected: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          selected ? "bg-brand-soft shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-[#fafafa] dark:hover:bg-muted"
        )}
      >
        {children}
      </button>
    </li>
  )
}

/** `.ad-detail`: sticky next to the queue on wide screens. */
export function DetailCard({
  labelledBy,
  children,
  innerRef,
}: {
  labelledBy: string
  children: React.ReactNode
  innerRef?: React.Ref<HTMLElement>
}) {
  return (
    <section
      ref={innerRef}
      aria-labelledby={labelledBy}
      className="min-w-0 scroll-mt-4 rounded-card border bg-card shadow-xs lg:sticky lg:top-[76px]"
    >
      <div className="flex flex-col gap-4 p-4 md:p-5">{children}</div>
    </section>
  )
}

/** The "queue is empty" card: green check, title, optional line. */
export function DoneCard({ title, text }: { title: string; text?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-card border bg-card px-5 py-10 text-center shadow-xs">
      <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-5" />
      </span>
      <h2 className="type-h3">{title}</h2>
      {text ? <p className="text-[13px] leading-[18px] text-muted-foreground">{text}</p> : null}
    </div>
  )
}

export function AdminError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("states")
  return (
    <StateBox
      icon={AlertCircleIcon}
      tone="bad"
      title={t("errorTitle")}
      text={t("errorDescription")}
      action={
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    />
  )
}

/** Queue + detail skeleton. */
export function SplitSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]" aria-hidden>
      <div className="flex flex-col gap-3 rounded-card border bg-card p-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-12 w-9 rounded-[6px]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-96 rounded-card" />
    </div>
  )
}

const PRI_DOT: Record<Priority, string> = {
  urgent: "bg-[#dc2626] shadow-[0_0_0_3px_#fee2e2]",
  high: "bg-[#f59e0b]",
  normal: "bg-[#a1a1aa]",
}

/** `.ad-pri`: 10 px priority dot. */
export function PriorityDot({ priority, label }: { priority: Priority; label: string }) {
  return <span role="img" aria-label={label} className={cn("size-2.5 shrink-0 rounded-full", PRI_DOT[priority])} />
}

export const PRI_BADGE: Record<Priority, "up" | "warn" | "secondary"> = { urgent: "up", high: "warn", normal: "secondary" }
