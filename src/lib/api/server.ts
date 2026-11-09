import { BACKEND_URL, DEMO_MODE } from "@/lib/api/config"
import { toEpisode, toRanking, toSeries, type SeriesDetail } from "@/lib/api/catalog"
import type { HeroSlideView, RankingEntry } from "@/data/selectors"
import type { Episode, Genre, Series, Weekday } from "@/data/types"
import type { HomeData } from "@/lib/api/types"
import type { Schemas } from "@/lib/api/client"
import { formatCount } from "@/lib/format"
import { genreSlug } from "@/lib/routes"

type Card = Schemas["SeriesCard"]
const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/**
 * Server-side public data fetching with Next.js revalidation tags (P5-01).
 * Calls BACKEND_URL directly on the server with cache tags for instant revalidation.
 */

async function serverGet<T>(path: string, tags: string[], revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: { Accept: "application/json" },
      next: { tags, revalidate },
    })
    if (res.status === 404) return null
    if (!res.ok) {
      console.error(`[ServerFetch] ${path} returned ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`[ServerFetch] ${path} failed:`, err)
    return null
  }
}

export async function fetchHomeServer(): Promise<HomeData> {
  if (DEMO_MODE) return (await import("@/lib/demo-api")).fetchHome()
  const feed = await serverGet<Schemas["HomeFeed"]>("/home", ["home", "catalog"], 60)
  if (!feed) {
    return {
      hero: [],
      continueReading: [],
      daily: Object.fromEntries(WEEKDAYS.map((d) => [d, []])) as unknown as Record<Weekday, Series[]>,
      rankings: { comics: [], novels: [] },
      genres: [],
      byGenre: {} as unknown as Record<Genre, Series[]>,
      novels: [],
      creatorCovers: [],
    }
  }

  const cards = (list: Card[] | undefined) => (list ?? []).map(toSeries)
  const genres = feed.genres as Genre[]
  return {
    hero: feed.hero.map(
      (h): HeroSlideView => ({ series: h.series, tag: h.tag, blurb: h.blurb, seriesData: toSeries(h.seriesData) })
    ),
    continueReading: [],
    daily: Object.fromEntries(WEEKDAYS.map((d) => [d, cards(feed.daily[d])])) as Record<Weekday, Series[]>,
    rankings: { comics: feed.rankings.comics.map(toRanking), novels: feed.rankings.novels.map(toRanking) },
    genres,
    byGenre: Object.fromEntries(genres.map((g) => [g, cards(feed.byGenre[g])])) as Record<Genre, Series[]>,
    novels: cards(feed.novels),
    creatorCovers: cards(feed.creatorCovers),
  }
}

export async function fetchSeriesServer(slug: string): Promise<SeriesDetail | null> {
  if (DEMO_MODE) return (await import("@/lib/demo-api")).fetchSeries(slug)
  const d = await serverGet<Schemas["SeriesDetail"]>(`/series/${slug}`, [`series-${slug}`, "series", "catalog"], 60)
  if (!d) return null
  return {
    series: toSeries(d.series),
    synopsis: d.synopsis,
    stats: { subscribers: formatCount(d.stats.subscribers), comments: formatCount(d.stats.comments) },
    related: d.related.map(toSeries),
    creatorSeriesCount: d.creatorSeriesCount,
    creatorId: d.creatorId,
  }
}

export async function fetchEpisodesServer(slug: string): Promise<Episode[]> {
  if (DEMO_MODE) return (await import("@/lib/demo-api")).fetchEpisodes(slug)
  const list = await serverGet<{ items: Schemas["EpisodeSummary"][] }>(`/series/${slug}/episodes?sort=oldest&limit=100`, [`episodes-${slug}`, "catalog"], 60)
  return (list?.items ?? []).map((e) => toEpisode(e, "/covers/placeholder.svg"))
}

export async function fetchRankingsServer(kind: "comics" | "novels"): Promise<RankingEntry[]> {
  if (DEMO_MODE) return (await import("@/lib/demo-api")).fetchRankings(kind)
  const list = await serverGet<{ items: Schemas["RankingEntry"][] }>(`/rankings?kind=${kind}&limit=100`, ["rankings", "catalog"], 60)
  return (list?.items ?? []).map(toRanking)
}

export async function fetchGenreServer(genre: Genre): Promise<{ genre: Genre; series: Series[] }> {
  if (DEMO_MODE) return (await import("@/lib/demo-api")).fetchGenre(genre)
  const list = await serverGet<{ items: Card[] }>(`/series?genre=${genreSlug(genre)}&sort=popular&limit=100`, [`genre-${genreSlug(genre)}`, "genres", "catalog"], 60)
  return { genre, series: (list?.items ?? []).map(toSeries) }
}


/** Every genre name in display order: the API's list, or the demo's fixed eight. */
export async function fetchGenreNamesServer(): Promise<Genre[]> {
  if (DEMO_MODE) return (await import("@/data")).genres()
  const list = await serverGet<Schemas["GenreItem"][]>("/genres", ["genres", "catalog"], 60)
  if (list?.length) return list.map((g) => g.name as Genre)
  return (await import("@/data")).genres()
}
