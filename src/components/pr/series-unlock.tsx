"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { UnlockDialog } from "@/components/pr/unlock-dialog"
import { fastPassPrice, type Episode, type Series } from "@/data"
import { usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as realCoins from "@/lib/api/coins"
import { ApiError, idempotencyKey } from "@/lib/api/client"
import type { Viewer } from "@/lib/api/me"
import { unlock } from "@/lib/demo-api"
import { meKeys, useAccountEmail } from "@/lib/me"
import { useEpisodes } from "@/lib/queries"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore, useCoins, useHydrated, useUser } from "@/lib/store"
import { applyBalance } from "@/lib/wallet"

/**
 * Owns the UnlockDialog of a series page (Episodes tab rows call `request`).
 * Logged out -> Log in (saves returnTo + pendingUnlock); enough coins -> unlock
 * and open the reader; not enough -> Coins (saves shopReturn + pendingUnlock).
 * On mount it reopens the dialog when a pendingUnlock for this series is waiting.
 */
export function useSeriesUnlock(series: Series) {
  const tt = useTranslations("toasts")
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const coins = useCoins()
  const hydrated = useHydrated()
  const pending = useAppStore((s) => s.pendingUnlock)
  const episodes = useEpisodes(series.slug)
  const [target, setTarget] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(false)
  const email = useAccountEmail()
  const qc = useQueryClient()
  // One key per episode being unlocked: pressing Unlock again after a network error never charges twice.
  const unlockKey = useRef<{ n: number; key: string } | null>(null)
  const price = fastPassPrice()
  const novel = series.type === "novel"

  // Back from /login or /coins: reopen the dialog once, then forget the request.
  // Cache Components keeps this page mounted (hidden) while the reader is on /login or
  // /coins, so a one-time-per-mount check is not enough. Instead the check is re-armed
  // whenever the route leaves this page, and `selfRequest` ignores a request this very
  // page just saved (Log in / Get coins) so it is not mistaken for a returning one.
  const myPath = useRef(pathname)
  const selfRequest = useRef(false)
  // Effect cleanups run when the page is hidden (or unmounted): re-arm for the return trip.
  useEffect(() => {
    return () => {
      selfRequest.current = false
    }
  }, [])
  useEffect(() => {
    if (pathname !== myPath.current) {
      selfRequest.current = false
      return
    }
    if (!hydrated || !episodes.data || selfRequest.current) return
    if (!pending || pending.seriesId !== series.id) return
    // A redirect from a reader (`direct`) is for the series page only, even when logged out.
    if (pending.direct ? pathname !== seriesHref(series) : !user) return
    const episode = episodes.data.find((e) => e.n === pending.episode)
    useAppStore.getState().clearPendingUnlock()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reopen after returning from /login or /coins
    if (episode && episode.access === "fastpass") setTarget(episode)
  }, [pathname, hydrated, user, pending, series, episodes.data])

  const store = useAppStore.getState
  const here = () => `${pathname}${typeof window === "undefined" ? "" : window.location.search}`

  const dialog = target ? (
    <UnlockDialog
      open
      onOpenChange={(open) => !open && setTarget(null)}
      episode={{ n: target.n, thumb: target.thumb, freeDate: target.date }}
      kind={novel ? "chapter" : "episode"}
      loggedIn={!!user}
      balance={coins}
      price={price}
      loading={loading}
      onLogin={() => {
        selfRequest.current = true
        store().setReturnTo(here())
        store().setPendingUnlock({ seriesId: series.id, episode: target.n })
        setTarget(null)
        router.push("/login")
      }}
      onGetCoins={() => {
        selfRequest.current = true
        store().setShopReturn({ page: seriesHref(series), episode: target.n, title: series.title })
        store().setPendingUnlock({ seriesId: series.id, episode: target.n })
        setTarget(null)
        router.push("/coins")
      }}
      onUnlock={async () => {
        setLoading(true)
        try {
          if (DEMO_MODE) {
            await unlock(series.id, target.n)
            store().spendCoins(price)
            store().unlockEpisode(series.id, target.n)
          } else {
            if (unlockKey.current?.n !== target.n) unlockKey.current = { n: target.n, key: idempotencyKey() }
            const result = await realCoins.unlockEpisode(series.slug, target.n, unlockKey.current.key)
            unlockKey.current = null
            if (email) {
              applyBalance(qc, email, result.balance)
              qc.setQueryData<Viewer>(meKeys.viewer(email, series.slug), (v) =>
                v && !v.unlocked.includes(target.n) ? { ...v, unlocked: [...v.unlocked, target.n].sort((a, b) => a - b) } : v
              )
              void qc.invalidateQueries({ queryKey: meKeys.viewer(email, series.slug) })
              void qc.invalidateQueries({ queryKey: meKeys.unlocked(email) })
            }
          }
          toast.success(tt(novel ? "chapterUnlocked" : "episodeUnlocked", { n: target.n }))
          const n = target.n
          setTarget(null)
          router.push(readerHref(series, n))
        } catch (error) {
          // Not enough coins (402) or an episode that is free now (409): the balance may have changed.
          if (!DEMO_MODE && email && error instanceof ApiError) void qc.invalidateQueries({ queryKey: ["wallet", email] })
          toast.error(tt("unlockFailed"))
        } finally {
          setLoading(false)
        }
      }}
    />
  ) : null

  return { request: setTarget, dialog }
}
