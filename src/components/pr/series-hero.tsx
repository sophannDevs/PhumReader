"use client"

import { BookOpenIcon, CalendarIcon, ChevronRightIcon, ShareIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type { Series } from "@/data"
import { initials } from "@/lib/format"
import { creatorNameByHandle } from "@/lib/creator-profiles"
import { creatorHandle as creatorHandle_, creatorHref, genreHref, readerHref } from "@/lib/routes"
import { useSeriesViewer, useSubscribe } from "@/lib/me"
import { useLocalize } from "@/lib/localize"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"

const ghostDark =
  "border-white/20 bg-white/10 text-surface-foreground shadow-none hover:bg-white/[0.18] hover:text-surface-foreground focus-visible:ring-offset-surface"

/** Which episode the main button opens: 1, or "Continue" from the last read one (Assumption 7). */
export function useContinueTarget(series: Series): { episode: number; continuing: boolean } {
  const { lastRead, unlocked } = useSeriesViewer(series)
  if (lastRead <= 0) return { episode: 1, continuing: false }
  const next = lastRead + 1
  const readable = next <= series.totalEpisodes && (next <= series.freeEpisodes || !!unlocked?.includes(next))
  return { episode: readable ? next : lastRead, continuing: true }
}

/** "You've read 20 of 65 free episodes" + "31%", or "65 free · 3 Fast Pass" + "Start with episode 1". */
function useProgress(series: Series) {
  const t = useTranslations("series")
  const { lastRead } = useSeriesViewer(series)
  const novel = series.type === "novel"
  const free = Math.max(1, series.freeEpisodes)
  const read = Math.min(lastRead, free)
  const pct = lastRead > 0 ? Math.round((read / free) * 100) : 0
  return {
    pct,
    line:
      lastRead > 0
        ? t(novel ? "progressReadChapters" : "progressRead", { read, free })
        : t("progressNone", { free: series.freeEpisodes, fast: series.fastPassEpisodes }),
    right: lastRead > 0 ? t("percent", { pct }) : t(novel ? "startChapter" : "startEpisode"),
  }
}

export function SeriesHero({
  series,
  synopsis,
  stats,
  secondGenre,
  breakMessage,
  creatorHandle,
}: {
  series: Series
  synopsis: string
  /** Real API (V21-05): the creator's profile address; the demo links the creators in its data */
  creatorHandle?: string
  stats: { subscribers: string; comments: string }
  /** Real API (V21-02): the second genre, shown as a badge after the main one */
  secondGenre?: string | null
  /** Real API (V21-02): the creator's message while the series is on a break */
  breakMessage?: string | null
}) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const tt = useTranslations("toasts")
  const { subscribed, toggle: toggleSubscribe } = useSubscribe(series)
  const { episode, continuing } = useContinueTarget(series)
  const progress = useProgress(series)
  const novel = series.type === "novel"

  const readLabel = continuing
    ? t(novel ? "continueChapter" : "continueEpisode", { n: episode })
    : t(novel ? "readChapter" : "readEpisode")

  const statItems = [
    { label: t("views"), value: series.views },
    { label: t("likes"), value: series.likes },
    { label: t("subscribers"), value: stats.subscribers },
    { label: t(novel ? "chapters" : "episodes"), value: String(series.totalEpisodes) },
  ]

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(tt("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }

  return (
    <section className="relative isolate overflow-hidden bg-surface text-surface-foreground">
      <div aria-hidden className="absolute -inset-[60px] -z-20">
        <Image src={series.cover} alt="" fill sizes="100vw" priority className="object-cover opacity-50 blur-[48px] saturate-[1.3]" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,9,11,0.55),rgba(9,9,11,0.9))]" />

      <div className="container grid grid-cols-[minmax(0,1fr)] items-start gap-4 pt-4 pb-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-end md:gap-x-10 md:gap-y-5 md:pt-6 md:pb-10">
        <nav aria-label={t("breadcrumb")} className="md:col-span-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs leading-4 text-[#d4d4d8]">
            <li>
              <Link href="/" className="rounded-sm outline-none hover:text-surface-foreground focus-visible:ring-2 focus-visible:ring-ring">
                {t("home")}
              </Link>
            </li>
            <ChevronRightIcon className="size-3" aria-hidden />
            <li>
              <Link
                href={genreHref(series.genre)}
                className="rounded-sm outline-none hover:text-surface-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {loc.genre(series.genre)}
              </Link>
            </li>
            <ChevronRightIcon className="size-3" aria-hidden />
            <li aria-current="page" className="text-white">
              {series.title}
            </li>
          </ol>
        </nav>

        <div className="aspect-[3/4] w-[132px] overflow-hidden rounded-[10px] bg-surface-panel shadow-[0_20px_50px_rgba(0,0,0,0.5)] md:w-60 md:rounded-[14px]">
          <Image
            src={series.cover}
            alt={t("coverAlt", { title: series.title })}
            width={480}
            height={640}
            sizes="(min-width: 768px) 240px, 132px"
            priority
            className="size-full object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="dark">{loc.genre(series.genre)}</Badge>
            {secondGenre ? <Badge variant="dark">{loc.genre(secondGenre)}</Badge> : null}
            <Badge variant="dark">{t(novel ? "novel" : "comic")}</Badge>
            {series.schedule ? (
              <Badge variant="dark">
                <CalendarIcon className="size-3" aria-hidden />
                {loc.schedule(series)}
              </Badge>
            ) : null}
            <Badge variant="new">{t(series.status === "completed" ? "completed" : series.status === "hiatus" ? "onBreak" : "ongoing")}</Badge>
          </div>
          <h1 className="type-series-title">{series.title}</h1>
          <p className="flex items-center gap-2 text-[13px] leading-[18px] text-[#e4e4e7]">
            <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
              {initials(series.creator)}
            </span>
            {/* The creator's profile (/creators/[handle]): the API sends the address; the demo has profiles for the creators in its data. */}
            {creatorHandle || creatorNameByHandle(creatorHandle_(series.creator)) ? (
              <Link
                href={creatorHandle ? `/creators/${creatorHandle}` : creatorHref(series.creator)}
                className="rounded-sm underline-offset-3 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
              >
                {series.creator}
              </Link>
            ) : (
              series.creator
            )}
          </p>
          {series.status === "hiatus" && breakMessage ? (
            <p className="max-w-[62ch] text-[13px] leading-[18px] font-medium break-words text-surface-foreground">{t("breakNote", { message: breakMessage })}</p>
          ) : null}
          <p className="max-w-[62ch] text-[15px] leading-6 text-[#d4d4d8]">{synopsis}</p>

          <dl className="flex flex-wrap gap-[18px] md:gap-7">
            {statItems.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-xs text-surface-quiet">{s.label}</dt>
                <dd className="text-lg leading-6 font-bold tabular-nums"><Num>{s.value}</Num></dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild variant="brand" size="lg">
              <Link href={readerHref(series, episode)}>
                <BookOpenIcon />
                {readLabel}
              </Link>
            </Button>
            <Button variant="outline" size="lg" aria-pressed={subscribed} className={ghostDark} onClick={() => void toggleSubscribe()}>
              {subscribed ? t("subscribedLabel") : t("subscribeLabel")}
            </Button>
            <Button variant="outline" size="icon" className={cn(ghostDark, "size-11 rounded-[10px]")} aria-label={t("copyLink")} onClick={share}>
              <ShareIcon />
            </Button>
          </div>

          <div className="flex max-w-[420px] flex-col gap-1.5 pt-0.5">
            <div className="flex justify-between gap-3 text-xs leading-4 text-[#d4d4d8]">
              <span>{progress.line}</span>
              <span className="shrink-0 tabular-nums">{progress.right}</span>
            </div>
            <div
              role="progressbar"
              aria-label={t("progressLabel")}
              aria-valuenow={progress.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.18]"
            >
              <span className="block h-full rounded-full bg-primary" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Phone only (prototype `.sr-sticky`): "Glass Compass / You've read …" + "Continue Ep. N" stuck above the tab bar once
 * the hero has scrolled away (`heroRef`).
 */
export function SeriesStickyBar({ series, heroRef }: { series: Series; heroRef: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations("series")
  const { episode, continuing } = useContinueTarget(series)
  const progress = useProgress(series)
  const [shown, setShown] = useState(false)
  const novel = series.type === "novel"

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [heroRef])

  return (
    <div
      aria-hidden={!shown}
      className={cn(
        "sticky bottom-[62px] z-30 mx-3 mb-3 flex items-center gap-3 rounded-[14px] border bg-white/[0.97] py-2.5 pr-2.5 pl-3.5 shadow-md transition-[opacity,transform] duration-200 motion-reduce:transition-none md:hidden",
        shown ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-[18px] font-semibold">{series.title}</span>
        <span className="truncate text-xs leading-4 text-muted-foreground">{progress.line}</span>
      </div>
      <Button asChild variant="brand" tabIndex={shown ? 0 : -1}>
        <Link href={readerHref(series, episode)} tabIndex={shown ? 0 : -1}>
          {continuing ? t(novel ? "continueShortChapter" : "continueShort", { n: episode }) : t(novel ? "readShortChapter" : "readShort")}
        </Link>
      </Button>
    </div>
  )
}
