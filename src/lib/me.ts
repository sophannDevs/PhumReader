"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "@/i18n/translations"
import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import type { ContinueView } from "@/data/selectors"
import type { Series } from "@/data/types"
import { usePathname } from "@/i18n/navigation"
import { DEMO_MODE } from "@/lib/api/config"
import { ApiError } from "@/lib/api/client"
import * as real from "@/lib/api/me"
import { formatCount, parseCount } from "@/lib/format"
import { useDemoFlag } from "@/lib/queries"
import { likeKey, useAppStore, useHydrated, useUser } from "@/lib/store"

/**
 * What the signed-in reader did: subscriptions, follows, likes, bookmarks, reading progress and
 * unlocks. Each hook reads and writes the demo's store in demo mode (`NEXT_PUBLIC_DEMO=1`) and
 * the real API otherwise, with the same result shape, so the components do not care which.
 * Query keys carry the account's email, so one account never sees another's cached data.
 */

import { meKeys } from "@/lib/api/keys"
export { meKeys }

/** The signed-in account's email once the stored state is loaded; undefined when logged out. */
export function useAccountEmail(): string | undefined {
  const user = useUser()
  const hydrated = useHydrated()
  return hydrated ? user?.email : undefined
}

/** Tells a logged-out reader to log in, and remembers where they were. */
export function useAskToLogin() {
  const tt = useTranslations("toasts")
  const pathname = usePathname()
  return useCallback(() => {
    useAppStore.getState().setReturnTo(`${pathname}${window.location.search}`)
    toast.success(tt("loginRequired"))
  }, [pathname, tt])
}

/** A failed write: 401 is handled by the session code; anything else gets one message. */
export function useFailed() {
  const tt = useTranslations("toasts")
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) return
      toast.error(tt("actionFailed"))
    },
    [tt]
  )
}

// ---------------------------------------------------------------- the reader in one series

export type SeriesViewer = {
  /** Highest episode opened (0 = none). */
  lastRead: number
  /** Episode numbers unlocked with coins; undefined = none known. */
  unlocked: number[] | undefined
  followingCreator: boolean
}

/** The reader's reading marks in this series (read marks, unlocks, follow). */
export function useSeriesViewer(series: Pick<Series, "id" | "slug" | "creator">): SeriesViewer {
  const email = useAccountEmail()
  const storeLastRead = useAppStore((s) => s.lastRead[series.id] ?? 0)
  const storeUnlocked = useAppStore((s) => s.unlocked[series.id])
  const storeFollowing = useAppStore((s) => s.follows.includes(series.creator))
  const query = useQuery({
    queryKey: meKeys.viewer(email ?? "", series.slug),
    queryFn: () => real.fetchViewer(series.slug),
    enabled: !DEMO_MODE && !!email,
  })
  if (DEMO_MODE) return { lastRead: storeLastRead, unlocked: storeUnlocked, followingCreator: storeFollowing }
  const v = email ? query.data : undefined
  return { lastRead: v?.lastRead ?? 0, unlocked: v?.unlocked, followingCreator: v?.followingCreator ?? false }
}

/** Series the reader subscribed to, most recent first (real API; the Library's Subscribed tab). */
export function useSubscriptions() {
  const email = useAccountEmail()
  return useQuery({
    queryKey: meKeys.subscriptions(email ?? ""),
    queryFn: real.fetchSubscriptions,
    enabled: !DEMO_MODE && !!email,
  })
}

/** Creators the reader follows (real API, GET /me/follows): their account ids and names. */
export function useFollowedCreators() {
  const email = useAccountEmail()
  return useQuery({
    queryKey: meKeys.follows(email ?? ""),
    queryFn: real.fetchFollows,
    enabled: !DEMO_MODE && !!email,
  })
}

