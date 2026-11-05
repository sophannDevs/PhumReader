import type { Series } from "@/data/types"

/** Locale-less hrefs; pass them to `Link` / `useRouter` from "@/i18n/navigation". */
export const seriesHref = (series: Pick<Series, "slug">) => `/series/${series.slug}`

/** Comics open in /read/..., web novels in /novel/... (chapter = episode number). */
export const readerHref = (series: Pick<Series, "slug" | "type">, episode: number) =>
  series.type === "novel"
    ? `/novel/${series.slug}/${episode}`
    : `/read/${series.slug}/${episode}`
