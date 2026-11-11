"use client"

import { AlertCircleIcon, CheckCircle2Icon, HeartIcon, LayersIcon, PlusIcon, UploadIcon } from "lucide-react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { CreatorNav, useStudioName } from "@/components/layout/creator-nav"
import { CreatorGate } from "@/components/pr/creator-gate"
import { StatCard } from "@/components/pr/patterns"
import { StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Weekday } from "@/data"
import { Link } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useMySeries } from "@/lib/creator"
import { addDays, firstName, formatCount, formatShortDate, formatTime, ictDate, initials, today, weekdayOf } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useCreator, useDemoFlag } from "@/lib/queries"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * Creator dashboard (spec §14, prototype Creator/): CreatorNav, greeting, four stat cards for the last 30 days, a
 * 14-day views chart, My series with filters and a status-based main button per row, To do, new comments with an
 * inline reply and like, and the 3-step guide for a creator without series.
 * Demo: the series are the store's `myWorks` (?demo=empty shows the new-creator state). Real API: the series come
 * from GET /creator/series and the totals from GET /creator/dashboard. The chart, the to-do list's comment item and
 * the comments are demo data in both modes (the API has none of them yet); replies and likes last for the visit.
 */

type Status = "published" | "review" | "changes" | "draft" | "hidden"
type Row = {
  id: string
  title: string
  cover: string
  format: "comic" | "novel"
  genre: string
  status: Status
  eps: number
  views: string
  subs: string
  day?: Weekday | null
  summary: string
}
type Filter = "all" | "live" | "wip"
type Talk = { replied: Record<string, string>; liked: Record<string, boolean> }

const STATUS_BADGE = { published: "brand", review: "warn", changes: "up", draft: "secondary", hidden: "outline" } as const

/** Daily views in thousands, oldest first; the last bar is today (prototype values). */
const VIEWS = [5.1, 4.8, 6.2, 5.9, 5.4, 7.8, 13.6, 6.0, 5.6, 6.4, 6.1, 5.8, 8.2, 14.1]

/** Prototype comments on the newest episodes of the first published series (demo content, English). */
const DEMO_COMMENTS = [
  { id: "c1", name: "Dara K.", back: 0, text: "The lantern scene at the ferry made me cry. When does Ep. 25 come out?" },
  { id: "c2", name: "Linh T.", back: 0, text: "Love the colours in the river panels!" },
  { id: "c3", name: "Vibol S.", back: 1, text: "Is the old ferryman going to come back?" },
]

/** Fast Pass episodes ready ahead of the free ones (demo episode rule). */
const FAST_PASS_AHEAD = 3

const WEEK: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Next release date (ISO) for an update day, after `base`. */
function nextRelease(day: Weekday, base: string): string {
  const diff = (WEEK.indexOf(day) - WEEK.indexOf(weekdayOf(base)) + 7) % 7 || 7
  return addDays(base, diff)
}
/** 6:00 PM ICT on an ISO date, as epoch ms (11:00 UTC). */
const sixPm = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d, 11)
}

export function CreatorPage() {
  const t = useTranslations("creator")
  return (
    <CreatorGate title={t("title")}>
      <Dashboard />
    </CreatorGate>
  )
}

