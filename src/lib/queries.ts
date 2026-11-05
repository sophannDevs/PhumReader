"use client"

import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import type { Genre } from "@/data"
import { usePathname } from "@/i18n/navigation"
import {
  fetchChapter,
  fetchCoinsPage,
  fetchComments,
  fetchEpisode,
  fetchEpisodes,
  fetchGenre,
  fetchHome,
  fetchLibrary,
  fetchRankings,
  fetchSeries,
  getDemoFlag,
  search,
  type DemoFlag,
} from "@/lib/demo-api"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  return () => window.removeEventListener("popstate", onChange)
}

/**
 * The active ?demo= flag. It is part of every query key, so changing the flag
 * refetches (and Retry works after removing it). Re-reads on route changes.
 */
export function useDemoFlag(): DemoFlag | null {
  usePathname() // re-render on client navigations
  return useSyncExternalStore(subscribe, getDemoFlag, () => null)
}

export const useHome = () => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["home", flag], queryFn: fetchHome })
}

export const useSeries = (slug: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["series", slug, flag], queryFn: () => fetchSeries(slug) })
}

export const useEpisodes = (slug: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["episodes", slug, flag], queryFn: () => fetchEpisodes(slug) })
}

export const useEpisode = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["episode", slug, n, flag], queryFn: () => fetchEpisode(slug, n) })
}

export const useChapter = (slug: string, n: number) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["chapter", slug, n, flag], queryFn: () => fetchChapter(slug, n) })
}

export const useComments = (kind: "series" | "episode", slug: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["comments", kind, slug, flag], queryFn: () => fetchComments(kind, slug) })
}

export const useRankings = (kind: "comics" | "novels") => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["rankings", kind, flag], queryFn: () => fetchRankings(kind) })
}

export const useGenre = (genre: Genre) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["genre", genre, flag], queryFn: () => fetchGenre(genre) })
}

export const useSearchSeries = (query: string) => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["search", query.trim().toLowerCase(), flag], queryFn: () => search(query) })
}

export const useCoinsPage = () => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["coins-page", flag], queryFn: fetchCoinsPage })
}

export const useLibrary = () => {
  const flag = useDemoFlag()
  return useQuery({ queryKey: ["library", flag], queryFn: fetchLibrary })
}
