import { demoData } from "@/data/demo"
import type { Weekday } from "@/data/types"

/** The app's pinned "today" (ISO date), not the real clock: see assumption 2. */
export const today: string = demoData.today

const MS_PER_DAY = 86_400_000

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

/** ISO date + n days, as an ISO date. */
export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

const KHMER_MONTHS = ["មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា", "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"]
const khmerDigits = (n: number) => String(n).replace(/\d/g, (c) => "០១២៣៤៥៦៧៨៩"[Number(c)])

/** "2026-11-05" -> "Nov 5, 2026" (en) or the Khmer equivalent. */
export function formatDate(iso: string, locale: string = "en"): string {
  if (locale === "km") {
    // Own formatting: not every browser ships Khmer date data (it silently falls back to English).
    const [y, m, d] = iso.split("-").map(Number)
    return `${khmerDigits(d)} ${KHMER_MONTHS[m - 1]} ${khmerDigits(y)}`
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(toUtc(iso)))
}

const WEEKDAYS: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const weekdayOf = (iso: string): Weekday => WEEKDAYS[new Date(toUtc(iso)).getUTCDay()]

/** "1.8M" -> 1_800_000, "871K" -> 871_000, "52" -> 52. */
export function parseCount(text: string): number {
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(text.trim())
  if (!m) return 0
  const n = Number(m[1].replace(/,/g, ""))
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase() as "K" | "M" | "B"] ?? 1
  return n * mult
}

/** 84_300 -> "84.3K", 1_800_000 -> "1.8M", 412 -> "412". */
export function formatCount(n: number): string {
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, "")
  if (n >= 1e9) return `${trim(n / 1e9)}B`
  if (n >= 1e6) return `${trim(n / 1e6)}M`
  if (n >= 1e3) return `${trim(n / 1e3)}K`
  return String(Math.round(n))
}

/** "Sokha P." -> "SP", "Sokha Chan" -> "SC", "Owen" -> "O". Max 2 letters. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

/** "Sokha Chan" -> "Sokha" */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

// ---- V2.1: dates and times in ICT (UTC+7), Khmer month names and digits (spec §0, receipts, schedules)

const ICT_OFFSET_MS = 7 * 3_600_000
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export { khmerDigits }

/** Digits in the reader's language: Khmer numerals for km, unchanged for en. */
export const localDigits = (value: number | string, locale: string) =>
  locale === "km" ? String(value).replace(/\d/g, (c) => "០១២៣៤៥៦៧៨៩"[Number(c)]) : String(value)

/** Parts of an epoch time in ICT. */
function ictParts(epochMs: number) {
  const d = new Date(epochMs + ICT_OFFSET_MS)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() }
}

/** Epoch ms -> ISO date in ICT. */
export const ictDate = (epochMs: number) => {
  const p = ictParts(epochMs)
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`
}

/** "7:05 AM" (en) or "៧:០៥ ព្រឹក" (km), in ICT. */
export function formatTime(epochMs: number, locale: string = "en"): string {
  const { h, min } = ictParts(epochMs)
  const h12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(min).padStart(2, "0")
  if (locale === "km") return `${localDigits(h12, "km")}:${localDigits(mm, "km")} ${h < 12 ? "ព្រឹក" : "ល្ងាច"}`
  return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`
}

/** "Oct 28, 2026, 7:05 AM" (en) or the Khmer equivalent, in ICT. */
export function formatDateTime(epochMs: number, locale: string = "en"): string {
  return `${formatDate(ictDate(epochMs), locale)}${locale === "km" ? " " : ", "}${formatTime(epochMs, locale)}`
}

/** "Nov 26" (en) or "២៦ វិច្ឆិកា" (km): an ISO date without the year. */
export function formatShortDate(iso: string, locale: string = "en"): string {
  const [, m, d] = iso.split("-").map(Number)
  if (locale === "km") return `${khmerDigits(d)} ${KHMER_MONTHS[m - 1]}`
  return `${EN_MONTHS[m - 1]} ${d}`
}

/** Whole days from the pinned demo "today" to an ISO date (negative = past). */
export const daysFromToday = (iso: string) => Math.round((toUtc(iso) - toUtc(today)) / MS_PER_DAY)
