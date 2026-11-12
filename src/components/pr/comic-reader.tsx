"use client"

import { ChevronLeftIcon } from "@/components/animate-ui/icons/chevron-left"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { notFound } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import Image from "next/image"
import { memo, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { EpisodeListPopover } from "@/components/layout/episode-list-popover"
import { barButton, ComicReaderBar } from "@/components/layout/reader-bar"
import { ComicSettingsPopover } from "@/components/layout/reading-settings"
import { ComicEndSection } from "@/components/pr/comic-end-section"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { FastPassLockCard } from "@/components/pr/fast-pass-lock-card"
import { comicVars } from "@/components/pr/reader-theme"
import { StarsBackground } from "@/components/pr/stars-background"
import { ResumeChip } from "@/components/pr/resume-chip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { episodePrice, episodesCost, fastPassPrice, type Episode, type Panel, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { useEpisode } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { useAppStore, useUser } from "@/lib/store"
import { useLockedEpisode, useReloadWhenUnlocked } from "@/lib/use-locked-redirect"
import { arrowStep, useReaderNav } from "@/lib/use-reader-nav"
import { useReadingPosition } from "@/lib/use-reading-position"
import { cn } from "@/lib/utils"

const AUTO_NEXT_SECONDS = 5

export function ReaderSkeleton() {
  return (
    <div className="flex-1 bg-surface" aria-hidden>
      <Skeleton className="h-14 rounded-none bg-surface-panel" />
      <div className="mx-auto flex max-w-[800px] flex-col">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[420px] rounded-none bg-surface-panel" />
        ))}
      </div>
    </div>
  )
}

/**
 * Comic reader (spec §3, prototype Viewer): bar with the place in the episode, settings (scroll / page by page,
 * dark / light, full / narrow, auto-next, data saver), resume chip, the strip or one page at a time, the end of
 * the episode, and the Fast Pass lock screen for a locked episode (demo: from the store; real API: the 402).
 */
export function ComicReader({ slug, n }: { slug: string; n: number }) {
  const query = useEpisode(slug, n)
  const t = useTranslations("reader")
  const lock = useLockedEpisode(slug, n, query.error)

  if (query.isPending || (lock.locked && lock.pending)) return <ReaderSkeleton />
  if (lock.locked && lock.series && lock.episode)
    return (
      <ComicReaderBody
        key={`${slug}:${n}`}
        series={lock.series}
        episode={lock.episode}
        total={lock.total}
        panels={[]}
        lockedByApi
        refetch={query.refetch}
      />
    )
  if (query.isError)
    return (
      <div style={comicVars("dark")} className="flex flex-1 flex-col bg-background text-foreground">
        <ErrorState
          className="flex-1 justify-center"
          onRetry={() => void query.refetch()}
          extra={
            <Button asChild variant="ghost">
              <Link href={`/series/${slug}`}>{t("backToSeries")}</Link>
            </Button>
          }
        />
      </div>
    )
  if (!query.data) notFound()
  const d = query.data
  return (
    <ComicReaderBody
      key={`${slug}:${n}`}
      series={d.series}
      episode={d.episode}
      total={d.total}
      panels={d.panels}
      commentsEnabled={d.commentsEnabled !== false}
      refetch={query.refetch}
    />
  )
}

type BodyProps = {
  series: Series
  episode: Episode
  total: number
  panels: Panel[]
  lockedByApi?: boolean
  /** Real API (V21-02): false when the episode's or the series' comments switch is off (no comment box) */
  commentsEnabled?: boolean
  refetch: () => unknown
}

function ComicReaderBody(props: BodyProps) {
  const { series, episode, total, lockedByApi = false, refetch } = props
  const pageMode = useAppStore((s) => s.settings.mode === "page")
  // Page by page binds ← / → to the pages itself (ComicReaderView).
  const nav = useReaderNav(series, episode.n, total, { keys: !pageMode, lockedByApi })
  useReloadWhenUnlocked(series, episode.n, lockedByApi, refetch)
  if (nav.gated) return <ReaderSkeleton />
  return <ComicReaderView {...props} nav={nav} pageMode={pageMode} />
}

type Nav = ReturnType<typeof useReaderNav>

