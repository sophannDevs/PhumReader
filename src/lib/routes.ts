import type { Series } from "@/data/types"

/** Locale-less hrefs; pass them to `Link` / `useRouter` from "@/i18n/navigation". */
export const seriesHref = (series: Pick<Series, "slug">) => `/series/${series.slug}`

/** Comics open in /read/..., web novels in /novel/... (chapter = episode number). */
export const readerHref = (series: Pick<Series, "slug" | "type">, episode: number) =>
  series.type === "novel"
    ? `/novel/${series.slug}/${episode}`
    : `/read/${series.slug}/${episode}`

/** "Slice of life" -> "slice-of-life", "Sci-fi" -> "sci-fi" (used by /genres/[genre], T43). */
export const genreSlug = (genre: string) => genre.toLowerCase().replace(/\s+/g, "-")
/** Genres page for one genre (V2.1: /genres?g=<Genre>; the V1 /genres/<slug> redirects there). */
export const genreHref = (genre: string) => `/genres?g=${encodeURIComponent(genre)}`

/** A creator's profile handle: "Dara Vann" -> "dara-vann", "Pich & Co." -> "pich-co" (V2.1 /creators/[handle]). */
export const creatorHandle = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
/** The creator's profile: the API's handle when known (real mode), else the one made from the name (demo). */
export const creatorHref = (name: string, handle?: string | null) => `/creators/${handle || creatorHandle(name)}`

/** The inverse of `genreSlug` over the demo genres ("slice-of-life" -> "Slice of life"). */
export const genreFromSlug = <G extends string>(slug: string, genres: readonly G[]): G | undefined =>
  genres.find((g) => genreSlug(g) === slug)
