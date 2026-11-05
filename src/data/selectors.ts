import { addDays, formatCount, formatDate, parseCount, today, weekdayOf } from "@/lib/format"
import { demoData } from "./demo"
import type {
  CoinPack,
  Comment,
  ContinueEntry,
  Episode,
  FaqItem,
  Genre,
  HeroSlide,
  NovelBlock,
  Panel,
  PaymentMethod,
  Purchase,
  Series,
  Weekday,
} from "./types"

/** Typed selectors over demo-data.json. Pages never read `demoData` directly (T17: only demo-api does). */

// ---------- series ----------
export const getSeries = (): Series[] => demoData.series
export const getSeriesBySlug = (slug: string): Series | undefined =>
  demoData.series.find((s) => s.slug === slug)
export const getSeriesById = (id: string): Series | undefined => demoData.series.find((s) => s.id === id)
export const seriesByGenre = (genre: Genre): Series[] => demoData.series.filter((s) => s.genre === genre)
export const seriesByDay = (day: Weekday): Series[] => demoData.series.filter((s) => s.updateDay === day)
export const novels = (): Series[] => demoData.series.filter((s) => s.type === "novel")
export const genres = (): Genre[] => demoData.genres

/** Daily updates grid: that day's series, topped up with UP series when fewer than `count`. */
export function dailyUpdates(day: Weekday, count = 6): Series[] {
  const base = seriesByDay(day)
  if (base.length >= count) return base.slice(0, count)
  const fill = demoData.series.filter((s) => s.badges.up && !base.includes(s))
  return [...base, ...fill].slice(0, count)
}

/** Up to `count` other series in the same genre (data order). */
export const relatedSeries = (series: Series, count = 4): Series[] =>
  demoData.series.filter((s) => s.genre === series.genre && s.id !== series.id).slice(0, count)

export const creatorSeriesCount = (creator: string): number =>
  demoData.series.filter((s) => s.creator === creator).length

export const synopsisFor = (series: Series): string => demoData.synopsisByGenre[series.genre]

// ---------- home ----------
export type HeroSlideView = HeroSlide & { seriesData: Series }
export function heroSlides(): HeroSlideView[] {
  return demoData.homeHero.flatMap((h) => {
    const seriesData = getSeriesBySlug(h.series)
    return seriesData ? [{ ...h, seriesData }] : []
  })
}

export type ContinueView = ContinueEntry & { seriesData: Series }
export function continueReading(): ContinueView[] {
  return demoData.continueReading.flatMap((c) => {
    const seriesData = getSeriesBySlug(c.series)
    return seriesData ? [{ ...c, seriesData }] : []
  })
}

export type RankingEntry = { rank: number; series: Series; movement: string }

/**
 * Comics: the 8 series on the Home screen first (with `rankingMovement`), then the
 * remaining comics by views. Web novels: all novels by views, the first 7 with
 * movement. Order per Assumptions 4 in docs/CHECKLIST.md.
 */
const HOME_COMICS = [
  "Paper Tigers",
  "Neon Monsoon",
  "Tiny Dragon Café",
  "The Orchard Pact",
  "Summer Index",
  "Ember & Co.",
  "Captain Nobody",
  "Salt & Thunder",
]
export function rankings(kind: "comics" | "novels"): RankingEntry[] {
  const byViews = (a: Series, b: Series) => parseCount(b.views) - parseCount(a.views)
  let ordered: Series[]
  if (kind === "novels") {
    ordered = novels().sort(byViews)
  } else {
    const comics = demoData.series.filter((s) => s.type === "comic")
    const top = HOME_COMICS.flatMap((t) => comics.filter((s) => s.title === t))
    ordered = [...top, ...comics.filter((s) => !top.includes(s)).sort(byViews)]
  }
  return ordered.map((series, i) => ({
    rank: i + 1,
    series,
    movement: demoData.rankingMovement[i] ?? "—",
  }))
}

// ---------- episodes ----------
const sampleCycle = demoData.episodesSample["glass-compass"].map((e) => e.thumb)

/** Small deterministic hash so generated numbers are stable per series. */
function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