/** Subscribe / unsubscribe, with the toast. */
export function useSubscribe(series: Series) {
  const tt = useTranslations("toasts")
  const email = useAccountEmail()
  const qc = useQueryClient()
  const askToLogin = useAskToLogin()
  const failed = useFailed()
  const stored = useAppStore((s) => s.subscriptions.includes(series.id))
  const list = useSubscriptions().data
  const subscribed = DEMO_MODE ? stored : !!email && !!list?.some((s) => s.id === series.id)

  async function toggle() {
    const next = !subscribed
    const say = () => toast.success(next ? tt("subscribed", { title: series.title }) : tt("unsubscribed"))
    if (DEMO_MODE) {
      useAppStore.getState().toggleSubscription(series.id)
      say()
      return
    }
    if (!email) return askToLogin()
    const key = meKeys.subscriptions(email)
    await qc.cancelQueries({ queryKey: key })
    const before = qc.getQueryData<Series[]>(key)
    if (before) {
      qc.setQueryData<Series[]>(key, next ? [series, ...before.filter((s) => s.id !== series.id)] : before.filter((s) => s.id !== series.id))
    }
    try {
      await real.putSubscription(series.slug, next)
      say()
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    } finally {
      void qc.invalidateQueries({ queryKey: key })
    }
  }

  return { subscribed, toggle }
}

/** Follow / unfollow the creator of a series, with the toast. `creatorId` comes with the real API's series page. */
export function useFollow(series: Pick<Series, "id" | "slug" | "creator">, creatorId: string | undefined) {
  const tt = useTranslations("toasts")
  const email = useAccountEmail()
  const qc = useQueryClient()
  const askToLogin = useAskToLogin()
  const failed = useFailed()
  const following = useSeriesViewer(series).followingCreator

  async function toggle() {
    const next = !following
    const say = () => toast.success(tt(next ? "followed" : "unfollowed", { name: series.creator }))
    if (DEMO_MODE) {
      useAppStore.getState().toggleFollow(series.creator)
      say()
      return
    }
    if (!email) return askToLogin()
    if (!creatorId) return
    const key = meKeys.viewer(email, series.slug)
    await qc.cancelQueries({ queryKey: key })
    const before = qc.getQueryData<real.Viewer>(key)
    qc.setQueryData<real.Viewer>(key, { ...(before ?? real.NO_VIEWER), followingCreator: next })
    try {
      await real.putFollow(creatorId, next)
      say()
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    } finally {
      void qc.invalidateQueries({ queryKey: key })
      // The reader's follows list (search's Follow buttons read it).
      void qc.invalidateQueries({ queryKey: meKeys.follows(email) })
    }
  }

  return { following, toggle }
}

// ---------------------------------------------------------------- likes and bookmarks

type Marks = { liked: boolean; bookmarked: boolean }
type Kind = "comic" | "novel"

/**
 * Like and bookmark of one episode (comic) or chapter (novel). In the real API the reader's
 * marks come with the episode itself (`viewer`) and the like count already includes their like;
 * both live in the cached episode, which the toggles update.
 */
