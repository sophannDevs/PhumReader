import { demoData, type MyWork, type Weekday } from "@/data"
import { genreSchema } from "@/data/types"
import { addDays, weekdayOf } from "@/lib/format"

/**
 * Rules and demo helpers shared by the V2.1 creator studio pages: Create series (spec §15), Upload episode (§16) and
 * Manage series (§21). Numbers come from the spec and the prototype (CreateSeries/, Upload/, Manage/ page.js).
 */

export const GENRES = genreSchema.options
export type StudioGenre = (typeof GENRES)[number]
/** Monday first, the order of the update-day chips. */
export const WEEK: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
/** Release times offered, in ICT hours: 12:00 PM, 6:00 PM, 8:00 PM, 9:00 PM. */
export const RELEASE_HOURS = [12, 18, 20, 21] as const
export const DEFAULT_HOUR = 18
export const AGES = ["all", "13", "16", "18"] as const
export type Age = (typeof AGES)[number]
export const LANGS = ["km", "en", "both"] as const
export type Lang = (typeof LANGS)[number]

export const TITLE_MIN = 2
export const TITLE_MAX = 60
export const SUMMARY_MIN = 50
export const SUMMARY_MAX = 500
export const MAX_TAGS = 5
export const TAG_MAX = 20
export const NOTE_MAX = 300
export const BREAK_NOTE_MAX = 120
export const MIN_WORDS = 300
/** Comic images: JPG or PNG, 690–1600 px wide, up to 20 MB each, up to 100 per episode. */
export const PANEL_MIN_WIDTH = 690
export const PANEL_MAX_WIDTH = 1600
export const FAST_PASS_COINS = 5
/** Fast Pass episodes ready ahead of the free one (the default; Manage > Fast Pass offers 1–5). */
export const FAST_PASS_AHEAD = 3
/** Each Fast Pass episode is free for everyone 7 days after release (prototype Manage > Fast Pass). */
export const FREE_AFTER_DAYS = 7

/** Days in week order without repeats. */
export const sortDays = (days: readonly Weekday[]) => WEEK.filter((d) => days.includes(d))

const SUN_FIRST: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** The first date on or after `from` (ISO) that falls on `day`. */
export function onOrAfter(day: Weekday, from: string): string {
  return addDays(from, (SUN_FIRST.indexOf(day) - SUN_FIRST.indexOf(weekdayOf(from)) + 7) % 7)
}

/** The last date on or before `from` (ISO) that falls on `day`. */
export function onOrBefore(day: Weekday, from: string): string {
  return addDays(from, -((SUN_FIRST.indexOf(weekdayOf(from)) - SUN_FIRST.indexOf(day) + 7) % 7))
}

/** Epoch ms of a wall-clock time in Cambodia (ICT, UTC+7, no daylight saving). */
export function ictAt(iso: string, hour: number, minute = 0): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d, hour - 7, minute)
}

/**
 * The changes a reviewer can ask for (admin "Request changes"), in the order of the admin page's labels `change_0` …
 * `change_4`. The API (V21-01) and the demo store save these keys; the website translates them when it shows them.
 */
export const REVIEW_ITEMS = ["contact", "cover", "title", "age", "images"] as const
export type ReviewItem = (typeof REVIEW_ITEMS)[number]
export const isReviewItem = (value: string): value is ReviewItem => (REVIEW_ITEMS as readonly string[]).includes(value)

/** Social handles, links and phone numbers: summaries can't include them (spec §21, admin flag "contact"). */
export const hasContactDetails = (text: string) => /(@\w|t\.me\/|telegram|facebook\.com|https?:\/\/|www\.|\b0\d{8,9}\b)/i.test(text)

/** Words as readers count them. */
export const countWords = (text: string) => (text.trim().match(/\S+/g) ?? []).length

/** Covers of the demo catalogue: the prototype's stand-in for an uploaded image in demo mode. */
export const sampleCovers = () => demoData.series.map((s) => s.cover)

/** Another sample cover than `current` (the prototype's "Cover uploaded" in demo mode). */
export function nextSampleCover(current: string, step = 4): string {
  const pool = sampleCovers()
  const at = pool.indexOf(current)
  return pool[(((at < 0 ? 0 : at) + step) % pool.length + pool.length) % pool.length]
}

/** A free id for a new demo work: C10, C11, … (the prototype's numbering). */
export function nextWorkId(works: readonly Pick<MyWork, "id">[]): string {
  const used = new Set(works.map((w) => w.id))
  let n = 10
  while (used.has(`C${n}`)) n++
  return `C${n}`
}

/**
 * The summary the review team saw. Demo data keeps a separate copy of a submitted work in the admin queue (with the
 * contact details the reviewer flagged), so the creator fixes that one.
 */