/** Mounted once the store and the episode list are known (the saved place is read on mount). */
function ComicReaderView({ series, episode, total, panels, commentsEnabled = true, nav, pageMode }: BodyProps & { nav: Nav; pageMode: boolean }) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const user = useUser()
  const bg = useAppStore((s) => s.readerBg)
  const narrow = useAppStore((s) => s.readerWidth === "narrow")
  const autoNext = useAppStore((s) => s.settings.autoNext)
  const saveData = useAppStore((s) => s.settings.saveData)
  const n = episode.n
  // This episode's Fast Pass price (real API: its own, or the one its 402 named); the demo's are all 5 coins.
  const price = episodePrice(episode)
  const title = loc.title(episode.title)
  const { go, list, listEpisodes, isLocked, coins, request, handOff, dialog, locked, finishRef } = nav
  const next = list.find((e) => e.n === n + 1)
  const nextLocked = !!next && isLocked(next)

  const [page, setPage] = useState(0)
  const lastPage = Math.max(0, panels.length - 1)
  const pg = Math.min(page, lastPage)
  const showEnd = !locked && (!pageMode || pg === lastPage)

  // Auto-open the next episode: 5 s countdown at the end, once per episode, never into a locked one.
  const [countdown, setCountdown] = useState<number | null>(null)
  const counted = useRef(false)
  const maybeAutoNext = () => {
    if (!autoNext || !next || nextLocked || counted.current) return
    counted.current = true
    setCountdown(AUTO_NEXT_SECONDS)
  }
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  useEffect(() => {
    if (countdown === null) return
    const id = setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null)
        goRef.current(n + 1)
      } else setCountdown(countdown - 1)
    }, 1000)
    return () => clearTimeout(id)
  }, [countdown, n])

  const position = useReadingPosition({
    seriesId: series.id,
    n,
    savePos: !locked && !pageMode,
    onEnd: showEnd ? maybeAutoNext : undefined,
  })

  // Page by page: ← / → turn pages (the last one leads to the next episode); on the lock screen they change episode.
  const pageNext = () => {
    if (pg < lastPage) {
      setPage(pg + 1)
      window.scrollTo({ top: 0 })
    } else if (next) go(n + 1)
    else document.getElementById("end-of-episode")?.scrollIntoView({ block: "start" })
  }
  const pagePrev = () => {
    if (pg === 0) return
    setPage(pg - 1)
    window.scrollTo({ top: 0 })
  }
  const keyRef = useRef({ pageNext, pagePrev, locked })
  useEffect(() => {
    keyRef.current = { pageNext, pagePrev, locked }
  })
  useEffect(() => {
    if (!pageMode) return
    function onKey(e: KeyboardEvent) {
      const step = arrowStep(e)
      if (!step) return
      const k = keyRef.current
      if (k.locked) goRef.current(n + step)
      else if (step > 0) k.pageNext()
      else k.pagePrev()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [pageMode, n])

  const progress = locked ? 0 : pageMode ? (panels.length ? (pg + 1) / panels.length : 0) : position.pct
  const lockedList = list.filter((e) => isLocked(e))
  const bundle = lockedList.length
  const btn = barButton

  return (
    <div style={comicVars(bg)} className={cn("relative isolate flex flex-1 flex-col text-foreground", bg === "dark" ? "bg-background" : "bg-muted")}>
      {bg === "dark" ? <StarsBackground className="text-foreground/60" /> : null}
      <ComicReaderBar
        light={bg === "light"}
        backHref={seriesHref(series)}
        seriesTitle={series.title}
        itemTitle={title}
        progress={progress}
        prevDisabled={n <= 1}
        nextDisabled={n >= total}
        onPrev={() => go(n - 1)}
        onNext={() => go(n + 1)}
        listSlot={<EpisodeListPopover episodes={listEpisodes} current={n} coins={coins} price={fastPassPrice()} onSelect={go} triggerClassName={btn} />}
        settingsSlot={<ComicSettingsPopover triggerClassName={btn} />}
      />

      {!locked && !pageMode && position.resumeAt > 0 ? (
        <ResumeChip pct={position.resumeAt} onContinue={position.resume} onStartOver={position.startOver} />
      ) : null}

      {locked ? (
        <section
          aria-labelledby="lock-title"
          className="relative flex min-h-[620px] justify-center overflow-hidden px-4 py-12 max-md:min-h-[520px] max-md:px-3 max-md:py-6"
        >
          <div aria-hidden className="absolute inset-0">
            <Image
              src={panels[0]?.src ?? episode.thumb}
              alt=""
              fill
              sizes="100vw"
              className="scale-110 object-cover blur-[28px] brightness-[.45]"
            />
          </div>
          <FastPassLockCard
            kind="episode"
            className="self-center"
            title={title}
            n={n}
            freeDate={episode.date}
            price={price}
            coins={coins}
            loggedIn={!!user}
            bundle={bundle > 1 ? { count: bundle, cost: episodesCost(lockedList) } : null}
            onLogin={() => handOff("login", episode)}
            onUnlock={() => request(episode, "one")}
            onGetCoins={() => handOff("coins", episode)}
            onUnlockAll={() => request(episode, "all")}
            onBack={() => go(n - 1)}
            canGoBack={n > 1}
          />
        </section>
      ) : pageMode && panels.length > 0 ? (
        <>
          <div
            role="region"
            aria-label={t("pageLabel", { title, page: pg + 1, total: panels.length })}
            className={cn("relative mx-auto flex w-full justify-center bg-white", narrow ? "max-w-[560px]" : "max-w-[800px]")}
          >
            <h1 className="sr-only">{title}</h1>
            <button
              type="button"
              aria-label={t("prevPage")}
              disabled={pg === 0}
              onClick={pagePrev}
              className="absolute inset-y-0 left-0 z-[2] w-[35%] cursor-w-resize outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-default"
            />
            <Image
              key={panels[pg].src}
              src={panels[pg].src}
              alt={panels[pg].alt}
              width={panels[pg].width}
              height={panels[pg].height}
              sizes={saveData ? "(min-width: 800px) 400px, 50vw" : "(min-width: 800px) 800px, 100vw"}
              priority
              className="block h-auto w-full"
            />
            <button
              type="button"
              aria-label={t("nextPage")}
              onClick={pageNext}
              className="absolute inset-y-0 right-0 z-[2] w-[35%] cursor-e-resize outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            />
          </div>
          <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-3 border-b px-6 py-3">
            <Button variant="ghost" size="sm" className={btn} disabled={pg === 0} onClick={pagePrev}>
              <ChevronLeftIcon className="size-3.5" aria-hidden />
              {t("back")}
            </Button>
            <span aria-live="polite" className="text-[13px] font-medium tabular-nums">
              {t("pageCount", { page: pg + 1, total: panels.length })}
            </span>
            <Button variant="ghost" size="sm" className={btn} onClick={pageNext}>
              {pg < lastPage ? t("next") : next ? t("nextEpisode") : t("done")}
              <ChevronRightIcon className="size-3.5" aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <Strip panels={panels} narrow={narrow} saveData={saveData} title={title} />
      )}

      {showEnd ? (
        <div id="end-of-episode" className="scroll-mt-16">
          <ComicEndSection
            finishRef={finishRef}
            series={series}
            episode={episode}
            next={next}
            nextLocked={nextLocked}
            price={episodePrice(next)}
            onNext={() => {
              setCountdown(null)
              go(n + 1)
            }}
            countdown={countdown}
            onCancelAuto={() => {
              setCountdown(null)
              toast(t("autoNextCancelled"))
            }}
            commentsEnabled={commentsEnabled}
          />
        </div>
      ) : null}
      {dialog}
    </div>
  )
}

/** The scroll strip: 800 px (560 px narrow) of panels on white. */
const Strip = memo(function Strip({ panels, narrow, saveData, title }: { panels: Panel[]; narrow: boolean; saveData: boolean; title: string }) {
  const t = useTranslations("reader")
  return (
    <article
      aria-label={title}
      className={cn(
        "mx-auto flex w-full flex-col bg-white transition-[max-width] duration-200 motion-reduce:transition-none",
        narrow ? "max-w-[560px]" : "max-w-[800px]"
      )}
    >
      <h1 className="sr-only">{title}</h1>
      {panels.length === 0 ? (
        <EmptyState title={t("noPages")} description={t("noPagesDesc")} className="min-h-[50vh] justify-center bg-background text-foreground [&_p]:text-muted-foreground" />
      ) : null}
      {panels.map((p, i) => (
        <Image
          key={p.src}
          src={p.src}
          alt={p.alt}
          width={p.width}
          height={p.height}
          sizes={saveData ? "(min-width: 800px) 400px, 50vw" : "(min-width: 800px) 800px, 100vw"}
          priority={i < 2}
          className="block h-auto w-full"
        />
      ))}
    </article>
  )
})
