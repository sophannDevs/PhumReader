"use client"

import { AlertCircleIcon, CheckCircle2Icon, ChevronRightIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { ErrorArt, type ErrorArtKind } from "@/components/pr/error-art"
import { SeriesCard } from "@/components/pr/series-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Series } from "@/data"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { routing, type Locale } from "@/i18n/routing"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

/**
 * The error page family (spec §9, design/prototype-src/Error, screens 09-*): a soft green hero with the illustration
 * in a white tile on the left, then a code badge, the English / ខ្មែរ toggle, the heading, the body and the page's own
 * blocks and actions, a help line under a rule, and optionally a row of series cards below the hero.
 * Used by 404 (not-found.tsx), 500 (error.tsx), /offline, /maintenance and /coming-soon.
 */
export type ErrorPageKind = ErrorArtKind | "comingSoon"

const BADGE: Record<ErrorPageKind, "secondary" | "up" | "warn" | "brand"> = {
  notFound: "secondary",
  server: "up",
  offline: "warn",
  maintenance: "brand",
  comingSoon: "brand",
}

const LANG_LABEL: Record<Locale, string> = { en: "English", km: "ខ្មែរ" }

/** `.er-actions`: wrapping row of large buttons that share the width on phones. */
export const errorActions = "flex flex-wrap gap-2 pt-1 max-md:[&>*]:flex-auto"

/** `.er-link` as an underlined brand-ink text button ("Report a broken link"). */
export const errorLinkButton =
  "rounded-sm font-semibold text-brand-ink underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Help line links ("Help center", "Service status"): semibold, in the line's colour. */
const helpLink =
  "rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * `.er-langs`: switches the site language and stays on the address (like the header language button). The
 * `data-locale-switch` attribute lets the offline page's inline script do the same when the page was served by the
 * service worker without its JavaScript.
 */
export function ErrorLangToggle() {
  const t = useTranslations("errors")
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()

  function switchTo(next: Locale) {
    if (next === locale) return
    useAppStore.getState().setLang(next)
    router.replace(`${pathname}${window.location.search}`, { locale: next })
  }

  return (
    <div role="group" aria-label={t("language")} className="inline-flex shrink-0 gap-0.5 rounded-full bg-muted p-[3px]">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          data-locale-switch={l}
          aria-pressed={l === locale}
          onClick={() => switchTo(l)}
          className={cn(
            "h-7 rounded-full px-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            l === "km" && "font-khmer",
            l === locale ? "bg-background text-foreground shadow-[0_1px_3px_rgba(9,9,11,0.1)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  )
}

export function ErrorHero({
  kind,
  title,
  body,
  children,
  below,
}: {
  kind: ErrorPageKind
  title: string
  body: string
  /** Page blocks, actions and the help line (ErrorHelp), in order. */
  children?: React.ReactNode
  /** Rendered under the hero (series cards). */
  below?: React.ReactNode
}) {
  const t = useTranslations("errors")
  const locale = useLocale()
  return (
    <>
      <section className="border-b bg-[#fafafa] bg-[image:radial-gradient(1200px_400px_at_20%_0%,#effcf4_0%,rgba(239,252,244,0)_70%)]">
        <div className="container">
          <div className="mx-auto grid max-w-[976px] grid-cols-[minmax(0,1fr)] items-center gap-5 pt-6 pb-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-9 md:pt-12 md:pb-14 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14 lg:pt-16 lg:pb-[72px]">
            <div className="flex h-[150px] w-full items-center justify-center rounded-[18px] border bg-white shadow-md md:h-[220px] md:w-60 md:rounded-3xl lg:h-[280px] lg:w-80">
              <ErrorArt kind={kind === "comingSoon" ? "maintenance" : kind} className="h-auto w-[150px] max-w-full md:w-[240px]" />
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant={BADGE[kind]} className="h-[22px] px-2">
                  {t(`codes.${kind}`)}
                </Badge>
                <ErrorLangToggle />
              </div>
              <h1
                className={cn(
                  "m-0 font-extrabold tracking-[-0.03em]",
                  locale === "km" ? "text-2xl md:text-[32px]" : "text-[28px] leading-[34px] md:text-[40px] md:leading-[46px]"
                )}
              >
                {title}
              </h1>
              <p className="m-0 max-w-[52ch] text-[15px] leading-6 text-muted-foreground md:text-base md:leading-[26px]">{body}</p>
              {children}
            </div>
          </div>
        </div>
      </section>
      {below}
    </>
  )
}

/** `.er-help`: rule, then small muted lines ("Reference …", "Need help? Help center · …"). */
export function ErrorHelp({ extra, children }: { extra?: React.ReactNode; children?: React.ReactNode }) {
  const t = useTranslations("errors")
  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-xs leading-4 text-muted-foreground">
      {children}
      <p>
        {t("needHelp")}{" "}
        <Link href="/help" className={helpLink}>
          {t("helpCenter")}
        </Link>
        {extra}
      </p>
    </div>
  )
}

/** " · Service status" (no status page yet: the Coming soon page). */
export function StatusLink() {
  const t = useTranslations("errors")
  return (
    <>
      {" · "}
      <Link href="/coming-soon?topic=status" className={helpLink}>
        {t("statusPage")}
      </Link>
    </>
  )
}

/** Retry result (`.alert.warn` "Still not working…" / `.alert.brand` "Fixed. Taking you back…"). */
export function ErrorStatus({ status, message }: { status: "" | "still" | "ok"; message: string }) {
  return (
    <div role="status" aria-live="polite" className={status ? undefined : "sr-only"}>
      {status ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-[10px] border px-4 py-3.5 text-[13px] leading-[19px]",
            status === "still" ? "border-warning-border bg-warning-soft text-warning-ink" : "border-brand-soft-border bg-brand-soft text-foreground"
          )}
        >
          {status === "still" ? (
            <AlertCircleIcon className="mt-px size-4 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2Icon className="mt-px size-4 shrink-0 text-brand-ink" aria-hidden />
          )}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  )
}

/** `.er-more`: "Popular right now" / "Similar series" cards (6 on desktop, 4 on tablet, 3 × 2 on phones). */
export function ErrorCards({
  title,
  series,
  loading,
  browseHref = "/search",
}: {
  title: string
  series: Series[]
  loading: boolean
  browseHref?: string
}) {
  const t = useTranslations("errors")
  if (!loading && series.length === 0) return null
  const cell = (i: number) => cn(i >= 4 && "md:max-lg:hidden")
  return (
    <section aria-labelledby="er-more-title" className="container flex flex-col gap-4 pt-7 pb-10 md:pt-10 md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="er-more-title" className="type-h3">
          {title}
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={browseHref}>
            {t("browseAll")}
            <ChevronRightIcon className="size-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
      <ul className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 lg:grid-cols-6" aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={cell(i)}>
                <Skeleton className="aspect-[3/4] w-full rounded-[10px]" />
                <Skeleton className="mt-2.5 h-4 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </li>
            ))
          : series.slice(0, 6).map((s, i) => (
              <li key={s.id} className={cell(i)}>
                <SeriesCard series={s} badges="novel" footer={null} sizes="(min-width: 1024px) 190px, (min-width: 768px) 25vw, 33vw" />
              </li>
            ))}
      </ul>
    </section>
  )
}