const likesText = (thousands: number) => formatCount(Math.round(thousands * 10) * 100)

function generateEpisodes(series: Series): Episode[] {
  const { freeEpisodes: free, fastPassEpisodes, type, id } = series
  const base = 40 + (hash(id) % 100) / 10 // 40.0K - 49.9K for the first episodes
  const episodes: Episode[] = []
  for (let n = 1; n <= free + fastPassEpisodes; n++) {
    const isFast = n > free
    const date = isFast ? addDays(today, 7 * (n - free)) : addDays(today, -7 * (free - n))
    const group = Math.floor((n - 1) / 5)
    const step = (n - 1) % 5
    const likes = isFast ? base * 0.48 + 0.8 * (n - free - 1) : base + 0.1 * group + 0.825 * step
    const name = demoData.chapterNames[n % demoData.chapterNames.length]
    const title =
      type === "novel" ? `Chapter ${n}: ${name}` : n >= 80 ? `(S2) Episode ${n}` : `Episode ${n}`
    episodes.push({
      n,
      title,
      date: formatDate(date),
      likes: likesText(likes),
      thumb: sampleCycle[(n - 1) % sampleCycle.length],
      access: isFast ? "fastpass" : "free",
      isUp: n === free,
    })
  }
  return episodes
}

const episodeCache = new Map<string, Episode[]>()
/** Full list, oldest first. Hand-written samples win; other series are generated from `episodeRule`. */
export function episodesFor(slug: string): Episode[] {
  const cached = episodeCache.get(slug)
  if (cached) return cached
  const sample = demoData.episodesSample[slug]
  const series = getSeriesBySlug(slug)
  const list = sample ?? (series ? generateEpisodes(series) : [])
  episodeCache.set(slug, list)
  return list
}

export const episode = (slug: string, n: number): Episode | undefined =>
  episodesFor(slug).find((e) => e.n === n)

/** Fast Pass episodes carry their free release date in `date`. */
export const freeOnDate = (e: Episode): string => e.date

// ---------- readers ----------
export const comicPanels = (): Panel[] => demoData.comicPanels

export type NovelChapter = {
  n: number
  /** "Chapter 1: Flour and Ink" */
  title: string
  /** "Flour and Ink" */
  name: string
  date: string
  blocks: NovelBlock[]
  creatorNote: string
  /** Display count, e.g. "12K". */
  likes: string
}
export function novelChapter(slug: string, n: number): NovelChapter | undefined {
  const e = episode(slug, n)
  if (!e) return undefined
  return {
    n,
    title: e.title,
    name: e.title.replace(/^Chapter \d+:\s*/, ""),
    date: e.date,
    blocks: demoData.novelChapterText,
    creatorNote: demoData.creatorNote,
    likes: e.likes,
  }
}

// ---------- comments, coins, misc ----------
export const comments = (kind: "series" | "episode"): Comment[] => demoData.comments[kind]
export const coinPacks = (): CoinPack[] => demoData.coinPacks
export const paymentMethods = (): PaymentMethod[] => demoData.paymentMethods
export const purchaseHistory = (): Purchase[] => demoData.purchaseHistory
export const faq = (): FaqItem[] => demoData.coinsFaq

/** Not in the data: derived from likes (Assumptions 5): subscribers ≈ 4.68% of likes, comments ≈ 0.133%. */
export function derivedStats(series: Series): { subscribers: string; comments: string } {
  const likes = parseCount(series.likes)
  return { subscribers: formatCount(likes * 0.04683), comments: formatCount(likes * 0.00133) }
}

/** Day of the week "today" falls on (Thursday for the pinned date). */
export const todayWeekday = (): Weekday => weekdayOf(today)

/** Fast Pass price in coins. */
export const fastPassPrice = (): number => demoData.fastPass.price

/** Not in the data: an episode thread is about 2.55% of the episode's likes ("47K" likes -> "1.2K" comments). */
/** Same ratio as episodes, for a novel chapter. */
export const chapterCommentCount = (c: { likes: string }): string => formatCount(parseCount(c.likes) * 0.0255)

export const episodeCommentCount = (e: Episode): string => formatCount(parseCount(e.likes) * 0.0255)
