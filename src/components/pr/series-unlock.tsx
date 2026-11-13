"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "@/i18n/translations"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { UnlockDialog, type UnlockMode } from "@/components/pr/unlock-dialog"
import { episodePrice, episodesCost, type Episode, type Series } from "@/data"
import { usePathname, useRouter } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import * as realCoins from "@/lib/api/coins"
import { ApiError, idempotencyKey } from "@/lib/api/client"
import { walletKeys } from "@/lib/api/keys"
import type { Viewer } from "@/lib/api/me"
import { unlock } from "@/lib/demo-api"
import { meKeys, useAccountEmail, useSeriesViewer } from "@/lib/me"
import { useEpisodes } from "@/lib/queries"
import { readerHref, seriesHref } from "@/lib/routes"
import { useAppStore, useCoins, useHydrated, useUser } from "@/lib/store"
import { applyBalance } from "@/lib/wallet"

/**
 * Owns the UnlockDialog of a series page and the readers. `request(episode)` opens it for one episode;
 * `request(episode, "all")` with every locked Fast Pass episode chosen (the bundle is unlocking each one).
 * Logged out -> Log in (saves returnTo + pendingUnlock); enough coins -> unlock and open the reader; not enough ->
 * Coins (saves shopReturn + pendingUnlock with `bundle` when the bundle was chosen). On mount it reopens the
 * dialog when a pendingUnlock for this series is waiting.
 */
export function useSeriesUnlock(
  series: Series,
  /** `returnPage`: where Coins sends the reader back after buying (default: the series page; the readers pass their own page). */
  opts?: { returnPage?: string }
) {
  const tt = useTranslations("toasts")
  const t = useTranslations("unlock")
  const router = useRouter()
  const pathname = usePathname()
  const user = useUser()
  const coins = useCoins()
  const hydrated = useHydrated()
  const pending = useAppStore((s) => s.pendingUnlock)
  const episodes = useEpisodes(series.slug)
  const { unlocked } = useSeriesViewer(series)
  const [target, setTarget] = useState<{ episode: Episode; mode: UnlockMode } | null>(null)
  const [loading, setLoading] = useState(false)
  const email = useAccountEmail()
  const qc = useQueryClient()
  // One key per episode being unlocked: pressing Unlock again after a network error never charges twice.
  const unlockKeys = useRef<Map<number, string>>(new Map())
  const novel = series.type === "novel"

  const lockedFast = (episodes.data ?? []).filter((e) => e.access === "fastpass" && !unlocked?.includes(e.n))

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
    if (episode && episode.access === "fastpass") setTarget({ episode, mode: pending.bundle ? "all" : "one" })
  }, [pathname, hydrated, user, pending, series, episodes.data])

  const store = useAppStore.getState
  const here = () => `${pathname}${typeof window === "undefined" ? "" : window.location.search}`

  const request = (episode: Episode, mode: UnlockMode = "one") => setTarget({ episode, mode })
  const returnPage = opts?.returnPage ?? seriesHref(series)

  /**
   * The readers' Fast Pass lock screen: straight to Log in or Coins for this episode (no dialog first), saving the
   * same hand-offs as the dialog's buttons. Coming back, the dialog reopens for it.
   */
  const handOff = (to: "login" | "coins", episode: Episode, mode: UnlockMode = "one") => {
    selfRequest.current = true
    if (to === "login") store().setReturnTo(here())
    else store().setShopReturn({ page: returnPage, episode: episode.n, title: series.title, price: episodePrice(episode), novel })
    store().setPendingUnlock({ seriesId: series.id, episode: episode.n, ...(mode === "all" ? { bundle: true } : {}) })
    setTarget(null)
    router.push(to === "login" ? "/login" : "/coins")
  }

  let dialog: React.ReactNode = null
  if (target) {
    const bundleList = lockedFast.length > 1 && lockedFast.some((e) => e.n === target.episode.n) ? lockedFast : null
    const mode: UnlockMode = target.mode === "all" && bundleList ? "all" : "one"
    const list = mode === "all" && bundleList ? bundleList : [target.episode]
    // Each episode at its own price (real API); the demo's are all 5 coins.
    const price = episodePrice(target.episode)
    const cost = episodesCost(list)
    const saveRequest = () =>
      store().setPendingUnlock({ seriesId: series.id, episode: target.episode.n, ...(mode === "all" ? { bundle: true } : {}) })

    dialog = (
      <UnlockDialog
        open
        onOpenChange={(open) => !open && setTarget(null)}
        episode={{ n: target.episode.n, thumb: target.episode.thumb, freeDate: target.episode.date }}
        kind={novel ? "chapter" : "episode"}
        loggedIn={!!user}
        balance={coins}
        price={price}
        bundle={
          bundleList
            ? {
                count: bundleList.length,
                first: bundleList[0].n,
                last: bundleList[bundleList.length - 1].n,
                lastDate: bundleList[bundleList.length - 1].date,
                cost: episodesCost(bundleList),
              }
            : null
        }
        mode={mode}
        onModeChange={(m) => setTarget({ episode: target.episode, mode: m })}
        loading={loading}
        onLogin={() => {
          selfRequest.current = true
          store().setReturnTo(here())
          saveRequest()
          setTarget(null)
          router.push("/login")
        }}
        onGetCoins={() => {
          selfRequest.current = true
          store().setShopReturn({ page: returnPage, episode: target.episode.n, title: series.title, price, novel })
          saveRequest()
          setTarget(null)
          router.push("/coins")
        }}
        onUnlock={async () => {
          setLoading(true)
          const done: number[] = []
          try {
            if (DEMO_MODE) {
              await unlock(series.id, list[0].n)
              store().spendCoins(cost)
              for (const e of list) store().unlockEpisode(series.id, e.n)
              done.push(...list.map((e) => e.n))
            } else {
              // The API unlocks one episode per call: the bundle is each locked episode in turn.
              for (const e of list) {
                const key = unlockKeys.current.get(e.n) ?? idempotencyKey()
                unlockKeys.current.set(e.n, key)
                const result = await realCoins.unlockEpisode(series.slug, e.n, key)
                unlockKeys.current.delete(e.n)
                done.push(e.n)
                if (email) applyBalance(qc, email, result.balance)
              }
            }
            toast.success(
              list.length > 1
                ? t(novel ? "unlockedManyChapters" : "unlockedMany", { count: list.length })
                : tt(novel ? "chapterUnlocked" : "episodeUnlocked", { n: list[0].n })
            )
            const n = list[0].n
            setTarget(null)
            router.push(readerHref(series, n))
          } catch (error) {
            // Not enough coins (402) or an episode that is free now (409): the balance may have changed.
            if (!DEMO_MODE && email && error instanceof ApiError) void qc.invalidateQueries({ queryKey: walletKeys.balance(email) })
            toast.error(tt("unlockFailed"))
          } finally {
            if (!DEMO_MODE && email && done.length > 0) {
              qc.setQueryData<Viewer>(meKeys.viewer(email, series.slug), (v) =>
                v ? { ...v, unlocked: [...new Set([...v.unlocked, ...done])].sort((a, b) => a - b) } : v
              )
              void qc.invalidateQueries({ queryKey: meKeys.viewer(email, series.slug) })
              void qc.invalidateQueries({ queryKey: meKeys.unlocked(email) })
            }
            setLoading(false)
          }
        }}
      />
    )
  }

  return { request, dialog, lockedFast, handOff }
}
