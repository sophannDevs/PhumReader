"use client"

import { useLocale, useTranslations } from "next-intl"
import { getSeriesById, getSeriesBySlug } from "@/data"
import { localDigits } from "@/lib/format"
import { useAppStore } from "@/lib/store"

const PAGES: Record<string, string> = {
  library: "library",
  coins: "coins",
  search: "search",
  settings: "settings",
  creator: "creator",
  notifications: "notifications",
  rankings: "rankings",
  genres: "genres",
  help: "help",
}

/**
 * Names the page the reader came from (`returnTo`, a locale-less path): "Home", "Glass Compass",
 * "Glass Compass · Ep. 12", "My library"… Unknown pages fall back to Home, like the prototype.
 */
export function usePlaceName() {
  const t = useTranslations("auth")
  const locale = useLocale()
  return (path: string | null): string => {
    const [first = "", slug = "", n = ""] = (path ?? "/").split(/[?#]/)[0].split("/").filter(Boolean)
    const series = slug ? getSeriesBySlug(slug) : undefined
    if (series && first === "series") return series.title
    if (series && /^\d+$/.test(n) && (first === "read" || first === "novel")) {
      return t(first === "novel" ? "place.chapter" : "place.episode", { title: series.title, n: localDigits(n, locale) })
    }
    const page = PAGES[first]
    return page ? t(`place.${page}` as "place.home") : t("place.home")
  }
}

/**
 * The card's context line: "Log in to unlock Ep. 66 · Glass Compass" while an unlock waits for the log in,
 * otherwise "You came from: Home". Empty until the stored state is loaded.
 */
export function useContextLine(hydrated: boolean): string {
  const t = useTranslations("auth")
  const locale = useLocale()
  const placeName = usePlaceName()
  const returnTo = useAppStore((s) => s.returnTo)
  const pending = useAppStore((s) => s.pendingUnlock)
  if (!hydrated) return ""
  const series = pending ? getSeriesById(pending.seriesId) : undefined
  if (pending && series) {
    return t(series.type === "novel" ? "unlockCh" : "unlockEp", { n: localDigits(pending.episode, locale), title: series.title })
  }
  return t("cameFrom", { place: placeName(returnTo) })
}
