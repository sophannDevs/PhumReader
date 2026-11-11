"use client"

import { useSearchParams } from "next/navigation"
import { useFormatter } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useId, useRef, useState } from "react"
import {
  AdminError,
  AdminHead,
  DetailCard,
  DoneCard,
  FieldLabel,
  PRI_BADGE,
  PriorityDot,
  QueueList,
  QueueRow,
  Quote,
  SplitSkeleton,
  SplitView,
  useAge,
  useDecide,
  useReasonLabel,
  useReportText,
  type AdminAction,
} from "@/components/pr/admin-kit"
import { OptionCard } from "@/components/pr/patterns"
import { Chip } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type { ReportAction } from "@/lib/api/admin"
import { DEMO_MODE } from "@/lib/api/config"
import {
  actions,
  decisionKey,
  fromApiReport,
  priorityOf,
  sortReports,
  useAdminQueues,
  useReports,
  type Priority,
  type QueueReport,
} from "@/lib/admin"
import { useAppStore } from "@/lib/store"

const FILTERS = ["all", "urgent", "high", "normal"] as const
type Filter = (typeof FILTERS)[number]
const ACTS = ["remove", "warn", "suspend", "dismiss"] as const
type Act = (typeof ACTS)[number]

/** Real mode: the report queue from GET /admin/reports?status=open, without the ones decided here. */
function useRealQueue() {
  const list = useReports(DEMO_MODE ? undefined : "open")
  const log = useAppStore((s) => s.adminLog)
  const [now] = useState(() => Date.now())
  const handled = new Set(log.map((d) => d.id))
  const items = sortReports(
    list.items.filter((r) => !handled.has(decisionKey("report", r.id))).map((r) => fromApiReport(r, now))
  )
  return { list, items }
}

/**
 * /admin/reports (spec §22 Reports, screens 22-admin-reports): urgent (violence, sexual) first, then high, then
 * normal, with priority filters; the selected report shows the content, the reporter's note and the account's
 * history; the decision (remove / remove and warn / suspend 7 days / no violation) has a 6-second Undo and updates
 * the reporter's status in their Settings (demo: the store's `reports`). Real mode reads and settles the API's open
 * reports (after the Undo window).
 */
export function AdminReports() {
  const t = useTranslations("admin")
  const params = useSearchParams()
  const queues = useAdminQueues()
  const realQueue = useRealQueue()
  const reasonLabel = useReasonLabel()
  const text = useReportText()
  const age = useAge()
  const [filter, setFilter] = useState<Filter>("all")
  const [selId, setSelId] = useState<string | null>(() => params.get("id"))
  const detailRef = useRef<HTMLElement>(null)

  const all = DEMO_MODE ? queues.reports : realQueue.items
  const pending = DEMO_MODE ? queues.query.isPending : realQueue.list.isPending
  const failed = DEMO_MODE ? queues.query.isError : realQueue.list.isError
  const retry = () => void (DEMO_MODE ? queues.query.refetch() : realQueue.list.refetch())

  const count = (f: Filter) => (f === "all" ? all.length : all.filter((r) => priorityOf(r.reason) === f).length)
  const list = filter === "all" ? all : all.filter((r) => priorityOf(r.reason) === filter)
  const sel = list.find((r) => r.id === selId) ?? list[0]

  const head = <AdminHead title={t("nav_reports")} line={pending || failed ? undefined : t("rp_line", { count: all.length })} />
  if (pending) return <>{head}<SplitSkeleton rows={4} /></>
  if (failed) return <>{head}<AdminError onRetry={retry} /></>

  const pick = (id: string) => {
    setSelId(id)
    if (window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ block: "start" })
  }

  return (
    <>
      {head}
      <div role="group" aria-label={t("rp_filter")} className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} count={count(f)} onClick={() => setFilter(f)}>
            {t(`pri_${f}`)}
          </Chip>
        ))}
      </div>
      {!sel ? (
        <DoneCard title={t("rp_emptyTitle")} />
      ) : (
        <SplitView>
          <QueueList label={t("rp_queue")}>
            {list.map((r) => {
              const p = priorityOf(r.reason)
              return (
                <QueueRow key={r.id} selected={r.id === sel.id} onPick={() => pick(r.id)}>
                  <PriorityDot priority={p} label={t("priAria", { priority: t(`pri_${p}`) })} />
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="truncate text-[13px] leading-[18px] font-semibold">{reasonLabel(r.kind, r.reason)}</span>
                    <span className="truncate text-xs leading-4 text-muted-foreground">{text.target(r) || t(`kind_${r.kind}`)}</span>
                    <span className="text-xs leading-4 text-muted-foreground">
                      {t("rp_count", { count: r.count })} · {age(r.hours)}
                      {r.mine ? ` · ${t("rp_fromYou")}` : ""}
                    </span>
                  </span>
                </QueueRow>
              )
            })}
          </QueueList>
          <ReportDetail key={sel.id} report={sel} innerRef={detailRef} />
        </SplitView>
      )}
    </>
  )
}

