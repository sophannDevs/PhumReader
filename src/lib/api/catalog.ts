import type { HeroSlideView, NovelChapter, RankingEntry } from "@/data/selectors"
import { genreSchema, type Episode, type Genre, type NovelBlock, type Series, type Weekday } from "@/data/types"
import { ApiError, api, type Schemas } from "@/lib/api/client"
import type { ChapterData, EpisodeData, HomeData, SeriesDetail } from "@/lib/api/types"
export type { SeriesDetail }
import { formatCount, formatDate } from "@/lib/format"
import { genreFromSlug, genreSlug } from "@/lib/routes"

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

/** "Every Sun", "Every Mon and Thu", "Every Mon, Wed and Fri", or "" (the data's English label; `useLocalize` translates it). */
export function scheduleOf(days: readonly Weekday[]): string {
  if (!days.length) return ""
  if (days.length === 1) return `Every ${days[0]}`
  return `Every ${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`
}

export function toSeries(c: Card): Series {
  // Every update day in week order (V21-02); `updateDay` is the first one (an older answer only had that).
  const days = WEEKDAYS.filter((d) => (c.updateDays ?? (c.updateDay ? [c.updateDay] : [])).includes(d))
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    type: c.type,
    genre: c.genre as Genre,
    creator: c.creator,
    // The creator's account and profile address (every card has them; older answers did not).
    ...(c.creatorId ? { creatorId: c.creatorId } : {}),
    ...(c.creatorHandle ? { creatorHandle: c.creatorHandle } : {}),
    cover: c.cover ?? PLACEHOLDER_COVER,
    views: formatCount(c.views),
    likes: formatCount(c.likes),
    freeEpisodes: c.freeEpisodes,
    fastPassEpisodes: c.fastPassEpisodes,
    totalEpisodes: c.totalEpisodes,
    updateDay: days[0] ?? null,
    updateDays: days,
    schedule: scheduleOf(days),
    badges: c.badges,
    // A series on hiatus shows "On break" (V21-02).
    status: c.status,
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
    // The episode's own Fast Pass price (only while it is still Fast Pass); see `episodePrice`.
    ...(e.price != null ? { price: e.price } : {}),
  }
}

/** "▲ 2", "▼ 1", "—" or "NEW" (the strings RankRow reads), from the previous place. */
export function movementOf(rank: number, previousRank: number | null | undefined): string {
  if (previousRank === null || previousRank === undefined) return "NEW"
  const diff = previousRank - rank
  return diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : "—"
}

export const toRanking = (r: Schemas["RankingEntry"]): RankingEntry => ({
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

/** The series page from the API's answer (also used by the server-side fetch in ./server.ts). */
export function toSeriesDetail(d: Schemas["SeriesDetail"]): SeriesDetail {
  const series = toSeries(d.series)
  return {
    series,
    synopsis: d.synopsis,
    stats: { subscribers: formatCount(d.stats.subscribers), comments: formatCount(d.stats.comments) },
    related: d.related.map(toSeries),
    creatorSeriesCount: d.creatorSeriesCount,
    creatorId: d.creatorId,
    creatorHandle: d.creatorHandle,
    // V21-02: the API sends the second genre as a slug; the pages show genre names ("slice-of-life" -> "Slice of life").
    secondGenre: d.secondGenre ? ((genreFromSlug(d.secondGenre, genreSchema.options) ?? d.secondGenre) as Genre) : null,
    breakMessage: series.status === "hiatus" ? (d.breakMessage ?? null) : null,
    commentsEnabled: d.commentsEnabled ?? true,
  }
}

/** null when the slug is unknown (404). */
export async function fetchSeries(slug: string): Promise<SeriesDetail | null> {
  const d = await notFoundAsNull(api.get<Schemas["SeriesDetail"]>(`/series/${slug}`))
  return d ? toSeriesDetail(d) : null
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
  return {
    series,
    episode: toEpisode(c.episode, series.cover),
    total: c.total,
    panels: c.panels,
    viewer: marksOf(c),
    // false when the episode's or the series' comments switch is off (V21-02): the reader hides the comment box.
    commentsEnabled: c.commentsEnabled,
  }
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
  return { series, chapter, total: c.total, viewer: marksOf(c), commentsEnabled: c.commentsEnabled }
}

export async function fetchRankings(kind: "comics" | "novels"): Promise<RankingEntry[]> {
  const list = await allPages<Schemas["RankingEntry"]>("/rankings", { kind })
  return list.map(toRanking)
}

export async function fetchGenre(genre: Genre): Promise<{ genre: Genre; series: Series[] }> {
  const list = await allPages<Card>("/series", { genre: genreSlug(genre), sort: "popular" })
  return { genre, series: list.map(toSeries) }
}

/** Title, creator or genre; at most `limit` (the API allows 1-20). An empty query returns the most viewed series. */
export async function search(query: string, limit = 8): Promise<Series[]> {
  const found = await api.get<Schemas["SearchResults"]>("/search", { query: { q: query.trim(), limit: Math.min(limit, 20) } })
  return found.items.map(toSeries)
}
