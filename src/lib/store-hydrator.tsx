"use client"

import { useLocale } from "next-intl"
import { useEffect } from "react"
import type { Locale } from "@/i18n/routing"
import { useAppStore, useHydrated } from "@/lib/store"

/**
 * Loads the persisted state after the first render (skipHydration), so SSR markup
 * matches, then keeps the store's `lang` equal to the URL locale (Assumption 1).
 */
export function StoreHydrator() {
  const locale = useLocale() as Locale
  const hydrated = useHydrated()

  useEffect(() => {
    void useAppStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (hydrated && useAppStore.getState().lang !== locale) useAppStore.getState().setLang(locale)
  }, [hydrated, locale])

  return null
}
