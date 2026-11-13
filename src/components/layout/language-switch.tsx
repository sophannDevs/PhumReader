"use client"

import { AnimateIcon } from "@animate-ui/react/icons"
import { GlobeIcon } from "@/components/animate-ui/icons/globe"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const labels: Record<Locale, string> = { en: "English", km: "ខ្មែរ" }

/**
 * Switches the site language and stays on the same page (path and query kept), and saves `lang` in the store.
 * Picking the current language does nothing.
 */
export function useSwitchLocale() {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  return (next: Locale) => {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    router.replace(`${pathname}${window.location.search}`, { locale: next })
  }
}

/**
 * English / ខ្មែរ pill toggle (`.er-langs` on the error pages, `.au-top` on the auth card): the current language is
 * pressed; the other one switches and stays on the address. `localeSwitchAttr` adds `data-locale-switch`, which lets
 * the offline page's inline script do the same when the page was served by the service worker without its JavaScript.
 */
export function LangPills({ label, localeSwitchAttr = false }: { label: string; localeSwitchAttr?: boolean }) {
  const locale = useLocale() as Locale
  const switchTo = useSwitchLocale()

  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 gap-0.5 rounded-full bg-muted p-[3px]">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          data-locale-switch={localeSwitchAttr ? l : undefined}
          aria-pressed={l === locale}
          onClick={() => switchTo(l)}
          className={cn(
            "h-7 rounded-full px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            l === "km" && "font-khmer",
            l === locale ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}

/**
 * Header language pill (foundations §8): 32 px, shows the *other* language ("ខ្មែរ" in English, "EN" in Khmer)
 * and switches to it, keeping the page.
 */
export function LanguageButton({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const switchTo = useSwitchLocale()
  const t = useTranslations("nav")
  const other: Locale = locale === "en" ? "km" : "en"

  return (
    <button
      type="button"
      onClick={() => switchTo(other)}
      className={cn(
        "h-8 min-w-11 shrink-0 rounded-full border bg-background px-2.5 text-[13px] font-semibold text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[420px]:h-[30px] max-[420px]:min-w-0 max-[420px]:px-2",
        other === "km" && "font-khmer",
        className
      )}
    >
      {/* Name: "Switch to ខ្មែរ" / "ប្ដូរទៅ EN", in the page's language; only the visible word carries the other lang. */}
      <span className="sr-only">{t("switchTo")} </span>
      <span lang={other}>{other === "en" ? "EN" : labels.km}</span>
    </button>
  )
}

/** Footer: "English · ខ្មែរ" with a globe; switches to the other language. */
export function LanguageToggleLink({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const switchTo = useSwitchLocale()
  const t = useTranslations("nav")
  const other: Locale = locale === "en" ? "km" : "en"

  return (
    <AnimateIcon asChild animateOnHover><button
      type="button"
      onClick={() => switchTo(other)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <GlobeIcon className="size-3.5" aria-hidden />
      {/* The name starts with the visible text (WCAG 2.5.3 label in name), then says what pressing it does. */}
      <span>
        <span lang="en">English</span> · <span lang="km">ខ្មែរ</span>
        <span className="sr-only">
          , {t("switchTo")} <span lang={other}>{labels[other]}</span>
        </span>
      </span>
    </button></AnimateIcon>
  )
}
