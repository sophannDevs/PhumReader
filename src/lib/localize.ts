"use client"

import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import type { Genre, Series, Weekday } from "@/data"
import { seriesHooks } from "@/data/hooks"
import { formatDate } from "@/lib/format"

/**
 * Demo content stays English (titles, synopses, comments), but the labels the
 * data carries that are really UI chrome (genre names, "Every Sun" / "Every Mon and Thu", "Episode 12",
 * dates, payment methods, FAQ) are shown in the current language.
 */
export function useLocalize() {
  const t = useTranslations("data")
  const locale = useLocale()
  const has = (key: string) => t.has(key as never)

  /**
   * Update days as a list: "Mon and Thu" (short) or "Monday and Thursday" (full); Khmer uses the full names in both
   * ("ថ្ងៃច័ន្ទ និងថ្ងៃព្រហស្បតិ៍"), as its short names are the one- or two-letter day chips. Week order, as the API and
   * the forms keep them.
   */
  const days = (list: readonly Weekday[], style: "short" | "full" = "full") => {
    const short = style === "short" && locale !== "km"
    const names = list.map((d) => t(`${short ? "dayShort" : "dayFull"}.${d}` as never))
    if (names.length < 2) return names[0] ?? ""
    return t("listAnd", { a: names.slice(0, -1).join(", "), b: names[names.length - 1] })
  }

  return {
    genre: (g: Genre | string) => (has(`genres.${g}`) ? t(`genres.${g}` as never) : g),
    days,
    /** "Every Sun" or "Every Mon and Thu" (V21-02: several update days); "" without a schedule. */
    schedule: (s: Pick<Series, "schedule" | "updateDays">) => {
      if (s.updateDays.length > 1) return t("everyDays", { days: days(s.updateDays, "short") })
      const m = /^Every (\w{3})$/.exec(s.schedule)
      return m && has(`every.${m[1]}`) ? t(`every.${m[1]}` as never) : s.schedule
    },
    tag: (s: string) => (has(`tags.${s}`) ? t(`tags.${s}` as never) : s),
    /** "Episode 12", "(S2) Episode 80" and "Chapter 3: Name" (the name stays English). */
    title: (s: string) => {
      let m = /^\(S2\) Episode (\d+)$/.exec(s)
      if (m) return t("episodeS2", { n: m[1] })
      m = /^Episode (\d+)$/.exec(s)
      if (m) return t("episode", { n: m[1] })
      const c = /^Chapter (\d+): (.*)$/.exec(s)
      return c ? `${t("chapter", { n: c[1] })}: ${c[2]}` : s
    },
    /** "Nov 26, 2026" -> the locale's date. */
    date: (s: string) => {
      if (locale === "en") return s
      const ms = Date.parse(`${s} UTC`)
      return Number.isNaN(ms) ? s : formatDate(new Date(ms).toISOString().slice(0, 10), locale)
    },
    pack: (s: string) => {
      const m = /^(\d+) coin pack$/.exec(s)
      return m ? t("coinPack", { count: m[1] }) : s
    },
    method: (id: string, fallback: { label: string; desc: string }) =>
      has(`methods.${id}.label`)
        ? { label: t(`methods.${id}.label` as never), desc: t(`methods.${id}.desc` as never) }
        : fallback,
    faq: (i: number, fallback: { q: string; a: string }) =>
      has(`faq.${i}.q`) ? { q: t(`faq.${i}.q` as never), a: t(`faq.${i}.a` as never) } : fallback,
    /** One-line hook (src/data/hooks.ts), or "An ongoing drama story, new every Monday." (or "Monday and Thursday") */
    hook: (s: Pick<Series, "title" | "genre" | "updateDays">) =>
      seriesHooks[s.title] ??
      t("hookFallback", {
        genre: (has(`genres.${s.genre}`) ? t(`genres.${s.genre}` as never) : s.genre).toLowerCase(),
        day: days(s.updateDays, "full"),
      }),
  }
}
