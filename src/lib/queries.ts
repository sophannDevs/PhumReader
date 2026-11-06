"use client"

import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import type { Genre } from "@/data"
import { usePathname } from "@/i18n/navigation"
import * as real from "@/lib/api/catalog"
import * as realAccount from "@/lib/api/account"
import * as realCoins from "@/lib/api/coins"
import { DEMO_MODE } from "@/lib/api/config"
import * as demo from "@/lib/demo-api"
import { getDemoFlag, type DemoFlag } from "@/lib/demo-api"
import { useHydrated, useUser } from "@/lib/store"

/**
 * The catalog pages read the demo (`NEXT_PUBLIC_DEMO=1`) or the real API; both give the same
 * shapes. Comments, the coins page, the library and the creator dashboard are still the demo
 * until their part of Stage 1 Step 5.
 */
type Catalog = Pick<
  typeof demo,
  "fetchHome" | "fetchSeries" | "fetchEpisodes" | "fetchEpisode" | "fetchChapter" | "fetchRankings" | "fetchGenre" | "search"
>
const catalog: Catalog = DEMO_MODE ? demo : real

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
  return useQuery({ queryKey: ["home", flag], queryFn: catalog.fetchHome })
}

export const useSeries = (slug: string, enabled = true) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["series", slug, flag], queryFn: () => catalog.fetchSeries(slug), enabled })
}

export const useEpisodes = (slug: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["episodes", slug, flag], queryFn: () => catalog.fetchEpisodes(slug) })
}

export const useEpisode = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["episode", slug, n, flag], queryFn: () => catalog.fetchEpisode(slug, n) })
}

export const useChapter = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["chapter", slug, n, flag], queryFn: () => catalog.fetchChapter(slug, n) })
}

export const useComments = (kind: "series" | "episode", slug: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["comments", kind, slug, flag], queryFn: () => demo.fetchComments(kind, slug), enabled: DEMO_MODE })
}

export const useRankings = (kind: "comics" | "novels") => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["rankings", kind, flag], queryFn: () => catalog.fetchRankings(kind) })
}

export const useGenre = (genre: Genre) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["genre", genre, flag], queryFn: () => catalog.fetchGenre(genre) })
}

export const useSearchSeries = (query: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["search", query.trim().toLowerCase(), flag], queryFn: () => catalog.search(query) })
}

/** The Coins page: the demo's, or the API's packs plus the reader's own purchase history. */
export const useCoinsPage = () => {
  const flag = useDemoFlag()
  const user = useUser()
  const hydrated = useHydrated()
  const email = hydrated ? user?.email : undefined
  const demoQuery = useQuery({ queryKey: ["coins-page", flag], queryFn: demo.fetchCoinsPage, enabled: DEMO_MODE })
  const realQuery = useQuery({
    queryKey: ["coins-page", "real", email ?? ""],
    queryFn: () => realCoins.fetchCoinsPage(!!email),
    enabled: !DEMO_MODE && hydrated,
  })
  return DEMO_MODE ? demoQuery : realQuery
}

export const useLibrary = () => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["library", flag], queryFn: demo.fetchLibrary, enabled: DEMO_MODE })
}

/** The creator dashboard: the demo's stand-in creator, or the signed-in account's own series. */
export const useCreator = () => {
  const flag = useDemoFlag()
  const user = useUser()
  const hydrated = useHydrated()
  const email = hydrated ? user?.email : undefined
  const demoQuery = useQuery({ queryKey: ["creator", flag], queryFn: demo.fetchCreator, enabled: DEMO_MODE })
  const realQuery = useQuery({
    queryKey: ["creator", "real", email ?? ""],
    queryFn: realAccount.fetchCreator,
    enabled: !DEMO_MODE && !!email,
  })
  return DEMO_MODE ? demoQuery : realQuery
}
