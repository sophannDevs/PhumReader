"use client"

import { GlobeIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const labels: Record<Locale, string> = { en: "English", km: "ខ្មែរ" }

/**
 * Switches the locale and stays on the same page (path and query kept).
 * `inline` = "English · ខ្មែរ" text with a globe (footer); `segmented` = EN / ខ្មែរ
 * pill switch (auth pages, settings). Also persists `lang` in the store.
 */
export function LanguageSwitch({
  variant = "inline",
  className,
  onChange,
}: {
  variant?: "inline" | "segmented"
  className?: string
  onChange?: (locale: Locale) => void
}) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("footer")

  function switchTo(next: Locale) {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    onChange?.(next)
    router.replace(`${pathname}${window.location.search}`, { locale: next })
  }

  const buttons = routing.locales.map((l) => {
    const current = l === locale
    return (
      <button
        key={l}
        type="button"
        lang={l}
        aria-current={current ? "true" : undefined}
        onClick={() => switchTo(l)}
        className={cn(
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variant === "inline"
            ? cn("rounded-sm text-sm hover:text-foreground", current ? "font-semibold text-foreground" : "text-muted-foreground")
            : cn(
                "h-[30px] rounded-md px-3 text-sm font-medium transition-colors",
                current ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )
        )}
      >
        {variant === "segmented" && l === "en" ? "EN" : labels[l]}
      </button>
    )
  })

  if (variant === "segmented") {
    return (
      <div
        role="group"
        aria-label={t("language")}
        className={cn("inline-flex gap-0.5 rounded-lg bg-muted p-[3px]", className)}
      >
        {buttons}
      </div>
    )
  }

  return (
    <div role="group" aria-label={t("language")} className={cn("flex items-center gap-2 text-sm", className)}>
      <GlobeIcon className="size-4 text-muted-foreground" aria-hidden />
      {buttons[0]}
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      {buttons[1]}
    </div>
  )
}

/**
 * Header language pill (foundations §8): 32 px, shows the *other* language ("ខ្មែរ" in English, "EN" in Khmer)
 * and switches to it, keeping the page.
 */
export function LanguageButton({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("nav")
  const other: Locale = locale === "en" ? "km" : "en"

  return (
    <button
      type="button"
      onClick={() => {
        useAppStore.getState().setLang(other)
        router.replace(`${pathname}${window.location.search}`, { locale: other })
      }}
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
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("nav")
  const other: Locale = locale === "en" ? "km" : "en"

  return (
    <button
      type="button"
      onClick={() => {
        useAppStore.getState().setLang(other)
        router.replace(`${pathname}${window.location.search}`, { locale: other })
      }}
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
    </button>
  )
}
