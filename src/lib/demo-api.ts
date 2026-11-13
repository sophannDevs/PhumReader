import { formatCount, parseCount } from "@/lib/format"
import {
  coinPacks,
  comicPanels,
  comments as commentsData,
  continueReading,
  creatorSeriesCount,
  seriesByDay,
  demoData,
  derivedStats,
  episode as episodeBySlug,
  episodesFor,
  faq,
  genres,
  getSeries,
  getSeriesBySlug,
  heroSlides,
  novelChapter,
  novels,
  paymentMethods,
  purchaseHistory,
  rankings,
  relatedSeries,
  seriesByGenre,
  synopsisFor,
  WEEKDAYS,
  type Episode,
  type Genre,
  type PaymentMethodId,
  type RankingEntry,
  type Series,
  type Weekday,
  type Comment,
} from "@/data"
import type {
  ChapterData,
  CoinsPageData,
  CreatorData,
  EpisodeData,
  HomeData,
  LibraryData,
  SeriesDetail,
} from "@/lib/api/types"
import { getDemoFlag } from "@/lib/demo-flags"

/** The view models are shared with the real API (src/lib/api/types.ts); re-exported for existing importers. */
export type {
  ChapterData,
  CoinsPageData,
  CreatorData,
  EpisodeData,
  HomeData,
  LibraryData,
  ReaderMarks,
  SeriesDetail,
} from "@/lib/api/types"

/**
 * The fake backend. Every "server" read or write goes through here (pages never
 * touch demo data directly). Each call waits 300-800 ms and honours the URL flags
 * (read by `getDemoFlag` in src/lib/demo-flags.ts):
 *   ?demo=empty  empty lists / empty content
 *   ?demo=error  every call throws DemoApiError
 *   ?demo=slow   adds 3 s
 */

