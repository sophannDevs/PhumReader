"use client"

import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { HeartIcon } from "@/components/animate-ui/icons/heart"
import { InfoIcon } from "@/components/animate-ui/icons/info"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { TrendingUpIcon } from "@/components/animate-ui/icons/trending-up"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { LineTabs, SubscribeButton, seedOf, viewsOf } from "@/components/pr/browse-kit"
import { NativeSelect } from "@/components/pr/settings-ui"
import { Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { genres, type Genre, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { formatCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useRankings } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { useDigits } from "@/i18n/local-digits"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

type List = "trending" | "popular" | "new" | "rising"
type Format = "all" | "comic" | "novel"
type Period = "day" | "week" | "month"
type Move = { kind: "up" | "down" | "new" | "same"; n: number }
type Entry = { series: Series; rank: number; v: number; stat: string; statKind: "reads" | "views" | "growth"; move: Move }

const PAGE = 20
const FACTOR: Record<Period, number> = { day: 0.004, week: 0.03, month: 0.11 }
const SEED: Record<Period, number> = { day: 3, week: 7, month: 11 }

/**
 * The prototype's demo numbers (Rankings page.js `metric`): reads in the period for Trending / New, all-time views
 * for Popular, growth for Rising. Stable per series and period.
 */
function metric(s: Series, list: List, period: Period): Pick<Entry, "v" | "stat" | "statKind"> {
  const n = seedOf(s.id)
  const f = FACTOR[period]
  const reads = viewsOf(s) * f * (1 + ((n * 7) % 11) / 8) + ((n * 13) % 40) * 1000 * f * 30
  if (list === "popular") return { v: viewsOf(s), stat: s.views, statKind: "views" }
  if (list === "rising") {
    const g = 40 + ((n * 37) % 260)
    return { v: g * 1e6 + reads, stat: `+${g}%`, statKind: "growth" }
  }
  return { v: reads, stat: formatCount(reads), statKind: "reads" }
}

/** Movement since the last update (prototype `move`): stable per series and period. */
function movement(s: Series, rank: number, list: List, period: Period): Move {
  const n = seedOf(s.id)
  if (list === "new" && n % 2 === 0) return { kind: "new", n: 0 }
  let d = ((n * SEED[period] * 5) % 9) - 4
  if (rank <= 3 && d < 0) d = 0
  if (s.badges.isNew && n % 5 === 0) return { kind: "new", n: 0 }
  if (d > 0) return { kind: "up", n: d }
  if (d < 0) return { kind: "down", n: -d }
  return { kind: "same", n: 0 }
}

/**
 * Rankings (spec §10, prototype Rankings): Trending / Popular / New / Rising; format, genre and period filters
 * (no period for Popular); the top 3 as large cards (not for Rising), then rows with movement, reads for the period
 * (growth for Rising), likes and + Add; "How rankings work", "Show more" (20 at a time) and an empty state.
 * The series come from the rankings query (comics + web novels, demo or API); the lists are ordered here with the
 * prototype's deterministic demo numbers.
 */
export function RankingsPage() {
  const t = useTranslations("rankings")
  const loc = useLocalize()
  const comics = useRankings("comics")
  const novels = useRankings("novels")
  const [list, setList] = useState<List>("trending")
  const [format, setFormat] = useState<Format>("all")
  const [genre, setGenre] = useState<Genre | "all">("all")
  const [period, setPeriod] = useState<Period>("week")
  const [shown, setShown] = useState(PAGE)
  const [howOpen, setHowOpen] = useState(false)

  const loading = comics.isPending || novels.isPending
  const failed = comics.isError || novels.isError
  const seen = new Set<string>()
  const pool = [...(comics.data ?? []), ...(novels.data ?? [])]
    .map((r) => r.series)
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => seedOf(a.id) - seedOf(b.id))

  const ranked: Entry[] = pool
    .filter(
      (s) =>
        !(format === "comic" && s.type === "novel") &&
        !(format === "novel" && s.type !== "novel") &&
        (genre === "all" || s.genre === genre) &&
        (list !== "new" || s.badges.isNew)
    )
    .map((s) => ({ series: s, ...metric(s, list, period) }))
    .sort((a, b) => b.v - a.v)
    .map((e, i) => ({ ...e, rank: i + 1, move: movement(e.series, i + 1, list, period) }))

  const visible = ranked.slice(0, shown)
  const podium = list !== "rising" && visible.length >= 3
  const top = podium ? visible.slice(0, 3) : []
  const rows = podium ? visible.slice(3) : visible
  const statLabel = (e: Entry) =>
    e.statKind === "views" ? t("allTimeViews") : e.statKind === "growth" ? t("moreReaders") : t(`reads.${period}`)

  const reset = (fn: () => void) => {
    fn()
    setShown(PAGE)
  }

  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1">{t("title")}</h1>
          <p className="text-[15px] leading-[26px] text-muted-foreground">
            {t("lead")} {list === "popular" ? t("allTime") : t("updated")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={howOpen}
          aria-controls="rk-how"
          onClick={() => setHowOpen((v) => !v)}
        >
          <InfoIcon className="size-3.5" aria-hidden />
          {t("how")}
        </Button>
      </div>
      {howOpen ? (
        <div id="rk-how" className="flex items-start gap-3 rounded-[10px] border bg-background px-4 py-3.5">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex flex-col">
            <span className="text-sm leading-5 font-semibold">{t("how")}</span>
            <span className="text-[13px] leading-[19px]">{t("howText")}</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <LineTabs
          idBase="rk"
          label={t("listsLabel")}
          value={list}
          onChange={(v) => reset(() => setList(v))}
          items={(["trending", "popular", "new", "rising"] as const).map((v) => ({ value: v, label: t(`lists.${v}`) }))}
        />
        <div className="flex flex-wrap items-center gap-2.5 max-md:gap-2">
          <Segmented
            label={t("formatLabel")}
            value={format}
            onChange={(v) => reset(() => setFormat(v))}
            options={(["all", "comic", "novel"] as const).map((v) => ({ value: v, label: t(`formats.${v}`) }))}
            className="max-md:flex max-md:w-full max-md:[&>button]:flex-1"
          />
          <NativeSelect
            aria-label={t("genreLabel")}
            value={genre}
            onChange={(e) => reset(() => setGenre(e.target.value as Genre | "all"))}
            wrapperClassName="md:w-auto md:min-w-[160px]"
          >
            <option value="all">{t("allGenres")}</option>
            {genres().map((g) => (
              <option key={g} value={g}>
                {loc.genre(g)}
              </option>
            ))}
          </NativeSelect>
          {list !== "popular" ? (
            <Segmented
              label={t("periodLabel")}
              value={period}
              onChange={setPeriod}
              options={(["day", "week", "month"] as const).map((v) => ({ value: v, label: t(`periods.${v}`) }))}
              className="max-md:flex max-md:w-full max-md:[&>button]:flex-1"
            />
          ) : null}
        </div>
      </div>

      <div role="tabpanel" id="rk-panel" aria-labelledby={`rk-tab-${list}`} className="flex flex-col gap-5">
        {loading ? (
          <RankingsListSkeleton label={t("loading")} />
        ) : failed ? (
          <StateBox
            icon={AlertCircleIcon}
            tone="bad"
            title={t("errorTitle")}
            text={t("errorText")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (comics.isError) void comics.refetch()
                  if (novels.isError) void novels.refetch()
                }}
              >
                <RefreshCwIcon className="size-3.5" aria-hidden />
                {t("tryAgain")}
              </Button>
            }
          />
        ) : ranked.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 rounded-card border bg-card px-5 py-12 text-center shadow-xs">
            <TrendingUpIcon className="size-7 text-muted-foreground" aria-hidden />
            <h2 className="type-h3">{t("emptyTitle")}</h2>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {t("emptyText", { what: t(`emptyWhat.${format}`), genre: genre === "all" ? t("allGenres") : loc.genre(genre) })}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                reset(() => {
                  setGenre("all")
                  setFormat("all")
                  setList("trending")
                })
              }
            >
              {t("showAllGenres")}
            </Button>
          </div>
        ) : (
          <>
            {top.length > 0 ? (
              <ol aria-label={t("top3")} className="grid grid-cols-3 gap-4 max-lg:grid-cols-[minmax(0,1fr)]">
                {top.map((e, i) => (
                  <Podium key={e.series.id} entry={e} statLabel={statLabel(e)} index={i} />
                ))}
              </ol>
            ) : null}
            {rows.length > 0 ? (
              <ol start={rows[0].rank} className="flex flex-col overflow-hidden rounded-[14px] border">
                {rows.map((e, i) => (
                  <Row key={e.series.id} entry={e} statLabel={statLabel(e)} index={i} />
                ))}
              </ol>
            ) : null}
            {ranked.length > shown ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="text-[13px] leading-[18px] text-muted-foreground">
                  {t("showing", { shown: visible.length, total: ranked.length })}
                </span>
                <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                  {t("showMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

/** `.rk-move`: ▲3 (green), ▼1 (red), NEW (blue) or – , with a spoken label. */
function MovePill({ move }: { move: Move }) {
  const tc = useTranslations("cards")
  const digits = useDigits()
  const text = move.kind === "up" ? `▲${digits(move.n)}` : move.kind === "down" ? `▼${digits(move.n)}` : move.kind === "new" ? tc("new") : "–"
  const label =
    move.kind === "up"
      ? tc("moveUp", { n: move.n })
      : move.kind === "down"
        ? tc("moveDown", { n: move.n })
        : move.kind === "new"
          ? tc("moveNew")
          : tc("moveSame")
  return (
    <span
      className={cn(
        "min-w-[34px] shrink-0 rounded-md px-1 py-0.5 text-center text-[11px] leading-4 font-bold tabular-nums max-md:min-w-[30px]",
        move.kind === "up" && "bg-brand-soft text-brand-ink",
        move.kind === "down" && "bg-destructive-soft text-[#b91c1c]",
        move.kind === "new" && "bg-[#eff6ff] text-[#1d4ed8]",
        move.kind === "same" && "text-muted-foreground"
      )}
    >
      <span aria-hidden>{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

const MEDAL = ["bg-[#f59e0b] text-[#422006]", "bg-[#a1a1aa] text-white", "bg-[#b45309] text-white"]

/** Top 3 card (`.rk-podium`): cover with the medal, movement + badges, title, creator, period stat, likes, Subscribe. */
function Podium({ entry: e, statLabel, index }: { entry: Entry; statLabel: string; index: number }) {
  const t = useTranslations("rankings")
  const tc = useTranslations("cards")
  const loc = useLocalize()
  const s = e.series
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 40} inView>
    <li
      className={cn(
        "grid grid-cols-[96px_minmax(0,1fr)] grid-rows-[auto_auto] items-start gap-x-4 gap-y-3 rounded-[14px] border bg-background p-4 shadow-xs",
        "max-lg:grid-cols-[72px_minmax(0,1fr)_auto] max-lg:grid-rows-[auto]",
        "max-md:grid-cols-[64px_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-2 max-md:p-3",
        e.rank === 1 && "border-[#fde68a] bg-[image:linear-gradient(160deg,#fffbeb,#ffffff_60%)]"
      )}
    >
      <Link
        href={seriesHref(s)}
        tabIndex={-1}
        aria-hidden
        className="relative row-span-2 block aspect-[3/4] overflow-hidden rounded-[10px] bg-muted max-lg:row-span-1"
      >
        <Image src={s.cover} alt="" fill sizes="96px" className="object-cover" />
        <span
          className={cn(
            "absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-full text-sm font-extrabold shadow-[0_0_0_2px_#fff]",
            MEDAL[e.rank - 1]
          )}
        >
          <Num>{e.rank}</Num>
        </span>
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sr-only">{tc("rank", { rank: e.rank })}</span>
          <MovePill move={e.move} />
          {s.type === "novel" ? <Badge variant="secondary">{t("novel")}</Badge> : null}
          <Badge variant="outline">{loc.genre(s.genre)}</Badge>
        </div>
        <Link
          href={seriesHref(s)}
          className="type-h3 block truncate rounded-sm underline-offset-[3px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {s.title}
        </Link>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{s.creator}</span>
        <span className="flex flex-wrap items-center gap-x-2.5 text-xs leading-4 text-muted-foreground">
          <span>
            <strong className="text-foreground tabular-nums"><Num>{e.stat}</Num></strong> {statLabel}
          </span>
          <span className="inline-flex items-center gap-[3px]">
            <HeartIcon className="size-3" aria-hidden />
            <span className="sr-only">{t("likes")}</span>
            <Num>{s.likes}</Num>
          </span>
        </span>
      </div>
      <SubscribeButton
        series={s}
        filled
        labels={[t("subscribe"), t("subscribed")]}
        title={s.title}
        className="col-start-2 justify-self-start max-lg:col-start-auto max-lg:self-center max-md:col-start-2"
      />
    </li>
    </Effect>
  )
}

/** `.rk-row`: rank, movement, cover, title + "creator · genre", period stat and likes (desktop), + Add. */
function Row({ entry: e, statLabel, index }: { entry: Entry; statLabel: string; index: number }) {
  const t = useTranslations("rankings")
  const tc = useTranslations("cards")
  const loc = useLocalize()
  const s = e.series
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 40} inView>
    <li className="flex items-center gap-3.5 border-t bg-background px-4 py-2.5 transition-colors first:border-t-0 hover:bg-[#fafafa] max-md:gap-2.5 max-md:px-3">
      <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums max-md:w-[22px] max-md:text-base">
        <span aria-hidden><Num>{e.rank}</Num></span>
        <span className="sr-only">{tc("rank", { rank: e.rank })}</span>
      </span>
      <MovePill move={e.move} />
      <Link href={seriesHref(s)} tabIndex={-1} aria-hidden className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={s.cover} alt="" width={96} height={128} sizes="48px" className="size-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <Link
          href={seriesHref(s)}
          className="type-h4 block truncate rounded-sm underline-offset-[3px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {s.title}
        </Link>
        <span className="truncate text-xs leading-4 text-muted-foreground">
          {s.creator} · {loc.genre(s.genre)}
          {s.type === "novel" ? ` · ${t("webNovel")}` : ""}
        </span>
      </div>
      <span className="hidden w-[120px] shrink-0 flex-col items-end text-sm md:flex">
        <strong className="tabular-nums"><Num>{e.stat}</Num></strong>
        <span className="text-xs leading-4 text-muted-foreground">{statLabel}</span>
      </span>
      <span className="hidden w-[120px] shrink-0 flex-col items-end text-sm md:flex">
        <strong className="tabular-nums"><Num>{s.likes}</Num></strong>
        <span className="text-xs leading-4 text-muted-foreground">{t("likes")}</span>
      </span>
      <SubscribeButton
        series={s}
        filled
        labels={[t("add"), t("added")]}
        title={s.title}
        className="w-[104px] max-md:w-auto max-md:px-2.5"
      />
    </li>
    </Effect>
  )
}

/** Three podium cards and eight rows (the page's loading state and loading.tsx). */
function RankingsListSkeleton({ label }: { label?: string }) {
  return (
    <div role={label ? "status" : undefined} aria-label={label} aria-busy="true" className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-[minmax(0,1fr)]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-[14px] border p-4 max-md:gap-3 max-md:p-3">
            <Skeleton className="aspect-[3/4] w-24 shrink-0 rounded-[10px] max-lg:w-[72px] max-md:w-16" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col overflow-hidden rounded-[14px] border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 border-t px-4 py-2.5 first:border-t-0 max-md:gap-2.5 max-md:px-3">
            <Skeleton className="h-5 w-6" />
            <Skeleton className="h-16 w-12 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-[104px] max-md:w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Route-level loading (loading.tsx): title, tabs and the list skeleton. */
export function RankingsSkeleton() {
  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16" aria-hidden>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-11 w-full" />
      <RankingsListSkeleton />
    </div>
  )
}
