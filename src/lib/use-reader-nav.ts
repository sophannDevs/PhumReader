"use client"

import { useEffect } from "react"
import type { ListEpisode } from "@/components/layout/episode-list-popover"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import type { Episode, Series } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useEpisodes } from "@/lib/queries"
import { readerHref } from "@/lib/routes"
import { seriesHref } from "@/lib/routes"
import { useRecordReading, useSeriesViewer } from "@/lib/me"
import { useAppStore, useCoins, useHydrated } from "@/lib/store"

/**
 * Shared by the comic and novel readers: records reading progress, moves between
 * episodes / chapters (a locked one opens the UnlockDialog instead of navigating),
 * and binds ← / → (ignored while typing or while a dialog or menu is open).
 */
export function useReaderNav(series: Series, n: number, total: number) {
  const router = useRouter()
  const coins = useCoins()
  const episodes = useEpisodes(series.slug)
  const { unlocked } = useSeriesViewer(series)
  const { request, dialog } = useSeriesUnlock(series)

  const hydrated = useHydrated()

  const list = episodes.data ?? []
  const isLocked = (e: Episode) => e.access === "fastpass" && !unlocked?.includes(e.n)
  const here = list.find((x) => x.n === n)
  const lockedHere = hydrated && !!here && isLocked(here)
  // Held back until the store and the episode list are known: a locked episode opened by URL
  // must never show its pages, it goes to the series page with the unlock dialog open.
  const gated = !hydrated || episodes.isPending || lockedHere

  const { finishRef } = useRecordReading(series, n, !gated)

  useEffect(() => {
    if (!lockedHere) return
    useAppStore.getState().setPendingUnlock({ seriesId: series.id, episode: n, direct: true })
    router.replace(seriesHref(series))
  }, [lockedHere, series, n, router])

  function go(target: number) {
    if (target < 1 || target > total) return
    const e = list.find((x) => x.n === target)
    if (e && isLocked(e)) request(e)
    else router.push(readerHref(series, target))
  }

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

  const listEpisodes: ListEpisode[] = list.map((e) => ({
    n: e.n,
    title: e.title,
    thumb: e.thumb,
    locked: isLocked(e),
  }))

  return { go, list, listEpisodes, isLocked, coins, request, dialog, gated, finishRef }
}
