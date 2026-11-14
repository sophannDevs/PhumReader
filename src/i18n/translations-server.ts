import { getTranslations as getNextIntlTranslations } from "next-intl/server"
import { createTranslator } from "next-intl"
import { withLocalDigits } from "./local-digits"
import { loadMessages } from "./messages"
import type { Locale } from "./routing"

/**
 * next-intl's `getTranslations` for async server code (pages, layouts, `generateMetadata`), with Khmer digits for
 * numbers filled into Khmer messages (see local-digits.ts). Use this one instead of importing it from next-intl.
 */
export const getTranslations = (async (...args: Parameters<typeof getNextIntlTranslations>) =>
  withLocalDigits(await getNextIntlTranslations(...args))) as typeof getNextIntlTranslations

/**
 * A translator that needs no request context. Use it inside `"use cache"` code such as `generateMetadata`: next-intl's
 * `getTranslations` reads the request (headers) even when a locale is passed, which Next.js reports as uncached data
 * and blocks the route ("Blocking Route").
 */
export async function getCachedTranslations(locale: Locale, namespace: "reader") {
  const messages = await loadMessages(locale)
  return withLocalDigits(createTranslator({ locale, messages, namespace }))
}
