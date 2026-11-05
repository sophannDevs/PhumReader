"use client"

import { notFound } from "next/navigation"
import Image from "next/image"
import { useEffect } from "react"
import { EpisodeListPopover, type ListEpisode } from "@/components/layout/episode-list-popover"
import { ComicReaderBar } from "@/components/layout/reader-bar"
import { ComicEndSection } from "@/components/pr/comic-end-section"
import { ErrorState } from "@/components/pr/error-state"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import { Skeleton } from "@/components/ui/skeleton"
import type { Episode, Series } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useEpisode, useEpisodes } from "@/lib/queries"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore, useCoins } from "@/lib/store"

function ReaderSkeleton() {
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

/** Comic reader: dark page, bar, 800 px image strip. Locked episodes open the UnlockDialog. */
export function ComicReader({ slug, n }: { slug: string; n: number }) {
  const query = useEpisode(slug, n)

  if (query.isPending) return <ReaderSkeleton />
  if (query.isError) return <ErrorState className="flex-1 bg-surface text-surface-foreground" onRetry={() => void query.refetch()} />
  if (!query.data) notFound()
  return <ComicReaderBody series={query.data.series} episode={query.data.episode} total={query.data.total} panels={query.data.panels} />
}

type Data = NonNullable<ReturnType<typeof useEpisode>["data"]>

function ComicReaderBody({ series, episode, total, panels }: { series: Series; episode: Episode; total: number; panels: Data["panels"] }) {
  const router = useRouter()
  const coins = useCoins()
  const episodes = useEpisodes(series.slug)
  const unlocked = useAppStore((s) => s.unlocked[series.id])
  const { request, dialog } = useSeriesUnlock(series)
  const n = episode.n

  // Opening an episode records reading progress.
  useEffect(() => {
    useAppStore.getState().markRead(series.id, n)
  }, [series.id, n])

  const list = episodes.data ?? []
  const isLocked = (e: Episode) => e.access === "fastpass" && !unlocked?.includes(e.n)

  function go(target: number) {
    if (target < 1 || target > total) return
    const e = list.find((x) => x.n === target)
    if (e && isLocked(e)) request(e)
    else router.push(readerHref(series, target))
  }

  // ← / → move between episodes (not while typing or while a dialog is open).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (document.querySelector('[role="dialog"], [role="menu"]')) return
      go(e.key === "ArrowLeft" ? n - 1 : n + 1)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  })

  const listEpisodes: ListEpisode[] = list.map((e) => ({ n: e.n, title: e.title, thumb: e.thumb, locked: isLocked(e) }))

  return (
    <div className="flex flex-1 flex-col bg-surface text-surface-foreground">
      <ComicReaderBar
        backHref={seriesHref(series)}
        seriesTitle={series.title}
        itemTitle={episode.title}
        progress={n / total}
        prevDisabled={n <= 1}
        nextDisabled={n >= total}
        onPrev={() => go(n - 1)}
        onNext={() => go(n + 1)}
        listSlot={<EpisodeListPopover episodes={listEpisodes} current={n} coins={coins} onSelect={go} />}
      />
      <article className="mx-auto w-full max-w-[800px] bg-white">
        {panels.map((p, i) => (
          <Image
            key={p.src}
            src={p.src}
            alt={p.alt}
            width={p.width}
            height={p.height}
            sizes="(min-width: 800px) 800px, 100vw"
            priority={i < 2}
            className="block h-auto w-full"
          />
        ))}
      </article>
      <ComicEndSection
        series={series}
        episode={episode}
        next={list.find((e) => e.n === n + 1)}
        nextLocked={(() => {
          const nx = list.find((e) => e.n === n + 1)
          return !!nx && isLocked(nx)
        })()}
        onUnlockNext={() => go(n + 1)}
      />
      {dialog}
    </div>
  )
}
