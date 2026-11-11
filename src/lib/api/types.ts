import type {
  CoinPack,
  ContinueView,
  Episode,
  FaqItem,
  Genre,
  HeroSlideView,
  NovelChapter,
  Panel,
  PaymentMethod,
  Purchase,
  RankingEntry,
  Series,
  Weekday,
} from "@/data"

/**
 * Shared API & catalog view models.
 * Standard data transfer contracts for catalog, series, episodes, wallet and creator views.
 */

export type HomeData = {
  hero: HeroSlideView[]
  continueReading: ContinueView[]
  /** Daily updates grid per weekday (6 each). */
  daily: Record<Weekday, Series[]>
  rankings: { comics: RankingEntry[]; novels: RankingEntry[] }
  genres: Genre[]
  byGenre: Record<Genre, Series[]>
  novels: Series[]
  /** Three covers for the creator call-to-action card. */
  creatorCovers: Series[]
}

export type LibraryData = {
  series: Series[]
  continueReading: ContinueView[]
}

export type CreatorData = {
  name: string
  series: Series[]
  totals: { views: string; likes: string }
  /** Real API: the account has the creator role. */
  isCreator?: boolean
  /** Real API: coins earned from unlocks. */
  earnedCoins?: number
  /** Real API only: the address of the public profile, /creators/<handle> (V21-05). */
  handle?: string | null
}

export type SeriesDetail = {
  series: Series
  synopsis: string
  stats: { subscribers: string; comments: string }
  related: Series[]
  creatorSeriesCount: number
  /** Real API: creator account UUID for following. */
  creatorId?: string
  /** Real API (V21-05): the address of the creator's profile, /creators/<handle>. */
  creatorHandle?: string
  /** Real API (V21-02): the second genre, or null. */
  secondGenre?: Genre | null
  /** Real API (V21-02): the creator's "On break" message while the status is hiatus, or null. */
  breakMessage?: string | null
  /** Real API (V21-02): false when the creator turned comments off for the whole series (no comment box). */
  commentsEnabled?: boolean
}

export type ReaderMarks = {
  liked: boolean
  bookmarked: boolean
}

export type EpisodeData = {
  series: Series
  episode: Episode
  total: number
  panels: Panel[]
  /** Real API: user reactions for this episode. */
  viewer?: ReaderMarks
  /** Real API: false when the episode's or the series' comments switch is off (no comment box). */
  commentsEnabled?: boolean
}

export type ChapterData = {
  series: Series
  chapter: NovelChapter
  total: number
  viewer?: ReaderMarks
  /** Real API: false when the chapter's or the series' comments switch is off. */
  commentsEnabled?: boolean
}

export type CoinsPageData = {
  packs: CoinPack[]
  methods: PaymentMethod[]
  history: Purchase[]
  faq: FaqItem[]
  firstPurchaseBonus: string
  khqrExpiryMinutes: number
  fastPassPrice: number
  /** Real API: pack size (coins) -> pack id. */
  packIds?: Record<number, number>
  /** Real API: the payment simulator is enabled. */
  simulator?: boolean
}

