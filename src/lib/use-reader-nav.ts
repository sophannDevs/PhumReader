"use client"

import { useEffect } from "react"
import type { ListEpisode } from "@/components/layout/episode-list-popover"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import type { Episode, Series } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useEpisodes } from "@/lib/queries"
import { readerHref } from "@/lib/routes"
import { useAppStore, useCoins } from "@/lib/store"

/**
 * Shared by the comic and novel readers: records reading progress, moves between
 * episodes / chapters (a locked one opens the UnlockDialog instead of navigating),
 * and binds ← / → (ignored while typing or while a dialog or menu is open).
 */
export function useReaderNav(series: Series, n: number, total: number) {
  const router = useRouter()
  const coins = useCoins()
  const episodes = useEpisodes(series.slug)
  const unlocked = useAppStore((s) => s.unlocked[series.id])
  const { request, dialog } = useSeriesUnlock(series)

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

  return { go, list, listEpisodes, isLocked, coins, request, dialog }
}