function Dashboard() {
  const t = useTranslations("creator")
  const ts = useTranslations("states")
  const td = useTranslations("data")
  const locale = useLocale()
  const name = useStudioName()
  const flag = useDemoFlag()
  const dashboard = useCreator()
  const real = useMySeries({ q: "", visibility: "" }, !DEMO_MODE)
  const storeWorks = useAppStore((s) => s.myWorks)
  const [now] = useState(() => Date.now())
  const [filter, setFilter] = useState<Filter>("all")
  const [talk, setTalk] = useState<Talk>({ replied: {}, liked: {} })

  const pending = dashboard.isPending || (!DEMO_MODE && real.isPending)
  const error = !pending && (dashboard.isError || (!DEMO_MODE && real.isError))
  const retry = () => void Promise.all([dashboard.refetch(), DEMO_MODE ? null : real.refetch()])

  const works: Row[] = DEMO_MODE
    ? flag === "empty"
      ? []
      : storeWorks
    : (real.data ?? []).map(({ series: s, visibility, subscribers }) => ({
        id: s.id,
        title: s.title,
        cover: s.cover,
        format: s.type,
        genre: s.genre,
        status: visibility,
        eps: s.totalEpisodes,
        views: s.views,
        subs: formatCount(subscribers),
        day: s.updateDay,
        summary: "",
      }))
  const subsTotal = DEMO_MODE ? 0 : (real.data ?? []).reduce((n, s) => n + s.subscribers, 0)

  const base = DEMO_MODE ? today : ictDate(now)
  const hour = new Date(now + 7 * 3_600_000).getUTCHours()
  const first = firstName(name)
  const isNew = !pending && !error && works.length === 0
  const live = works.find((w) => w.status === "published")
  const nextIso = live?.day ? nextRelease(live.day, base) : undefined
  const time = nextIso ? formatTime(sixPm(nextIso), locale) : ""
  const dayName = live?.day ? td(`dayFull.${live.day}`) : ""

  const hello = isNew
    ? t("welcomeNew", { name: first })
    : t(hour < 12 ? "greetMorning" : hour < 18 ? "greetAfternoon" : "greetEvening", { name: first })
  const sub = isNew
    ? t("subNew")
    : live && nextIso
      ? t("subNext", { title: live.title, unit: live.format, n: live.eps + 1, day: dayName, time })
      : t("subNone")

  return (
    <>
      <CreatorNav active="dashboard" />
      <div className="container flex flex-col gap-6 pt-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="type-h2">{hello}</h1>
            {pending ? <Skeleton className="h-[18px] w-72 max-w-full" /> : error ? null : <p className="text-[13px] leading-[18px] text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/creator/new">
                <PlusIcon />
                {t("newSeries")}
              </Link>
            </Button>
            {works.length > 0 && !error ? (
              <Button asChild variant="brand">
                <Link href={live ? `/creator/upload?series=${live.id}` : "/creator/upload"}>
                  <UploadIcon />
                  {t("uploadEpisode")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Notice />

        {pending ? (
          <DashboardSkeleton />
        ) : error ? (
          <StateBox
            icon={AlertCircleIcon}
            tone="bad"
            title={ts("errorTitle")}
            text={ts("errorDescription")}
            action={
              <Button variant="outline" size="sm" className="mt-1" onClick={retry}>
                {ts("retry")}
              </Button>
            }
          />
        ) : isNew ? (
          <StartGuide />
        ) : (
          <>
            <Stats subsTotal={subsTotal} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="flex min-w-0 flex-col gap-6">
                <ViewsChart base={base} />
                <MySeries works={works} filter={filter} onFilter={setFilter} base={base} />
              </div>
              <div className="flex min-w-0 flex-col gap-6">
                <TodoCard works={works} base={base} time={time} dayName={dayName} unreplied={live ? DEMO_COMMENTS.filter((c) => !talk.replied[c.id]).length : 0} />
                {live ? <CommentsCard live={live} talk={talk} onTalk={setTalk} /> : null}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/** "Series created" / "Episode saved" with the next step (the V1 forms arrive as ?notice=…&series=<id>). */
function Notice() {
  const t = useTranslations("creator")
  const params = useSearchParams()
  const notice = params.get("notice")
  const id = params.get("series")
  if (!id || (notice !== "series-created" && notice !== "episode-added")) return null
  const created = notice === "series-created"
  return (
    <div role="status" className="flex flex-wrap items-start gap-3 rounded-[10px] border border-brand-soft-border bg-brand-soft px-4 py-3.5">
      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-5 font-semibold">{created ? t("noticeCreated") : t("noticeEpisode")}</span>
        <span className="text-[13px] leading-[19px]">{created ? t("noticeCreatedDesc") : t("noticeEpisodeDesc")}</span>
      </div>
      <Button asChild variant="brand" size="sm" className="-my-1">
        <Link href={`/creator/upload?series=${id}`}>{t("uploadEpisode")}</Link>
      </Button>
    </div>
  )
}

function StartGuide() {
  const t = useTranslations("creator")
  const steps = [1, 2, 3] as const
  return (
    <section
      aria-labelledby="start-title"
      className="flex flex-col gap-5 rounded-card border bg-background bg-[image:linear-gradient(135deg,#effcf4,#ffffff_70%)] p-7 shadow-xs max-md:p-[18px]"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="start-title" className="type-h3">
          {t("startTitle")}
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">{t("startDesc")}</p>
      </div>
      <ol aria-label={t("stepsLabel")} className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
        {steps.map((n) => (
          <li key={n} className="flex items-start gap-3 rounded-card border bg-background p-3.5">
            <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-bold text-background">
              {n}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13px] leading-[18px] font-semibold">{t(`step${n}Title`)}</span>
              <span className="text-xs leading-4 text-muted-foreground">{t(`step${n}Desc`)}</span>
            </div>
          </li>
        ))}
      </ol>
      <Button asChild variant="brand" size="lg" className="self-start max-md:self-stretch">
        <Link href="/creator/new">{t("startCta")}</Link>
      </Button>
    </section>
  )
}

/** "▲ 12%" with the direction spelled out for screen readers. */
function Delta({ dir, value, after }: { dir: "up" | "down"; value: number; after?: string }) {
  const t = useTranslations("creator")
  return (
    <>
      <span aria-hidden>{dir === "up" ? "▲" : "▼"} </span>
      <span className="sr-only">{t(dir)} </span>
      {value}%{after ? ` · ${after}` : null}
    </>
  )
}

function Stats({ subsTotal }: { subsTotal: number }) {
  const t = useTranslations("creator")
  const d = useCreator().data
  const stats: { label: string; value: string; change?: React.ReactNode; tone?: "up" | "down"; href?: string }[] = DEMO_MODE
    ? [
        { label: t("statViews"), value: "182.4K", change: <Delta dir="up" value={12} />, tone: "up" },
        { label: t("statNewSubs"), value: "1,284", change: <Delta dir="up" value={8} />, tone: "up" },
        { label: t("statLikes"), value: "24.1K", change: <Delta dir="down" value={3} />, tone: "down" },
        { label: t("statCoins"), value: "3,420", change: <Delta dir="up" value={21} after={t("seeEarnings")} />, tone: "up", href: "/creator/earnings" },
      ]
    : [
        { label: t("statViews"), value: d?.totals.views ?? "0" },
        { label: t("statSubs"), value: formatCount(subsTotal) },
        { label: t("statLikes"), value: d?.totals.likes ?? "0" },
        { label: t("statCoins"), value: (d?.earnedCoins ?? 0).toLocaleString("en-US"), change: t("seeEarnings"), tone: "up", href: "/creator/earnings" },
      ]
  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-6 max-md:gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="stats-title" className="type-h3">
          {t(DEMO_MODE ? "last30" : "allTime")}
        </h2>
        <span className="text-xs leading-4 text-muted-foreground">{t(DEMO_MODE ? "compared" : "totalsNote")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} change={s.change} tone={s.tone} href={s.href} />
        ))}
      </div>
    </section>
  )
}

function ViewsChart({ base }: { base: string }) {
  const t = useTranslations("creator")
  const td = useTranslations("data")
  const max = Math.max(...VIEWS)
  const min = Math.min(...VIEWS)
  return (
    <section aria-labelledby="chart-title" className="rounded-card border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        <h2 id="chart-title" className="type-h3">
          {t("chartTitle")}
        </h2>
        <span className="text-xs leading-4 text-muted-foreground">{t("chartRange")}</span>
      </div>
      <div className="p-5 max-md:p-4">
        <div role="img" aria-label={t("chartAria", { min: `${min}K`, max: `${max}K` })} className="grid h-40 grid-cols-14 items-end gap-1.5 max-md:h-[120px] max-md:gap-[3px]">
          {VIEWS.map((v, i) => {
            const day = weekdayOf(addDays(base, i - VIEWS.length + 1))
            const isToday = i === VIEWS.length - 1
            return (
              <div key={i} title={t("barTip", { day: td(`dayFull.${day}`), views: `${v}K` })} className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5">
                <span
                  className={cn("w-full max-w-7 rounded-t-md rounded-b-[2px]", isToday ? "bg-primary" : "bg-brand-soft-border")}
                  style={{ height: `${Math.round((v / max) * 100)}%` }}
                />
                <span className="text-[10px] leading-3 text-muted-foreground max-md:text-[9px]">{t(`dayShort.${day}`)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function MySeries({ works, filter, onFilter, base }: { works: Row[]; filter: Filter; onFilter: (f: Filter) => void; base: string }) {
  const t = useTranslations("creator")
  const counts: Record<Filter, number> = {
    all: works.length,
    live: works.filter((w) => w.status === "published").length,
    wip: works.filter((w) => w.status !== "published").length,
  }
  const shown = works.filter((w) => filter === "all" || (filter === "live" ? w.status === "published" : w.status !== "published"))
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "live", label: t("filterLive") },
    { id: "wip", label: t("filterWip") },
  ]
  return (
    <section aria-labelledby="ms-title" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ms-title" className="type-h3">
          {t("mySeries")}
        </h2>
        <div
          role="radiogroup"
          aria-label={t("filterLabel")}
          className="inline-flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted p-[3px] text-muted-foreground [scrollbar-width:none]"
        >
          {filters.map((f) => {
            const on = f.id === filter
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onFilter(f.id)}
                className={cn(
                  "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  on && "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]"
                )}
              >
                {f.label}
                <span className="text-xs text-muted-foreground tabular-nums">{counts[f.id]}</span>
              </button>
            )
          })}
        </div>
      </div>
      {shown.length === 0 ? (
        <StateBox icon={LayersIcon} title={t("filterEmpty")} />
      ) : (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border p-0" aria-labelledby="ms-title">
          {shown.map((w) => (
            <WorkRow key={w.id} w={w} base={base} />
          ))}
        </ul>
      )}
    </section>
  )
}

function WorkRow({ w, base }: { w: Row; base: string }) {
  const t = useTranslations("creator")
  const td = useTranslations("data")
  const locale = useLocale()
  const loc = useLocalize()
  const unit = w.format
  const iso = w.day ? nextRelease(w.day, base) : undefined
  const date = iso && w.day ? (locale === "km" ? `${td(`dayFull.${w.day}`)} ${formatShortDate(iso, locale)}` : `${w.day}, ${formatShortDate(iso, "en")}`) : ""
  const missing = [
    ...(w.summary.trim() ? [] : [t("missSummary")]),
    ...(w.cover ? [] : [t("missCover")]),
    ...(w.eps > 0 ? [] : [t("missFirst", { unit })]),
  ]
  const listed = missing.length > 1 ? t("listAnd", { a: missing.slice(0, -1).join(", "), b: missing[missing.length - 1] }) : (missing[0] ?? "")
  const meta =
    w.status === "published" || w.status === "hidden"
      ? t("metaLive", { unit, count: w.eps, views: w.views, subs: w.subs })
      : w.status === "changes"
        ? t("metaChanges")
        : w.status === "review"
          ? t("metaReview", { unit, count: w.eps })
          : missing.length
            ? t("metaDraft", { list: listed })
            : t("metaDraftReady")
  const next =
    w.status === "published"
      ? iso
        ? t("nextLive", { unit, n: w.eps + 1, date, time: formatTime(sixPm(iso), locale) })
        : ""
      : t(w.status === "changes" ? "nextChanges" : w.status === "review" ? "nextReview" : w.status === "hidden" ? "nextHidden" : "nextDraft")
  const main =
    w.status === "changes"
      ? { label: t("fixResubmit"), href: `/creator/series/${w.id}` }
      : w.status === "draft"
        ? { label: t("continueSetup"), href: `/creator/new?draft=${w.id}` }
        : { label: t(unit === "novel" ? "addChapter" : "uploadEpisode"), href: `/creator/upload?series=${w.id}` }

  return (
    <li className="flex flex-wrap items-center gap-3.5 bg-background px-4 py-3.5 not-first:border-t max-md:gap-3 max-md:p-3">
      {w.cover ? (
        <Image src={w.cover} alt="" width={112} height={148} className="h-[74px] w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span aria-hidden className="h-[74px] w-14 shrink-0 rounded-lg bg-muted" />
      )}
      <div className="flex min-w-0 flex-1 basis-0 flex-col gap-1">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={STATUS_BADGE[w.status]}>{t(`status.${w.status}`)}</Badge>
          <Badge variant="outline">{t(unit === "novel" ? "formatNovel" : "formatComic")}</Badge>
          <Badge variant="outline">{loc.genre(w.genre)}</Badge>
        </div>
        <span className="type-h4 truncate">{w.title}</span>
        <span className="text-xs leading-4 text-muted-foreground">{meta}</span>
        {next ? <span className={cn("text-xs leading-4", w.status === "published" ? "text-brand-ink" : "text-muted-foreground")}>{next}</span> : null}
      </div>
      <div className="flex shrink-0 gap-1.5 max-md:w-full max-md:pl-[68px] max-md:[&>*]:flex-1">
        <Button asChild variant="brand" size="sm">
          <Link href={main.href}>{main.label}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/creator/series/${w.id}`} aria-label={t("manageLabel", { title: w.title })}>
            {t("manage")}
          </Link>
        </Button>
      </div>
    </li>
  )
}

function TodoCard({ works, base, time, dayName, unreplied }: { works: Row[]; base: string; time: string; dayName: string; unreplied: number }) {
  const t = useTranslations("creator")
  const locale = useLocale()
  const live = works.find((w) => w.status === "published")
  const items: { key: string; icon: React.ReactNode; tone: "go" | "wait" | "plain"; title: string; desc: string }[] = []
  if (live && dayName) {
    items.push({
      key: "next",
      icon: "→",
      tone: "go",
      title: t("todoScheduled", { unit: live.format, n: live.eps + 1 }),
      desc: t("todoScheduledDesc", { day: dayName, time, count: FAST_PASS_AHEAD }),
    })
  }
  if (unreplied > 0) items.push({ key: "reply", icon: unreplied, tone: "go", title: t("todoReply"), desc: t("todoReplyDesc") })
  for (const w of works) {
    if (w.status === "review") {
      items.push({
        key: w.id,
        icon: "…",
        tone: "wait",
        title: t("todoReview", { title: w.title }),
        desc: t("todoReviewDesc", { date: formatShortDate(addDays(base, -1), locale) }),
      })
    } else if (w.status === "changes") {
      items.push({ key: w.id, icon: "!", tone: "plain", title: t("todoChanges", { title: w.title }), desc: t("todoChangesDesc") })
    } else if (w.status === "draft") {
      const need = !w.summary.trim() ? "Summary" : !w.cover ? "Cover" : w.eps === 0 ? "First" : "Ready"
      items.push({
        key: w.id,
        icon: "!",
        tone: "plain",
        title: t(`todoDraft${need}`, { title: w.title, unit: w.format }),
        desc: t(`todoDraft${need}Desc`, { unit: w.format }),
      })
    }
  }
  return (
    <section aria-labelledby="todo-title" className="rounded-card border bg-card shadow-xs">
      <h2 id="todo-title" className="type-h3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        {t("todoTitle")}
      </h2>
      {items.length === 0 ? (
        <p className="p-5 text-[13px] leading-[18px] text-muted-foreground max-md:p-4">{t("todoNone")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-5 max-md:p-4">
          {items.map((it) => (
            <li key={it.key} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                  it.tone === "go" ? "bg-brand-soft text-brand-ink" : it.tone === "wait" ? "bg-[#fef3c7] text-[#92400e]" : "bg-muted text-foreground"
                )}
              >
                {it.icon}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] leading-[18px] font-semibold">{it.title}</span>
                <span className="text-xs leading-4 text-muted-foreground">{it.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CommentsCard({ live, talk, onTalk }: { live: Row; talk: Talk; onTalk: (next: Talk) => void }) {
  const t = useTranslations("creator")
  const [open, setOpen] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function send(id: string) {
    const text = (drafts[id] ?? "").trim()
    if (!text) {
      toast.error(t("replyEmpty"))
      return
    }
    onTalk({ ...talk, replied: { ...talk.replied, [id]: text } })
    setOpen(null)
    toast.success(t("replyPosted"))
  }

  return (
    <section aria-labelledby="cm-title" className="rounded-card border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 max-md:px-4 max-md:pt-4">
        <h2 id="cm-title" className="type-h3">
          {t("commentsTitle")}
        </h2>
        <Badge variant="secondary" className="tabular-nums">
          {DEMO_COMMENTS.length}
        </Badge>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-5 max-md:p-4">
        {DEMO_COMMENTS.map((c) => {
          const reply = talk.replied[c.id]
          const liked = !!talk.liked[c.id]
          const inputId = `reply-${c.id}`
          return (
            <li key={c.id} className="flex flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                  {initials(c.name)}
                </span>
                <span className="shrink-0 text-[13px] leading-[18px] font-semibold">{c.name}</span>
                <span className="truncate text-xs leading-4 text-muted-foreground">
                  {t("commentWhere", { title: live.title, unit: live.format, n: Math.max(1, live.eps - c.back) })}
                </span>
              </div>
              <p className="text-[13px] leading-[19px] text-[#3f3f46]">{c.text}</p>
              {reply ? (
                <p className="rounded-r-md border-l-2 border-primary bg-[#f6fef9] px-2.5 py-1.5 text-xs leading-4 text-[#3f3f46]">{t("you", { text: reply })}</p>
              ) : open === c.id ? (
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    send(c.id)
                  }}
                >
                  <label htmlFor={inputId} className="sr-only">
                    {t("replyLabel", { name: c.name })}
                  </label>
                  <Input
                    id={inputId}
                    autoFocus
                    maxLength={300}
                    placeholder={t("replyPlaceholder")}
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value.slice(0, 300) }))}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setOpen(null)
                    }}
                  />
                  <Button type="submit" variant="brand" size="sm" className="h-9">
                    {t("send")}
                  </Button>
                </form>
              ) : (
                <div className="-ml-3 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(c.id)} aria-label={t("replyLabel", { name: c.name })}>
                    {t("reply")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={liked}
                    className={cn(liked && "text-brand-ink")}
                    onClick={() => onTalk({ ...talk, liked: { ...talk.liked, [c.id]: !liked } })}
                  >
                    <HeartIcon className={cn("size-3.5", liked && "fill-current")} aria-hidden />
                    {liked ? t("liked") : t("like")}
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-card max-md:h-[92px]" />
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-[248px] rounded-card" />
          <Skeleton className="h-[300px] rounded-card" />
        </div>
        <Skeleton className="h-[260px] rounded-card" />
      </div>
    </div>
  )
}
