import { useLocale } from "next-intl"

/**
 * Khmer digits for every number the Khmer UI shows (T44, owner decision 2026-11-11): counts, episode and chapter
 * numbers, dates and coins use ០–៩; money keeps Latin digits. Money never reaches a message as a bare number:
 * prices arrive as formatted text with "$" or "៛", which is left alone.
 *
 * next-intl prints a filled-in number with Latin digits (`{n}` as String(n), `#` with Intl.NumberFormat("km")),
 * so the rule is applied in two places:
 * 1. `localizeKmMessages` (km-messages.ts) rewrites the Khmer messages once when they are loaded: every printed
 *    `{arg}` and every `#` becomes `{arg__kh}`. A plural or select still reads `arg` itself, so `=0` and the
 *    categories keep working.
 * 2. `withLocalDigits` (here) wraps a translator so that every call also passes `arg__kh`: the value with Khmer
 *    digits. English messages never print `arg__kh`, so for them nothing changes.
 * Components get the wrapped translator from `@/i18n/translations` (client and server components) or
 * `@/i18n/translations-server` (async server code), never straight from next-intl (ESLint enforces it). Numbers
 * a component shows outside a message go through `useDigits`.
 */

/** `{arg}` in a Khmer message prints `arg` + this (see km-messages.ts). */
export const SUFFIX = "__kh"
const KHMER = "០១២៣៤៥៦៧៨៩"

/** "12" -> "១២", "84.3K" -> "៨៤.៣K". */
export const toKhmerDigits = (text: string) => text.replace(/[0-9]/g, (d) => KHMER[Number(d)])

/** Arguments that stay as they are even when they look like numbers: codes, ids, names, titles, search text. */
const VERBATIM = new Set([
  "code", "id", "ref", "order", "ticket", "q", "query", "email", "emails", "handle", "password", "adminPassword",
  "creatorPassword", "name", "title", "titles", "label", "note", "text", "topic", "tag", "genre", "genres",
  "method", "creator", "admin", "who", "what", "item", "target", "url",
])

/** Text that is only a number: "12", "1,234", "84.3K", "12%", "3–5", "16+", "1, 2, 3". Never money ("$4.99"). */
const NUMBER_TEXT = /^[\d\s.,:%+\-–]*\d[\d\s.,:%+\-–]*[KMB]?$/

/** The value a Khmer message prints for argument `name`. */
export function khmerValue(name: string, value: unknown): unknown {
  if (VERBATIM.has(name)) return value
  if (typeof value === "number" || typeof value === "bigint") return toKhmerDigits(String(value))
  if (typeof value === "string" && NUMBER_TEXT.test(value)) return toKhmerDigits(value)
  return value
}

/** The values plus `name__kh` for each one (English messages ignore the extra ones). */
export function addKhmerValues<V extends Record<string, unknown> | undefined>(values: V): V {
  if (!values) return values
  const out: Record<string, unknown> = { ...values }
  for (const [name, value] of Object.entries(values)) out[name + SUFFIX] = khmerValue(name, value)
  return out as V
}

// ---- translators

type Translator = {
  (key: string, values?: Record<string, unknown>, formats?: unknown): string
  rich: (key: string, values?: Record<string, unknown>, formats?: unknown) => unknown
  markup: (key: string, values?: Record<string, unknown>, formats?: unknown) => string
  raw: (key: string) => unknown
  has: (key: string) => boolean
}

const wrapped = new WeakMap<object, unknown>()

/**
 * The translator with `addKhmerValues` on every call. One wrapper per translator, so the result is as stable as
 * next-intl's own (safe in effect dependencies).
 */
export function withLocalDigits<T>(translator: T): T {
  const t = translator as unknown as Translator
  const known = wrapped.get(t)
  if (known) return known as T
  const local = ((key, values, formats) => t(key, addKhmerValues(values), formats)) as Translator
  local.rich = (key, values, formats) => t.rich(key, addKhmerValues(values), formats)
  local.markup = (key, values, formats) => t.markup(key, addKhmerValues(values), formats)
  local.raw = (key) => t.raw(key)
  local.has = (key) => t.has(key)
  wrapped.set(t, local)
  return local as unknown as T
}

/** For numbers a component shows outside a message (counts, ranks, step numbers): Khmer digits in Khmer. */
export function useDigits() {
  const locale = useLocale()
  return (value: number | string) => (locale === "km" ? toKhmerDigits(String(value)) : String(value))
}
