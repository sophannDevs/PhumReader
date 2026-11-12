"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import type { Genre } from "@/data"
import { usePathname } from "@/i18n/navigation"
import { catalogKeys, commentsKeys, creatorKeys, walletKeys } from "@/lib/api/keys"
import * as real from "@/lib/api/catalog"
import * as realAccount from "@/lib/api/account"
import * as realCoins from "@/lib/api/coins"
import { DEMO_MODE } from "@/lib/api/config"
import { getDemoFlag, type DemoFlag } from "@/lib/demo-flags"
import { useHydrated, useUser } from "@/lib/store"

const getDemo = () => import("@/lib/demo-api")

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

/**
 * The active ?demo= flag. It is part of every query key, so changing the flag
 * refetches (and Retry works after removing it). Re-reads on route changes.
 * The real API ignores the flags.
 */
export function useDemoFlag(): DemoFlag | null {
  usePathname() // re-render on client navigations
  return useSyncExternalStore(subscribe, getDemoFlag, () => null)
}

export const useHome = () => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.home(flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchHome()) : real.fetchHome()),
  })
}

export const useSeries = (slug: string, enabled = true) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.series(slug, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchSeries(slug)) : real.fetchSeries(slug)),
    enabled,
  })
}

export const useEpisodes = (slug: string) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.episodes(slug, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchEpisodes(slug)) : real.fetchEpisodes(slug)),
  })
}

export const useEpisode = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.episode(slug, n, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchEpisode(slug, n)) : real.fetchEpisode(slug, n)),
  })
}

export const useChapter = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.chapter(slug, n, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchChapter(slug, n)) : real.fetchChapter(slug, n)),
  })
}

export const useComments = (kind: "series" | "episode", slug: string) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: commentsKeys.thread(kind, slug, flag),
    queryFn: () => getDemo().then((m) => m.fetchComments(kind, slug)),
    enabled: DEMO_MODE,
  })
}

export const useRankings = (kind: "comics" | "novels") => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.rankings(kind, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchRankings(kind)) : real.fetchRankings(kind)),
  })
}

export const useGenre = (genre: Genre) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.genre(genre, flag),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.fetchGenre(genre)) : real.fetchGenre(genre)),
  })
}

/**
 * `limit` defaults to 8 (the API allows up to 20). `enabled` (default true) holds the request back; `keepPrevious`
 * keeps the last results on screen while the next query loads (the ⌘K search).
 */
export const useSearchSeries = (query: string, limit = 8, opts: { enabled?: boolean; keepPrevious?: boolean } = {}) => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: catalogKeys.search(query, flag, limit),
    queryFn: () => (DEMO_MODE ? getDemo().then((m) => m.search(query, limit)) : real.search(query, limit)),
    enabled: opts.enabled ?? true,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
  })
}

/** The Coins page: the demo's, or the API's packs plus the reader's own purchase history. */
export const useCoinsPage = () => {
  const flag = useDemoFlag()
  const user = useUser()
  const hydrated = useHydrated()
  const email = hydrated ? user?.email : undefined
  const demoQuery = useQuery({
    queryKey: walletKeys.coinsPage(undefined, flag),
    queryFn: () => getDemo().then((m) => m.fetchCoinsPage()),
    enabled: DEMO_MODE,
  })
  const realQuery = useQuery({
    queryKey: ["coins-page", "real", email ?? ""],
    queryFn: () => realCoins.fetchCoinsPage(!!email),
    enabled: !DEMO_MODE && hydrated,
  })
  return DEMO_MODE ? demoQuery : realQuery
}

export const useLibrary = () => {
  const flag = useDemoFlag()
  return useQuery({
    queryKey: ["library", flag],
    queryFn: () => getDemo().then((m) => m.fetchLibrary()),
    enabled: DEMO_MODE,
  })
}

/** The creator dashboard: the demo's stand-in creator, or the signed-in account's own series. */
export const useCreator = () => {
  const flag = useDemoFlag()
  const user = useUser()
  const hydrated = useHydrated()
  const email = hydrated ? user?.email : undefined
  const demoQuery = useQuery({
    queryKey: creatorKeys.dashboard(undefined, flag),
    queryFn: () => getDemo().then((m) => m.fetchCreator()),
    enabled: DEMO_MODE,
  })
  const realQuery = useQuery({
    queryKey: ["creator", "real", email ?? ""],
    queryFn: realAccount.fetchCreator,
    enabled: !DEMO_MODE && !!email,
  })
  return DEMO_MODE ? demoQuery : realQuery
}
