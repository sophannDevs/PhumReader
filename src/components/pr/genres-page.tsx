"use client"

import { CircleAlertIcon as AlertCircleIcon } from "@/components/animate-ui/icons/circle-alert"
import { RefreshCwIcon } from "@/components/animate-ui/icons/refresh-cw"
import { SearchIcon } from "@/components/animate-ui/icons/search"
import { XIcon } from "@/components/animate-ui/icons/x"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { likesOf, replaceQuery, seedOf, useCatalog, viewsOf } from "@/components/pr/browse-kit"
import { NativeSelect } from "@/components/pr/settings-ui"
import { SkeletonCard } from "@/components/pr/skeletons"
import { Chip, Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WEEKDAYS, demoData, genres, type Genre, type Series, type Weekday } from "@/data"
import { Link } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { genreSlug, seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Num } from "@/i18n/num"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

type Format = "all" | "comic" | "novel"
type Status = "any" | "ongoing" | "completed"
type Sort = "popular" | "liked" | "updated" | "az"

const PAGE = 18
const GRID = "grid grid-cols-6 gap-x-5 gap-y-7 max-lg:grid-cols-4 max-md:grid-cols-3 max-md:gap-x-3 max-md:gap-y-5"

/** ?g= accepts the genre name ("Slice of life") or its slug ("slice-of-life"); anything else is All genres. */
function parseGenre(value: string | null): Genre | "All" {
  if (!value) return "All"
  const v = value.trim().toLowerCase()
  return genres().find((g) => g.toLowerCase() === v || genreSlug(g) === v) ?? "All"
}

const parseFormat = (value: string | null): Format => (value === "comic" || value === "novel" ? value : "all")

const COMPARE: Record<Sort, (a: Series, b: Series) => number> = {
  popular: (a, b) => viewsOf(b) - viewsOf(a),
  liked: (a, b) => likesOf(b) - likesOf(a),
  updated: (a, b) => Number(b.badges.up) - Number(a.badges.up) || seedOf(b.id) - seedOf(a.id),
  az: (a, b) => a.title.localeCompare(b.title),
}