export function useEpisodeReactions({ series, n, kind, likes }: { series: Series; n: number; kind: Kind; likes: string }) {
  const tt = useTranslations("toasts")
  const email = useAccountEmail()
  const qc = useQueryClient()
  const askToLogin = useAskToLogin()
  const failed = useFailed()
  const likedKey = likeKey.episode(series.id, n)
  const markKey = likeKey.bookmark(series.id, n)
  const storeLiked = useAppStore((s) => !!s.likes[likedKey])
  const storeMarked = useAppStore((s) => !!s.likes[markKey])
  const flag = useDemoFlag()
  const cacheKey = [kind === "novel" ? "chapter" : "episode", series.slug, n] as const
  const marks = useQuery<{ viewer?: Marks } | null>({
    queryKey: [...cacheKey, flag],
    // Always cached by the page that shows the episode; never fetched from here.
    queryFn: () => Promise.reject(new Error("not cached")),
    enabled: false,
  }).data?.viewer

  const liked = DEMO_MODE ? storeLiked : !!email && !!marks?.liked
  const bookmarked = DEMO_MODE ? storeMarked : !!email && !!marks?.bookmarked
  // The demo adds the reader's like to the shown total; the API's total already has it.
  const likeCount = parseCount(likes) + (DEMO_MODE && liked ? 1 : 0)

  /** Writes the new marks (and like total) into the cached episode. */
  function patch(next: Partial<Marks>, total?: number) {
    qc.setQueriesData<{ viewer?: Marks; episode?: { likes: string }; chapter?: { likes: string } }>({ queryKey: cacheKey }, (d) => {
      if (!d) return d
      const viewer = { liked: false, bookmarked: false, ...d.viewer, ...next }
      if (total === undefined) return { ...d, viewer }
      const count = formatCount(total)
      return kind === "novel" ? { ...d, viewer, chapter: d.chapter && { ...d.chapter, likes: count } } : { ...d, viewer, episode: d.episode && { ...d.episode, likes: count } }
    })
  }

  async function toggleLike() {
    if (DEMO_MODE) return useAppStore.getState().toggleLike(likedKey)
    if (!email) return askToLogin()
    const next = !liked
    patch({ liked: next }, Math.max(0, likeCount + (next ? 1 : -1)))
    try {
      const state = await real.putEpisodeLike(series.slug, n, next)
      patch({ liked: state.liked }, state.likes)
    } catch (error) {
      patch({ liked: !next }, likeCount)
      failed(error)
    }
  }

  async function toggleBookmark() {
    const next = !bookmarked
    const say = () => toast.success(tt(next ? "bookmarked" : "bookmarkRemoved"))
    if (DEMO_MODE) {
      useAppStore.getState().toggleLike(markKey)
      return say()
    }
    if (!email) return askToLogin()
    patch({ bookmarked: next })
    try {
      await real.putBookmark(series.slug, n, next)
      say()
    } catch (error) {
      patch({ bookmarked: !next })
      failed(error)
    }
  }

  return { liked, bookmarked, likeCount, toggleLike, toggleBookmark }
}

// ---------------------------------------------------------------- reading progress

/**
 * Records that the reader opened an episode (demo: the "read" mark; real API: Continue reading
 * and the read marks), and `finishRef` for the end of the episode: once it scrolls into view the
 * episode counts as 100% read.
 */
export function useRecordReading(series: Series, n: number, active: boolean) {
  const email = useAccountEmail()
  const qc = useQueryClient()
  const finished = useRef(false)
  // Saves go out one after another: on a short chapter the "opened" (0) and "finished" (1) saves
  // fire together, and the 0 must never reach the server after the 1.
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const record = useCallback(
    async (progress: number) => {
      if (!email) return
      const previous = queue.current
      const save = previous.then(() => real.saveProgress(series.slug, n, progress))
      queue.current = save.catch(() => undefined)
      try {
        await save
      } catch {
        return // Reading must never be interrupted by a failed bookmark of the place.
      }
      qc.setQueryData<real.Viewer>(meKeys.viewer(email, series.slug), (v) => v && { ...v, lastRead: Math.max(v.lastRead, n) })
      void qc.invalidateQueries({ queryKey: meKeys.history(email) })
    },
    [email, qc, series.slug, n]
  )

  // The account can become known after the page opens (hydration): record each opening once.
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!active) return
    if (DEMO_MODE) return useAppStore.getState().markRead(series.id, n)
    const id = `${email}:${series.slug}:${n}`
    if (!email || opened.current === id) return
    opened.current = id
    finished.current = false
    void record(0)
  }, [active, email, record, series.id, series.slug, n])

  const observer = useRef<IntersectionObserver | null>(null)
  const finishRef = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect()
      observer.current = null
      if (!el || DEMO_MODE || !active) return
      observer.current = new IntersectionObserver((entries) => {
        if (finished.current || !entries.some((e) => e.isIntersecting)) return
        finished.current = true
        void record(1)
      })
      observer.current.observe(el)
    },
    [active, record]
  )
  return { finishRef }
}

// ---------------------------------------------------------------- Continue reading on Home

/** The Home page's Continue reading: the demo's entries, or the reader's own history (real API). */
export function useContinueEntries(demoEntries: ContinueView[]): ContinueView[] {
  const email = useAccountEmail()
  const history = useQuery({
    queryKey: meKeys.history(email ?? ""),
    queryFn: real.fetchHistory,
    enabled: !DEMO_MODE && !!email,
  })
  if (DEMO_MODE) return demoEntries
  return email ? (history.data ?? []).slice(0, 4) : []
}