/** The API action for a decision: remove = hide the content (or resolve when it is already gone). */
function apiAction(act: Act, r: QueueReport): ReportAction {
  if (act === "dismiss") return "dismiss"
  const status = r.api?.target.status
  return status && status !== "hidden" && status !== "deleted" ? "hide" : "resolve"
}

function ReportDetail({ report: r, innerRef }: { report: QueueReport; innerRef: React.Ref<HTMLElement> }) {
  const t = useTranslations("admin")
  const td = useTranslations("data")
  const format = useFormatter()
  const reasonLabel = useReasonLabel()
  const text = useReportText()
  const decide = useDecide()
  const id = useId()
  const [act, setAct] = useState<Act | null>(null)
  const [err, setErr] = useState(false)
  const p: Priority = priorityOf(r.reason)
  const headingId = `${id}-h`

  const confirm = () => {
    if (!act) {
      setErr(true)
      return
    }
    const status = act === "dismiss" ? ("No violation found" as const) : ("Removed" as const)
    const api = r.api
    decide({
      key: decisionKey("report", r.id),
      queue: "reports",
      action: act as AdminAction,
      label: api ? `#${r.id.slice(0, 8)}` : r.id,
      apply: () => {
        if (r.mine) useAppStore.getState().setReportStatus(r.id, status)
      },
      revert: () => {
        if (r.mine) useAppStore.getState().setReportStatus(r.id, "In review")
      },
      // The API has no warnings or 7-day suspensions: the note records the choice in the audit log.
      commit: api
        ? () => actions.settleReport(api.id, apiAction(act, r), act === "warn" || act === "suspend" ? t(`act_${act}`) : "")
        : undefined,
      toast: t("toast_reportDone"),
    })
  }

  const where = r.api
    ? `${t(`kind_${r.kind}`)}${r.api.target.episodeNumber ? ` · ${td("episode", { n: r.api.target.episodeNumber })}` : ""}`
    : text.where(r)
  const content = r.text ?? (r.api ? t("targetGone") : t("contentAsReported"))
  const seriesSlug = r.api?.target.seriesSlug

  return (
    <DetailCard labelledBy={headingId} innerRef={innerRef}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PRI_BADGE[p]}>{t(`pri_${p}`)}</Badge>
        <Badge variant="outline">{t(`kind_${r.kind}`)}</Badge>
        <span className="text-xs leading-4 text-muted-foreground">
          {r.api ? `#${r.id.slice(0, 8)}` : r.id} · {t("rp_count", { count: r.count })}
        </span>
      </div>
      <h2 id={headingId} className="type-h3">
        {reasonLabel(r.kind, r.reason)}
      </h2>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{t("rp_content")}</FieldLabel>
        <div className="flex flex-col gap-1 rounded-[8px] border border-l-[3px] border-l-[#f59e0b] bg-background p-3">
          <span className="text-xs leading-4 text-muted-foreground">{where}</span>
          <p className="m-0 text-[13px] leading-[18px]">{content}</p>
          {seriesSlug ? (
            <Link href={`/series/${seriesSlug}`} className="text-xs font-medium text-brand-ink underline-offset-4 hover:underline">
              {t("view")}
            </Link>
          ) : null}
        </div>
      </div>
      {r.details ? (
        <div className="flex flex-col gap-1">
          <FieldLabel>{t("rp_note")}</FieldLabel>
          <Quote>{r.details}</Quote>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <FieldLabel>{r.who ? t("rp_about", { who: r.who }) : t("rp_aboutItem")}</FieldLabel>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {r.api
            ? t("rp_reportedBy", {
                name: r.api.reporter,
                date: format.dateTime(new Date(r.api.createdAt), { dateStyle: "medium", timeStyle: "short" }),
              })
            : text.history(r)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel id={`${id}-act`}>{t("rp_action")}</FieldLabel>
        <div role="radiogroup" aria-labelledby={`${id}-act`} className="grid gap-2 md:grid-cols-2">
          {ACTS.map((a) => (
            <OptionCard
              key={a}
              selected={act === a}
              onSelect={() => {
                setAct(a)
                setErr(false)
              }}
              className="px-3 py-2.5"
              title={<span className="text-[13px] font-semibold">{t(`act_${a}`)}</span>}
              description={t(`actd_${a}`)}
            />
          ))}
        </div>
      </div>
      {err ? (
        <p role="alert" className="text-[13px] leading-[18px] text-destructive">
          {t("rp_error")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" onClick={confirm}>
          {t("confirm")}
        </Button>
        <span className="text-xs leading-4 text-muted-foreground">{t("rp_confirmNote")}</span>
      </div>
    </DetailCard>
  )
}
