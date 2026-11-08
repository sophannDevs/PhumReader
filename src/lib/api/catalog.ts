import type { HeroSlideView, NovelChapter, RankingEntry } from "@/data/selectors"
import type { Episode, Genre, NovelBlock, Series, Weekday } from "@/data/types"
import { ApiError, api, type Schemas } from "@/lib/api/client"
import type { ChapterData, EpisodeData, HomeData, SeriesDetail } from "@/lib/demo-api"
import { formatCount, formatDate } from "@/lib/format"
import { genreSlug } from "@/lib/routes"

/**
 * The catalog from the real API (Stage 1 Step 5 part 2), in the shapes the pages already use
 * (the demo's types). The API sends raw values (counts as numbers, days as ISO dates, ranking
 * movement as the previous rank); this file turns them into the demo's English strings, and
 * `useLocalize` turns those into Khmer as it always did.
 */

type Card = Schemas["SeriesCard"]
type Summary = Schemas["EpisodeSummary"]

/** The API's largest page; lists the pages show whole are fetched page by page. */
const PAGE = 100
const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Shown while a series has no cover yet (uploads come with P3-07). */
export const PLACEHOLDER_COVER = "/covers/placeholder.svg"

// ---------------------------------------------------------------- mapping

export function toSeries(c: Card): Series {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    type: c.type,
    genre: c.genre as Genre,
    creator: c.creator,
    cover: c.cover ?? PLACEHOLDER_COVER,
    views: formatCount(c.views),
    likes: formatCount(c.likes),
    freeEpisodes: c.freeEpisodes,
    fastPassEpisodes: c.fastPassEpisodes,
    totalEpisodes: c.totalEpisodes,
    updateDay: c.updateDay ?? null,
    schedule: c.updateDay ? `Every ${c.updateDay}` : "",
    badges: c.badges,
    // The pages know "ongoing" and "completed"; a series on hiatus is still ongoing.
    status: c.status === "completed" ? "completed" : "ongoing",
    language: c.language as Series["language"],
    ageRating: c.ageRating,
  }
}

export function toEpisode(e: Summary, fallbackThumb: string): Episode {
  return {
    n: e.n,
    title: e.title,
    date: formatDate(e.date),
    likes: formatCount(e.likes),
    thumb: e.thumb ?? fallbackThumb,
    access: e.access,
    isUp: e.isUp,
  }
}

/** "▲ 2", "▼ 1", "—" or "NEW" (the strings RankRow reads), from the previous place. */
export function movementOf(rank: number, previousRank: number | null | undefined): string {
  if (previousRank === null || previousRank === undefined) return "NEW"
  const diff = previousRank - rank
  return diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : "—"
}

const toRanking = (r: Schemas["RankingEntry"]): RankingEntry => ({
  rank: r.rank,
  series: toSeries(r.series),
  movement: movementOf(r.rank, r.previousRank),
})

const toBlock = (b: Schemas["NovelBlock"]): NovelBlock =>
  b.type === "scene-break" ? { type: "scene-break" } : { type: b.type, text: b.text ?? "" }

// ---------------------------------------------------------------- helpers

export async function notFoundAsNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Every item of a cursor-paged list. */
export async function allPages<T>(path: string, query: Record<string, string>): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null | undefined
  do {
    const page = await api.get<{ items: T[]; nextCursor?: string | null }>(path, {
      query: { ...query, limit: PAGE, cursor },
    })
    items.push(...page.items)
    cursor = page.nextCursor
  } while (cursor)
  return items
}

const marksOf = (c: Schemas["EpisodeContent"]) => ({ liked: c.viewer.liked, bookmarked: c.viewer.bookmarked })

// ---------------------------------------------------------------- reads

export async function fetchHome(): Promise<HomeData> {
  const feed = await api.get<Schemas["HomeFeed"]>("/home")
  const cards = (list: Card[] | undefined) => (list ?? []).map(toSeries)
  const genres = feed.genres as Genre[]
  return {
    hero: feed.hero.map(
      (h): HeroSlideView => ({ series: h.series, tag: h.tag, blurb: h.blurb, seriesData: toSeries(h.seriesData) })
    ),
    // The reader's own Continue reading comes from /me/history (src/lib/me.ts).
    continueReading: [],
    daily: Object.fromEntries(WEEKDAYS.map((d) => [d, cards(feed.daily[d])])) as Record<Weekday, Series[]>,
    rankings: { comics: feed.rankings.comics.map(toRanking), novels: feed.rankings.novels.map(toRanking) },
    genres,
    byGenre: Object.fromEntries(genres.map((g) => [g, cards(feed.byGenre[g])])) as Record<Genre, Series[]>,
    novels: cards(feed.novels),
    creatorCovers: cards(feed.creatorCovers),
  }
}

/** null when the slug is unknown (404). */
export async function fetchSeries(slug: string): Promise<SeriesDetail | null> {
  const d = await notFoundAsNull(api.get<Schemas["SeriesDetail"]>(`/series/${slug}`))
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

/** Every released episode, oldest first. */
export async function fetchEpisodes(slug: string): Promise<Episode[]> {
  const list = await allPages<Summary>(`/series/${slug}/episodes`, { sort: "oldest" })
  return list.map((e) => toEpisode(e, PLACEHOLDER_COVER))
}

/** null when the series or episode does not exist; a locked episode throws 402 `episode_locked`. */
export async function fetchEpisode(slug: string, n: number): Promise<EpisodeData | null> {
  const c = await notFoundAsNull(api.get<Schemas["EpisodeContent"]>(`/series/${slug}/episodes/${n}`))
  if (!c) return null
  const series = toSeries(c.series)
  return { series, episode: toEpisode(c.episode, series.cover), total: c.total, panels: c.panels, viewer: marksOf(c) }
}

export async function fetchChapter(slug: string, n: number): Promise<ChapterData | null> {
  const c = await notFoundAsNull(api.get<Schemas["EpisodeContent"]>(`/series/${slug}/episodes/${n}`))
  if (!c) return null
  const series = toSeries(c.series)
  const episode = toEpisode(c.episode, series.cover)
  const chapter: NovelChapter = {
    n: episode.n,
    title: episode.title,
    name: episode.title.replace(/^Chapter \d+:\s*/, ""),
    date: episode.date,
    blocks: c.blocks.map(toBlock),
    creatorNote: c.creatorNote ?? "",
    likes: episode.likes,
  }
  return { series, chapter, total: c.total, viewer: marksOf(c) }
}

export async function fetchRankings(kind: "comics" | "novels"): Promise<RankingEntry[]> {
  const list = await allPages<Schemas["RankingEntry"]>("/rankings", { kind })
  return list.map(toRanking)
}

export async function fetchGenre(genre: Genre): Promise<{ genre: Genre; series: Series[] }> {
  const list = await allPages<Card>("/series", { genre: genreSlug(genre), sort: "popular" })
  return { genre, series: list.map(toSeries) }
}

/** Title, creator or genre; at most 8. An empty query returns the most viewed series. */
export async function search(query: string): Promise<Series[]> {
  const found = await api.get<Schemas["SearchResults"]>("/search", { query: { q: query.trim(), limit: 8 } })
  return found.items.map(toSeries)
}
