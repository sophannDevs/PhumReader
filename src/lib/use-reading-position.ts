"use client"

import { useEffect, useRef, useState } from "react"
import { useAppStore } from "@/lib/store"

/** The stored place shows the resume chip only between 5% and 95% (spec §0 `pos`). */
export const resumable = (p: number | undefined): p is number => p !== undefined && p > 0.05 && p < 0.95

const scrollable = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight)

/**
 * Where the reader is in an episode or chapter (prototype Viewer / Novel scroll handler):
 * - `pct`: 0..1 of the page scrolled, for the progress line under the bar;
 * - saves the place to the store (`pos[seriesId][n]`) while it is between 5% and 95%, and clears it after 95%;
 * - `onEnd` once the reader is at 97% (the comic's auto-next);
 * - `resumeAt`: the place saved last time (0 = none), with `resume()` (scroll there) and `startOver()` (forget it).
 * Mount it only once the store is loaded: the saved place is read when it mounts.
 */
export function useReadingPosition({
  seriesId,
  n,
  savePos = true,
  onEnd,
}: {
  seriesId: string
  n: number
  /** false in the comic's page-by-page mode (the place is a scroll position) */
  savePos?: boolean
  onEnd?: () => void
}) {
  const [pct, setPct] = useState(0)
  const [resumeAt, setResumeAt] = useState(() => {
    const p = useAppStore.getState().pos[seriesId]?.[n]
    return resumable(p) ? p : 0
  })
  const endRef = useRef(onEnd)
  useEffect(() => {
    endRef.current = onEnd
  })

  useEffect(() => {
    let frame = 0
    let last = -1
    const update = () => {
      frame = 0
      const p = Math.min(1, Math.max(0, window.scrollY / scrollable()))
      if (Math.abs(p - last) < 0.01 && p < 0.97) return
      last = p
      setPct(p)
      if (savePos) {
        const store = useAppStore.getState()
        const saved = store.pos[seriesId]?.[n] ?? 0
        if (p > 0.05 && p < 0.95) store.setPos(seriesId, n, Math.round(p * 100) / 100)
        else if (p >= 0.95 && saved > 0) store.setPos(seriesId, n, 0)
      }
      if (p >= 0.97) endRef.current?.()
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [seriesId, n, savePos])

  return {
    pct,
    resumeAt,
    resume: () => {
      window.scrollTo({ top: resumeAt * scrollable() })
      setResumeAt(0)
    },
    startOver: () => {
      useAppStore.getState().setPos(seriesId, n, 0)
      setResumeAt(0)
      window.scrollTo({ top: 0 })
    },
  }
}
