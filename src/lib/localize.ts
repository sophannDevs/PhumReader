"use client"

import { useLocale, useTranslations } from "next-intl"
import type { Genre } from "@/data"
import { formatDate } from "@/lib/format"

/**
 * Demo content stays English (titles, synopses, comments), but the labels the
 * data carries that are really UI chrome (genre names, "Every Sun", "Episode 12",
 * dates, payment methods, FAQ) are shown in the current language.
 */
export function useLocalize() {
  const t = useTranslations("data")
  const locale = useLocale()
  const has = (key: string) => t.has(key as never)

  return {
    genre: (g: Genre | string) => (has(`genres.${g}`) ? t(`genres.${g}` as never) : g),
    schedule: (s: string) => {
      const m = /^Every (\w{3})$/.exec(s)
      return m && has(`every.${m[1]}`) ? t(`every.${m[1]}` as never) : s
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
  }
}
