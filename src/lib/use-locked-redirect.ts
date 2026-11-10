"use client"

import { useEffect } from "react"
import type { Episode, Series } from "@/data"
import { errorCode } from "@/lib/api/errors"
import { useSeriesViewer } from "@/lib/me"
import { useEpisodes, useSeries } from "@/lib/queries"

/**
 * Real API: a locked episode opened by URL answers 402 `episode_locked`, without the series or the episode.
 * The readers then show their Fast Pass lock screen (spec §3 / §4 "Locked") instead of the pages; this hook loads
 * what that screen needs (the series and the episode's summary from the list). `pending` while they load.
 * The demo never answers 402 (its readers check the store), so this stays idle there.
 */
export function useLockedEpisode(
  slug: string,
  n: number,
  error: unknown
): { locked: boolean; pending: boolean; series?: Series; episode?: Episode; total: number } {
  const locked = errorCode(error) === "episode_locked"
  const series = useSeries(slug, locked)
  const episodes = useEpisodes(slug)
  if (!locked) return { locked, pending: false, total: 0 }
  const list = episodes.data ?? []
  return {
    locked,
    pending: series.isPending || episodes.isPending,
    series: series.data?.series,
    episode: list.find((e) => e.n === n),
    total: list.length,
  }
}

/**
 * Real API: once the locked episode is unlocked (the unlock updates the reader's marks), load its pages again.
 * `refetch` is the episode query's.
 */
export function useReloadWhenUnlocked(series: Series, n: number, lockedByApi: boolean, refetch: () => unknown) {
  const { unlocked } = useSeriesViewer(series)
  const nowOpen = lockedByApi && !!unlocked?.includes(n)
  useEffect(() => {
    if (nowOpen) void refetch()
  }, [nowOpen, refetch])
}
