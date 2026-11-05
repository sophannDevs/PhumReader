"use client"

import { useTranslations } from "next-intl"

/**
 * "Skip to content". Cache Components keeps the previous route mounted but hidden, so
 * `#main` can exist twice; the click moves focus to the visible one.
 */
export function SkipLink() {
  const t = useTranslations("nav")
  return (
    <a
      href="#main"
      onClick={(e) => {
        const target = [...document.querySelectorAll<HTMLElement>("[id=main]")].find((el) => el.getClientRects().length > 0)
        if (!target) return
        e.preventDefault()
        target.focus()
        target.scrollIntoView()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background"
    >
      {t("skip")}
    </a>
  )
}