/** Static-shell placeholder while the URL's query is read (Suspense fallback and loading.tsx). */
export function GenresFallback() {
  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16" aria-busy="true" aria-hidden>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-[640px]" />
      <div className={GRID}>
        {Array.from({ length: 12 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * Genres / Web novels (spec §11, prototype Genres) on /genres?g=&format=: genre chips with counts, a coloured
 * banner for one genre (demoData.genreInfo: background, ink; description in messages; count; 3 covers), filters for
 * format, status, update day and sort, "Clear filters (N)", a 6 / 4 / 3 column grid with "Show more" (18 at a time)
 * and an empty state. Genre and format live in the URL (the header's "Web novels" is ?format=novel); status, day
 * and sort are page state.
 */
export function GenresPage() {
  const t = useTranslations("genresPage")
  const td = useTranslations("data")
  const loc = useLocalize()
  const params = useSearchParams()
  const genre = parseGenre(params.get("g"))
  const format = parseFormat(params.get("format"))
  const [status, setStatus] = useState<Status>("any")
  const [day, setDay] = useState<Weekday | "any">("any")
  const [sort, setSort] = useState<Sort>("popular")
  const catalog = useCatalog()

  const key = [genre, format, status, day].join("|")
  const [more, setMore] = useState({ key, n: PAGE })
  const shown = more.key === key ? more.n : PAGE

  const match = (s: Series, ignoreGenre = false) =>
    (ignoreGenre || genre === "All" || s.genre === genre) &&
    !(format === "comic" && s.type === "novel") &&
    !(format === "novel" && s.type !== "novel") &&
    !(status === "completed" && s.status !== "completed") &&
    !(status === "ongoing" && s.status === "completed") &&
    (day === "any" || s.updateDays.includes(day))

  const pool = catalog.series
  const list = pool.filter((s) => match(s)).sort(COMPARE[sort])
  const visible = list.slice(0, shown)
  const filterCount = Number(format !== "all") + Number(status !== "any") + Number(day !== "any")
  const ready = !catalog.isPending && !catalog.isError
  const novelsPage = format === "novel"

  const clearFilters = () => {
    setStatus("any")
    setDay("any")
    replaceQuery({ format: null })
  }

  return (
    <div className="container flex flex-col gap-5 pt-7 pb-16">
      <Effect asChild fade slide={{ direction: "up", offset: 8 }}>
        <div className="flex flex-col gap-1">
          <h1 className="type-h1">{novelsPage ? t("novelsTitle") : t("title")}</h1>
          <p className="text-[15px] leading-[26px] text-muted-foreground">{novelsPage ? t("novelsLead") : t("lead")}</p>
        </div>
      </Effect>

      <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={80}>
        <div
          role="radiogroup"
          aria-label={t("genres")}
          className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]"
        >
          {(["All", ...genres()] as const).map((g) => (
            <Chip
              key={g}
              role="radio"
              selected={genre === g}
              onClick={() => replaceQuery({ g: g === "All" ? null : g })}
              count={ready ? pool.filter((s) => (g === "All" || s.genre === g) && match(s, true)).length : undefined}
            >
              {g === "All" ? t("allGenres") : loc.genre(g)}
            </Chip>
          ))}
        </div>
      </Effect>

      {genre !== "All" ? <Banner genre={genre} series={pool.filter((s) => s.genre === genre)} ready={ready} /> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          label={t("formatLabel")}
          value={format}
          onChange={(v) => replaceQuery({ format: v === "all" ? null : v })}
          options={(["all", "comic", "novel"] as const).map((v) => ({ value: v, label: t(`formats.${v}`) }))}
          className="max-md:flex max-md:w-full max-md:[&>button]:flex-1"
        />
        <NativeSelect
          aria-label={t("statusLabel")}
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          wrapperClassName="md:w-auto md:min-w-[150px] max-md:flex-1"
        >
          {(["any", "ongoing", "completed"] as const).map((v) => (
            <option key={v} value={v}>
              {t(`status.${v}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("dayLabel")}
          value={day}
          onChange={(e) => setDay(e.target.value as Weekday | "any")}
          wrapperClassName="md:w-auto md:min-w-[150px] max-md:flex-1"
        >
          <option value="any">{t("anyDay")}</option>
          {WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {td(`dayFull.${d}`)}
            </option>
          ))}
        </NativeSelect>
        <label className="ml-auto flex items-center gap-2 max-md:ml-0 max-md:w-full">
          <span className="text-[13px] leading-[18px] whitespace-nowrap text-muted-foreground">{t("sortLabel")}</span>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} wrapperClassName="md:w-auto md:min-w-[150px] max-md:flex-1">
            {(["popular", "liked", "updated", "az"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`sort.${v}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className="text-[13px] leading-[18px] text-muted-foreground" role="status" aria-live="polite">
          {ready ? (genre === "All" ? t("count", { count: list.length }) : t("countIn", { count: list.length, genre: loc.genre(genre) })) : null}
        </span>
        {filterCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon className="size-3.5" aria-hidden />
            {t("clearFiltersCount", { count: filterCount })}
          </Button>
        ) : null}
      </div>

      {catalog.isPending ? (
        <div className={GRID} role="status" aria-label={t("loading")}>
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : catalog.isError ? (
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={t("errorTitle")}
          text={t("errorText")}
          action={
            <Button variant="outline" size="sm" onClick={catalog.refetch}>
              <RefreshCwIcon className="size-3.5" aria-hidden />
              {t("tryAgain")}
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card border bg-card px-5 py-12 text-center shadow-xs">
          <SearchIcon className="size-7 text-muted-foreground" aria-hidden />
          <h2 className="type-h3">{t("emptyTitle")}</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">{t("emptyText")}</p>
          <Button variant="outline" onClick={clearFilters}>
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <>
          <ul className={GRID}>
            {visible.map((s, i) => (
              <GenreCard key={s.id} series={s} index={i} />
            ))}
          </ul>
          {list.length > shown ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-[13px] leading-[18px] text-muted-foreground">{t("showing", { shown: visible.length, total: list.length })}</span>
              <Button variant="outline" onClick={() => setMore({ key, n: shown + PAGE })}>
                {t("showMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

/** `.gn-banner`: genre colours from demoData.genreInfo, "N series", name, description and three tilted covers. */
function Banner({ genre, series, ready }: { genre: Genre; series: Series[]; ready: boolean }) {
  const t = useTranslations("genresPage")
  const loc = useLocalize()
  const [, bg, ink] = demoData.genreInfo[genre] ?? ["", "#f4f4f5", "#047a3a"]
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }}>
      <section
        aria-labelledby="gn-banner-h"
        className="flex items-center justify-between gap-6 overflow-hidden rounded-2xl border border-[rgba(9,9,11,0.06)] text-[#09090b] px-7 py-6 max-md:gap-3 max-md:p-4"
        style={{ background: bg }}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="type-eyebrow" style={{ color: ink }}>
            {ready ? t("bannerCount", { count: series.length }) : " "}
          </p>
          <h2 id="gn-banner-h" className="type-h2">
            {loc.genre(genre)}
          </h2>
          <p className="max-w-[60ch] text-[13px] leading-[18px] text-[#3f3f46]">{t(`desc.${genre}`)}</p>
        </div>
        <div aria-hidden className="flex shrink-0 items-end pl-[18px] max-md:hidden">
          {series.slice(0, 3).map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "relative -ml-[18px] aspect-[3/4] w-[84px] overflow-hidden rounded-[10px] border-2 border-white shadow-[0_8px_20px_rgba(9,9,11,0.18)]",
                i === 1 && "mb-3"
              )}
            >
              <Image src={s.cover} alt="" fill sizes="84px" className="object-cover" />
            </span>
          ))}
        </div>
      </section>
    </Effect>
  )
}

/** `.s-card` for this grid: UP / Novel / Completed badges, title, creator and "Every Mon · ♥ 3.6M" (or Completed). */
function GenreCard({ series: s, index }: { series: Series; index: number }) {
  const t = useTranslations("genresPage")
  const tc = useTranslations("cards")
  const loc = useLocalize()
  const done = s.status === "completed"
  const novel = s.type === "novel"
  const lead = done ? t("completed") : loc.schedule(s)
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 40} inView>
      <li className="min-w-0">
        <Link
          href={seriesHref(s)}
          className="group flex min-w-0 flex-col gap-2.5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-muted">
            <Image
              src={s.cover}
              alt=""
              width={360}
              height={480}
              sizes="(min-width: 1280px) 190px, (min-width: 1024px) 16vw, (min-width: 768px) 25vw, 33vw"
              className="cover-zoom size-full object-cover"
            />
            {s.badges.up || novel || done ? (
              <div className="absolute top-2 right-2 left-2 flex flex-wrap gap-1">
                {s.badges.up ? <Badge variant="up">{tc("up")}</Badge> : null}
                {novel ? <Badge variant="dark">{tc("novel")}</Badge> : null}
                {done ? (
                  <Badge variant="secondary" className="max-md:hidden">
                    {t("completed")}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <h3 className="truncate text-sm leading-5 font-semibold max-md:text-[13px] max-md:leading-[18px]">{s.title}</h3>
            <p className="truncate text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">{s.creator}</p>
            <p className="truncate text-[13px] leading-[18px] text-muted-foreground max-md:text-xs">
              {lead ? `${lead} · ` : ""}
              <span aria-hidden>♥ </span>
              <span className="sr-only">{t("likes", { count: s.likes })}</span>
              <span aria-hidden><Num>{s.likes}</Num></span>
            </p>
          </div>
        </Link>
      </li>
    </Effect>
  )
}