export class DemoApiError extends Error {
  constructor(
    message: string,
    /** Stable machine-readable code, e.g. "invalid_credentials". */
    public readonly code: string = "demo_error"
  ) {
    super(message)
    this.name = "DemoApiError"
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const randomDelay = () => 300 + Math.random() * 500

/**
 * Wraps a handler: error flag throws, then the delay (+3 s with `slow`), then
 * `empty` (when given) replaces the result under the empty flag.
 */
export async function withDemo<T>(
  fn: () => T,
  options: { empty?: () => T; delay?: number } = {}
): Promise<T> {
  const flag = getDemoFlag()
  if (flag === "error") {
    await sleep(randomDelay())
    throw new DemoApiError("Something went wrong (?demo=error)", "demo_error")
  }
  await sleep((options.delay ?? randomDelay()) + (flag === "slow" ? 3000 : 0))
  if (flag === "empty" && options.empty) return options.empty()
  return fn()
}

// ------------------------------------------------------------------ reads
const CTA_TITLES = ["Ink Witch", "Sunday Sword", "The Orchard Pact"]
const ctaCovers = () => CTA_TITLES.flatMap((t) => getSeries().filter((s) => s.title === t))

export const fetchHome = () =>
  withDemo<HomeData>(
    () => ({
      hero: heroSlides(),
      continueReading: continueReading(),
      daily: Object.fromEntries(WEEKDAYS.map((d) => [d, seriesByDay(d)])) as Record<Weekday, Series[]>,
      rankings: { comics: rankings("comics").slice(0, 8), novels: rankings("novels").slice(0, 8) },
      genres: genres(),
      byGenre: Object.fromEntries(genres().map((g) => [g, seriesByGenre(g)])) as Record<Genre, Series[]>,
      novels: novels().slice(0, 6),
      creatorCovers: ctaCovers(),
    }),
    {
      empty: () => ({
        hero: [],
        continueReading: [],
        daily: Object.fromEntries(WEEKDAYS.map((d) => [d, []])) as unknown as Record<Weekday, Series[]>,
        rankings: { comics: [], novels: [] },
        genres: genres(),
        byGenre: Object.fromEntries(genres().map((g) => [g, []])) as unknown as Record<Genre, Series[]>,
        novels: [],
        creatorCovers: ctaCovers(),
      }),
    }
  )

/** All series (the page filters by the store's ids) and the demo "continue reading" entries. */
export const fetchLibrary = () =>
  withDemo<LibraryData>(() => ({ series: getSeries(), continueReading: continueReading() }), {
    empty: () => ({ series: getSeries(), continueReading: [] }),
  })

/** The demo has no creator accounts: the dashboard shows Chan Sreyleak's series. */
export const STAND_IN_CREATOR = "Chan Sreyleak"

export const fetchCreator = () =>
  withDemo<CreatorData>(
    () => {
      const series = getSeries().filter((s) => s.creator === STAND_IN_CREATOR)
      return {
        name: STAND_IN_CREATOR,
        series,
        totals: {
          views: formatCount(series.reduce((n, s) => n + parseCount(s.views), 0)),
          likes: formatCount(series.reduce((n, s) => n + parseCount(s.likes), 0)),
        },
      }
    },
    { empty: () => ({ name: STAND_IN_CREATOR, series: [], totals: { views: "0", likes: "0" } }) }
  )

/** null when the slug is unknown (pages call notFound()). Not affected by ?demo=empty. */
export const fetchSeries = (slug: string) =>
  withDemo<SeriesDetail | null>(() => {
    const series = getSeriesBySlug(slug)
    if (!series) return null
    return {
      series,
      synopsis: synopsisFor(series),
      stats: derivedStats(series),
      related: relatedSeries(series, 4),
      creatorSeriesCount: creatorSeriesCount(series.creator),
    }
  })

/** Oldest first. */
export const fetchEpisodes = (slug: string) =>
  withDemo<Episode[]>(() => episodesFor(slug), { empty: () => [] })

/** null when the series or the episode number does not exist. */
export const fetchEpisode = (slug: string, n: number) =>
  withDemo<EpisodeData | null>(
    () => {
      const series = getSeriesBySlug(slug)
      const ep = series ? episodeBySlug(slug, n) : undefined
      if (!series || !ep) return null
      return { series, episode: ep, total: episodesFor(slug).length, panels: comicPanels() }
    },
    {
      empty: () => {
        const series = getSeriesBySlug(slug)
        const ep = series ? episodeBySlug(slug, n) : undefined
        return series && ep ? { series, episode: ep, total: episodesFor(slug).length, panels: [] } : null
      },
    }
  )

export const fetchChapter = (slug: string, n: number) =>
  withDemo<ChapterData | null>(
    () => {
      const series = getSeriesBySlug(slug)
      const chapter = series ? novelChapter(slug, n) : undefined
      return series && chapter ? { series, chapter, total: episodesFor(slug).length } : null
    },
    {
      empty: () => {
        const series = getSeriesBySlug(slug)
        const chapter = series ? novelChapter(slug, n) : undefined
        return series && chapter ? { series, chapter: { ...chapter, blocks: [] }, total: episodesFor(slug).length } : null
      },
    }
  )

/** `slug` identifies the series or episode the thread belongs to (the demo thread is shared). */
export const fetchComments = (kind: "series" | "episode", slug: string) => {
  void slug
  return withDemo<Comment[]>(() => commentsData(kind), { empty: () => [] })
}

/**
 * V2.1 Comments page (spec §23): threads with the creator's pinned comment, spoilers and replies. `slug` is the
 * series or "slug:n" for one episode (the demo thread is shared). Comments marked `creator` are by the series' creator.
 */
export const fetchCommentThreads = (slug: string) => {
  void slug
  return withDemo(() => demoData.commentThreads, { empty: () => [] })
}

export const fetchRankings = (kind: "comics" | "novels") =>
  withDemo<RankingEntry[]>(() => rankings(kind), { empty: () => [] })

export const fetchGenre = (genre: Genre) =>
  withDemo<{ genre: Genre; series: Series[] }>(() => ({ genre, series: seriesByGenre(genre) }), {
    empty: () => ({ genre, series: [] }),
  })

/** Title, creator or genre; at most `limit` (default 8). An empty query returns the first 6 series. */
export const search = (query: string, limit = 8) =>
  withDemo<Series[]>(
    () => {
      const q = query.trim().toLowerCase()
      if (!q) return getSeries().slice(0, 6)
      return getSeries()
        .filter((s) => [s.title, s.creator, s.genre].some((f) => f.toLowerCase().includes(q)))
        .slice(0, limit)
    },
    { empty: () => [] }
  )

export const fetchCoinsPage = () =>
  withDemo<CoinsPageData>(
    () => ({
      packs: coinPacks(),
      methods: paymentMethods(),
      history: purchaseHistory(),
      faq: faq(),
      firstPurchaseBonus: demoData.firstPurchaseBonus,
      khqrExpiryMinutes: demoData.khqrExpiryMinutes,
      fastPassPrice: demoData.fastPass.price,
    }),
    {
      empty: () => ({
        packs: coinPacks(),
        methods: paymentMethods(),
        history: [],
        faq: faq(),
        firstPurchaseBonus: demoData.firstPurchaseBonus,
        khqrExpiryMinutes: demoData.khqrExpiryMinutes,
        fastPassPrice: demoData.fastPass.price,
      }),
    }
  )

// ----------------------------------------------------------------- writes
export type DemoUser = { name: string; email: string; roles: string[] }
export type DemoAccount = { name: string; email: string; password: string; roles?: string[] }

/** Roles of the V2.1 demo accounts: the creator can publish, the moderator opens /admin. */
const ROLES = { reader: ["READER"], creator: ["READER", "CREATOR"], moderator: ["READER", "CREATOR", "ADMIN"] } as const

/** Every email that already has an account in the demo (sign up says it's taken). */
export const demoEmails = () => demoData.demoAccounts.map((a) => a.email.toLowerCase())

/** The three demo accounts (reader, creator, admin) plus any account created by sign up (passed in from the store). */
export const login = (email: string, password: string, accounts: DemoAccount[] = []) =>
  withDemo<DemoUser>(
    () => {
      const e = email.trim().toLowerCase()
      const demo = demoData.demoAccounts.find((a) => a.email.toLowerCase() === e && a.password === password)
      if (demo) return { name: demo.name, email: demo.email, roles: [...ROLES[demo.role]] }
      const match = accounts.find((a) => a.email.toLowerCase() === e && a.password === password)
      if (match) return { name: match.name, email: match.email, roles: match.roles ?? ["READER"] }
      throw new DemoApiError("Email or password is incorrect", "invalid_credentials")
    },
    { delay: 900 }
  )

/** Google / Facebook / Apple buttons: no OAuth, always signs in as Sokha Chan after 1 s. */
export const socialLogin = (provider: "google" | "facebook" | "apple") =>
  withDemo<DemoUser>(
    () => ({ name: "Sokha Chan", email: `sokha.${provider}@example.com`, roles: ["READER"] }),
    { delay: 1000 }
  )

export const signUp = (
  data: { name: string; email: string; password: string },
  existingEmails: string[] = []
) =>
  withDemo<{ ok: true }>(() => {
    const e = data.email.trim().toLowerCase()
    if (demoEmails().includes(e) || existingEmails.some((x) => x.toLowerCase() === e)) {
      throw new DemoApiError("That email already has an account", "email_taken")
    }
    return { ok: true }
  })

export const verifyCode = (code: string) =>
  withDemo<{ ok: true }>(() => {
    if (code !== demoData.emailCode) {
      throw new DemoApiError("That code isn't right", "invalid_code")
    }
    return { ok: true }
  })

export const sendResetLink = (email: string) => withDemo<{ ok: true; email: string }>(() => ({ ok: true, email }))

/** Unlock confirmation (0.7 s). Balance and unlocked episodes live in the store. */
export const unlock = (seriesId: string, episode: number) =>
  withDemo<{ seriesId: string; episode: number; price: number }>(
    () => ({ seriesId, episode, price: demoData.fastPass.price }),
    { delay: 700 }
  )

export type PayOrder = { coins: number; bonus: number; firstBonus: number; method: PaymentMethodId }
export type PayResult = { orderId: string; coins: number; method: PaymentMethodId }

/** Simulated payment (1.5 s). `failed` rejects with code "payment_declined". */
export const pay = (order: PayOrder, outcome: "success" | "failed" = "success") =>
  withDemo<PayResult>(
    () => {
      if (outcome === "failed") throw new DemoApiError("Payment didn't go through", "payment_declined")
      // TW-######## (spec §19: order numbers look like TW-12345678)
      const orderId = `TW-${String(Date.now()).slice(-8)}`
      return { orderId, coins: order.coins + order.bonus + order.firstBonus, method: order.method }
    },
    { delay: 1500 }
  )
