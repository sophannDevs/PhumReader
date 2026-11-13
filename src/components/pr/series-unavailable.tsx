"use client"

import { BookOpenIcon } from "@/components/animate-ui/icons/book-open"
import { ChevronRightIcon } from "@/components/animate-ui/icons/chevron-right"
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import { LangPills } from "@/components/layout/language-switch"
import { ART, art } from "@/components/pr/error-art"
import { SeriesCard } from "@/components/pr/series-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useSubscribe } from "@/lib/me"
import { useGenre, useRankings } from "@/lib/queries"
import { genreHref } from "@/lib/routes"
import { useLocalize } from "@/lib/localize"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/** Open book with a padlock (prototype Error page, "unavailable" illustration). */
function LockedBookArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" width="240" height="200" fill="none" aria-hidden className={className}>
      <path
        d="M120 46c-22-14-56-16-84-8v118c28-8 62-6 84 8 22-14 56-16 84-8V38c-28-8-62-6-84 8z"
        strokeWidth="3"
        strokeLinejoin="round"
        style={art(ART.paper, ART.ink)}
      />
      <path d="M120 46v118" strokeWidth="3" style={art(undefined, ART.ink)} />
      <rect x="96" y="96" width="48" height="40" rx="8" fill="#FDE68A" strokeWidth="3" style={art(undefined, ART.ink)} />
      <path d="M106 96V84a14 14 0 0 1 28 0v12" strokeWidth="3" style={art(undefined, ART.ink)} />
      <circle cx="120" cy="114" r="4" style={art(ART.ink)} />
    </svg>
  )
}

/**
 * Series unavailable (spec §9 "Unavailable", screens 09-error-unavailable-*), shown inside /series/[slug]: the
 * illustration, "Not available" badge, English / ខ្មែរ toggle, the series card with "Remove from library" when it is in
 * the reader's library, Go to Home / My library, help link, and "Similar series you can read" (same genre first).
 */
export function SeriesUnavailable({ series }: { series: Series }) {
  const t = useTranslations("series")
  const loc = useLocalize()
  const { subscribed, toggle } = useSubscribe(series)
  const genre = useGenre(series.genre)
  const popular = useRankings("comics")

  const similar = [
    ...(genre.data?.series ?? []).filter((s) => s.id !== series.id),
    ...(popular.data ?? []).map((r) => r.series).filter((s) => s.id !== series.id && s.genre !== series.genre),
  ].slice(0, 6)

  return (
    <>
      <section className="border-b bg-subtle bg-[image:radial-gradient(1200px_400px_at_20%_0%,var(--brand-wash-from)_0%,transparent_70%)]">
        <div className="container">
          <div className="mx-auto grid max-w-[976px] grid-cols-[minmax(0,1fr)] items-center gap-5 pt-6 pb-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-9 md:pt-12 md:pb-14 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-14 lg:pt-16 lg:pb-[72px]">
            <Effect asChild fade zoom={{ initialScale: 0.92 }}>
              <div className="flex h-[150px] w-full items-center justify-center rounded-[18px] border bg-card shadow-md md:h-[220px] md:w-60 md:rounded-3xl lg:h-[280px] lg:w-80">
                <LockedBookArt className="h-auto w-[150px] max-w-full md:w-[240px]" />
              </div>
            </Effect>

            <Effect asChild fade slide={{ direction: "up", offset: 12 }} delay={100}>
              <div className="flex min-w-0 flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{t("unavailableBadge")}</Badge>
                  <LangPills label={t("language")} />
                </div>
                <h1 className="m-0 text-[28px] leading-[34px] font-extrabold tracking-[-0.03em] md:text-[40px] md:leading-[46px]">
                  {t("unavailableTitle")}
                </h1>
                <p className="m-0 max-w-[52ch] text-[15px] leading-6 text-muted-foreground md:text-base md:leading-[26px]">{t("unavailableBody")}</p>

                <div className="flex items-center gap-3 rounded-card border bg-background py-2.5 pr-3 pl-2.5">
                  <Image
                    src={series.cover}
                    alt=""
                    width={96}
                    height={128}
                    sizes="48px"
                    className="h-16 w-12 shrink-0 rounded-md object-cover opacity-60 grayscale"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] leading-[18px] font-semibold">{series.title}</span>
                    <span className="truncate text-xs leading-4 text-muted-foreground">
                      {series.creator} · {loc.genre(series.genre)}
                    </span>
                    <span className="text-xs leading-4 text-muted-foreground">{t(subscribed ? "inLibrary" : "notInLibrary")}</span>
                  </div>
                  {subscribed ? (
                    <Button variant="outline" size="sm" onClick={() => void toggle()}>
                      {t("removeFromLibrary")}
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button animateIcon asChild variant="brand" size="lg" className="max-md:flex-1">
                    <Link href="/">
                      <HomeIcon />
                      {t("goHome")}
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="max-md:flex-1">
                    <Link href="/library">
                      <BookOpenIcon />
                      {t("myLibrary")}
                    </Link>
                  </Button>
                </div>

                <p className="border-t pt-3 text-xs leading-4 text-muted-foreground">
                  {t("needHelp")}{" "}
                  <Link
                    href="/help"
                    className="rounded-sm font-semibold text-brand-ink underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("helpCenter")}
                  </Link>
                </p>
              </div>
            </Effect>
          </div>
        </div>
      </section>

      {similar.length > 0 ? (
        <section aria-labelledby="similar-title" className="container flex flex-col gap-4 pt-7 pb-10 md:pt-10 md:pb-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="similar-title" className="type-h3">
              {t("similarTitle")}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={genreHref(series.genre)}>
                {t("browseAll")}
                <ChevronRightIcon className="size-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 lg:grid-cols-6">
            {similar.map((s, i) => (
              <li key={s.id} className={cn(i >= 4 && "md:max-lg:hidden")}>
                <SeriesCard series={s} badges="novel" footer={null} sizes="(min-width: 1024px) 190px, (min-width: 768px) 25vw, 33vw" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
