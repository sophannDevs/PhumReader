"use client"

import { useLocale, useTranslations } from "next-intl"
import { useContextLine } from "@/components/auth/use-place-name"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { useAppStore, useHydrated } from "@/lib/store"
import { cn } from "@/lib/utils"

const LABELS: Record<Locale, string> = { en: "English", km: "ខ្មែរ" }

/** Card top (`.au-top`): the context line and the English / ខ្មែរ pill toggle (switches the page language). */
export function AuthCardTop() {
  const t = useTranslations("auth")
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const line = useContextLine(useHydrated())

  function switchTo(next: Locale) {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    // Same view: the step is in the address (?mode=…); the flow keeps what was typed (auth-flow.tsx).
    router.replace(`${pathname}${window.location.search}`, { locale: next })
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 truncate text-xs leading-4 font-medium text-brand-ink">{line}</span>
      <div role="group" aria-label={t("language")} className="inline-flex shrink-0 gap-0.5 rounded-full bg-muted p-[3px]">
        {routing.locales.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={l === locale}
            onClick={() => switchTo(l)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              l === "km" && "font-khmer",
              l === locale ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
