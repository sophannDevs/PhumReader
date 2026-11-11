"use client"

import { useEffect, useRef } from "react"
import type { ListEpisode } from "@/components/layout/episode-list-popover"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import type { Episode, Series } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { useEpisodes } from "@/lib/queries"
import { readerHref } from "@/lib/routes"
import { useRecordReading, useSeriesViewer } from "@/lib/me"
import { useCoins, useHydrated } from "@/lib/store"

/**
 * ← / → for the readers: ignored with a modifier, while typing, or while a dialog, popover or menu is open.
 * Returns -1, 1 or 0 (not for us).
 */
export function arrowStep(e: KeyboardEvent): -1 | 0 | 1 {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return 0
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return 0
  const el = e.target as HTMLElement | null
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return 0
  if (document.querySelector('[role="dialog"], [role="menu"], [role="alertdialog"]')) return 0
  return e.key === "ArrowLeft" ? -1 : 1
}

/**
 * Shared by the comic and novel readers: records reading progress, moves between episodes / chapters (a locked one
 * opens the UnlockDialog instead of navigating), binds ← / → (unless `keys` is false, e.g. the comic's page-by-page
 * mode), and says whether this episode is locked (`locked`: the reader shows its Fast Pass lock screen).
 * Demo: locked = a Fast Pass episode not unlocked in the store. Real API: the episode answered 402 (`lockedByApi`).
 */
export function useReaderNav(series: Series, n: number, total: number, opts: { keys?: boolean; lockedByApi?: boolean } = {}) {
  const router = useRouter()
  const coins = useCoins()
  const episodes = useEpisodes(series.slug)
  const { unlocked } = useSeriesViewer(series)
  const { request, dialog, handOff } = useSeriesUnlock(series, { returnPage: readerHref(series, n) })

  const hydrated = useHydrated()

  const list = episodes.data ?? []
  const isLocked = (e: Episode) => e.access === "fastpass" && !unlocked?.includes(e.n)
  const here = list.find((x) => x.n === n)
  // A locked episode opened by URL never shows its pages: the reader shows the lock screen instead.
  const locked = DEMO_MODE ? hydrated && !!here && isLocked(here) : !!opts.lockedByApi
  // Held back until the store and the episode list are known.
  const gated = !hydrated || episodes.isPending

  const { finishRef } = useRecordReading(series, n, !gated && !locked)

  function go(target: number) {
    if (target < 1 || target > total) return
    const e = list.find((x) => x.n === target)
    if (e && isLocked(e)) request(e)
    else router.push(readerHref(series, target))
  }

  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  })
  const keys = opts.keys !== false
  useEffect(() => {
    if (!keys) return
    function onKey(e: KeyboardEvent) {
      const step = arrowStep(e)
      if (step) goRef.current(n + step)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [keys, n])

  const listEpisodes: ListEpisode[] = list.map((e) => ({
    n: e.n,
    title: e.title,
    date: e.date,
    thumb: e.thumb,
    locked: isLocked(e),
  }))

  return { go, list, listEpisodes, isLocked, coins, request, handOff, dialog, gated, locked, finishRef }
}