export function submittedSummary(w: Pick<MyWork, "id" | "summary">): string {
  const q = demoData.adminSeriesQueue.find((x) => x.id === w.id)
  return q && q.summary.startsWith(w.summary) ? q.summary : w.summary
}

/** When a demo work was sent for review (the admin queue's "Nov 9, 4:12 PM"), as an ISO date; null when unknown. */
export function submittedOn(id: string): string | null {
  const q = demoData.adminSeriesQueue.find((x) => x.id === id)
  const m = q ? /^([A-Z][a-z]{2}) (\d{1,2})/.exec(q.when) : null
  if (!m) return null
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m[1]) + 1
  return month ? `${demoData.today.slice(0, 4)}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null
}

export type EpisodeState = "published" | "fastpass" | "scheduled" | "draft" | "hidden"

/** One episode or chapter as the studio shows it (demo list or the real API's). */
export type StudioEpisode = {
  n: number
  /** "" = untitled */
  title: string
  state: EpisodeState
  thumb: string | null
  views: number | null
  likes: number | null
  comments: number | null
  /** ISO date it came out (published, Fast Pass, hidden) */
  released?: string
  /** ISO date a Fast Pass episode becomes free for everyone */
  free?: string
  /** Epoch ms a scheduled episode goes live */
  at?: number
  /** ISO date the creator hid it */
  hiddenSince?: string
  /** A draft that is ready for the series launch (series in review) */
  ready?: boolean
}

/** The prototype's episode names (River Lantern); the 26th is the untitled draft. */
const NAMES = [
  "The Lantern Wakes",
  "Fog on the Mekong",
  "A Ferry With No Name",
  "The Night Ferryman",
  "Paper Boats",
  "River Market",
  "The Lost Girl",
  "Monsoon Bells",
  "Under the Bridge",
  "Spirit Tide",
  "Two Shores",
  "Ash and Water",
  "The Old Pier",
  "Lantern Festival",
  "Floodwater",
  "Moon on the River",
  "The Ferry Strike",
  "Driftwood",
  "Grandmother’s Map",
  "The Tenth Lantern",
  "Whispering Reeds",
  "Low Tide",
  "The Crossing",
  "The Ferry at Dawn",
  "The Ferryman’s Promise",
]
const LAUNCH_NAMES = ["Cold Noodles, Hot Case", "The Missing Chopsticks", "Market After Midnight"]

/**
 * The demo episode list of one of the creator's works (prototype Manage `makeEps`), relative to `base` (ISO "today"):
 * - a live series: episodes 1…eps came out weekly on its update day (the newest one on or before today), the newest
 *   3 are still Fast Pass (free 7 days after release), episode 9 is hidden, then one scheduled episode on the next
 *   update day at 6:00 PM and one untitled draft;
 * - a series in review or with changes requested: its `eps` episodes are drafts ready for the launch;
 * - a draft series: its `eps` episodes are drafts.
 */
export function demoEpisodes(w: Pick<MyWork, "status" | "eps" | "day">, base: string): StudioEpisode[] {
  const covers = sampleCovers()
  if (w.status !== "published") {
    return Array.from({ length: w.eps }, (_, i) => ({
      n: i + 1,
      title: (w.status === "draft" ? "" : LAUNCH_NAMES[i]) ?? "",
      state: "draft" as const,
      thumb: covers[((i + 1) * 7) % covers.length],
      views: null,
      likes: null,
      comments: null,
      ready: w.status !== "draft",
    }))
  }
  const last = onOrBefore(w.day, base)
  const out: StudioEpisode[] = []
  for (let n = 1; n <= w.eps + 2; n++) {
    const date = addDays(last, (n - w.eps) * 7)
    const state: EpisodeState =
      n > w.eps + 1 ? "draft" : n === w.eps + 1 ? "scheduled" : n === 9 && w.eps >= 12 ? "hidden" : n > w.eps - 3 ? "fastpass" : "published"
    const live = state === "published" || state === "fastpass" || state === "hidden"
    out.push({
      n,
      title: n <= w.eps + 1 ? (NAMES[n - 1] ?? "") : "",
      state,
      thumb: covers[(n * 5) % covers.length],
      views: live ? 4200 + ((n * 977) % 3800) + (w.eps - n) * 120 : null,
      likes: live ? 310 + ((n * 131) % 420) : null,
      comments: live ? 12 + ((n * 17) % 60) : null,
      released: live ? date : undefined,
      free: state === "fastpass" ? addDays(date, FREE_AFTER_DAYS) : undefined,
      at: state === "scheduled" ? ictAt(date, DEFAULT_HOUR) : undefined,
      hiddenSince: state === "hidden" ? addDays(base, -3) : undefined,
    })
  }
  return out
}
