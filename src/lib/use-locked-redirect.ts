"use client"

import { useEffect } from "react"
import { useRouter } from "@/i18n/navigation"
import { errorCode } from "@/lib/api/errors"
import { useSeries } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"

/**
 * Real API: a locked episode opened by URL answers 402 `episode_locked`. Like the demo's
 * reader guard, the reader then goes to the series page with the unlock dialog open.
 * Returns true while that redirect is on its way (the reader keeps showing its skeleton).
 */
export function useLockedRedirect(slug: string, n: number, error: unknown): boolean {
  const locked = errorCode(error) === "episode_locked"
  const router = useRouter()
  // The dialog is keyed by the series id, which the 402 answer does not carry.
  const series = useSeries(slug, locked)

  useEffect(() => {
    if (!locked || !series.data) return
    useAppStore.getState().setPendingUnlock({ seriesId: series.data.series.id, episode: n, direct: true })
    router.replace(seriesHref({ slug }))
  }, [locked, series.data, slug, n, router])

  return locked
}
