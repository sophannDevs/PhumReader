"use client"

import { AlertCircleIcon, RefreshCwIcon, SparklesIcon, TrendingUpIcon, TrophyIcon } from "lucide-react"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { toast } from "sonner"
import { RankRow } from "@/components/pr/rank-row"
import { SeriesCard } from "@/components/pr/series-card"
import { Chip, phoneSwipeRow, SectionHead, Segmented, StateBox } from "@/components/pr/v2-primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Genre, RankingEntry, Series } from "@/data"
import { useRouter } from "@/i18n/navigation"
import { useLocalize } from "@/lib/localize"
import { seriesHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

type State = "loading" | "error" | "empty" | "ready"

/** Trending now (left) and Browse by genre (right), one column on phones (spec §1, prototype `.rk-split`). */
export function TrendingAndGenres({
  rankings,
  genres,
  byGenre,
  state,
  onRetry,
}: {
  rankings: { comics: RankingEntry[]; novels: RankingEntry[] }
  genres: Genre[]
  byGenre: Record<Genre, Series[]>
  state: State
  onRetry: () => void
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 md:grid-cols-2 md:gap-8">
      <Trending rankings={rankings} state={state} onRetry={onRetry} />
      <Genres genres={genres} byGenre={byGenre} state={state} onRetry={onRetry} />
    </section>
  )
}

function Retry({ title, onRetry, className }: { title: string; onRetry: () => void; className?: string }) {
  const t = useTranslations("home")
  return (
    <StateBox
      icon={AlertCircleIcon}
      tone="bad"
      title={title}
      className={className}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon className="size-3.5" />
          {t("tryAgain")}
        </Button>
      }
    />
  )
}

function Trending({
  rankings,
  state,
  onRetry,
}: {
  rankings: { comics: RankingEntry[]; novels: RankingEntry[] }
  state: State
  onRetry: () => void
}) {
  const t = useTranslations("home")
  const [tab, setTab] = useState<"comics" | "novels">("comics")
  const list = rankings[tab].slice(0, 8)

  return (
    <div id="rank" aria-labelledby="rk-h" className="flex flex-col overflow-hidden rounded-card border bg-card shadow-xs">
      <div className="px-5 pt-5 pb-3 max-md:px-4 max-md:pt-4">
        <SectionHead
          id="rk-h"
          icon={TrendingUpIcon}
          title={t("trendingTitle")}
          subtitle={t("trendingSub")}
          className="items-center"
          action={
            <Segmented
              label={t("rankType")}
              value={tab}
              onChange={setTab}
              options={[
                { value: "comics", label: t("comics") },
                { value: "novels", label: t("novels") },
              ]}
            />
          }
        />
      </div>
      {state === "loading" ? (
        <div className="flex flex-col gap-2.5 px-5 pt-2 pb-5" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-[22px]" />
              <Skeleton className="h-[52px] w-10" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : state === "error" ? (
        <Retry title={t("rankError")} onRetry={onRetry} className="mx-5 mb-5" />
      ) : list.length === 0 ? (
        <StateBox icon={TrophyIcon} title={t("rankEmpty")} className="mx-5 mb-5" />
      ) : (
        <ol className="flex flex-col px-2 pt-1 pb-2">
          {list.map((r) => (
            <li key={r.series.id}>
              <RankRow rank={r.rank} series={r.series} movement={r.movement} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Genres({
  genres,
  byGenre,
  state,
  onRetry,
}: {
  genres: Genre[]
  byGenre: Record<Genre, Series[]>
  state: State
  onRetry: () => void
}) {
  const t = useTranslations("home")
  const loc = useLocalize()
  const router = useRouter()
  const [genre, setGenre] = useState<Genre>(genres.includes("Fantasy") ? "Fantasy" : genres[0])
  const all = byGenre[genre] ?? []

  const surprise = () => {
    if (all.length === 0) return
    const s = all[Math.floor(Math.random() * all.length)]
    toast(t("opening", { title: s.title }))
    setTimeout(() => router.push(seriesHref(s)), 350)
  }

  return (
    <div id="genres" aria-labelledby="gn-h" className="flex flex-col gap-3.5">
      <SectionHead
        id="gn-h"
        title={t("genreTitle")}
        subtitle={t("genreCount", { count: all.length, genre: loc.genre(genre) })}
        className="items-center"
        action={
          <Button variant="outline" size="sm" onClick={surprise} disabled={all.length === 0}>
            <SparklesIcon className="size-3.5" />
            {t("surprise")}
          </Button>
        }
      />
      <div
        role="radiogroup"
        aria-label={t("genreLabel")}
        className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none]"
      >
        {genres.map((g) => (
          <Chip key={g} role="radio" selected={g === genre} onClick={() => setGenre(g)} count={state === "ready" ? (byGenre[g] ?? []).length : undefined}>
            {loc.genre(g)}
          </Chip>
        ))}
      </div>
      {state === "error" ? (
        <Retry title={t("genreError")} onRetry={onRetry} />
      ) : state === "loading" ? (
        <div className={cn("grid grid-cols-3 gap-4", phoneSwipeRow, "max-md:auto-cols-[38%]")} aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-[10px]" />
          ))}
        </div>
      ) : (
        <div className={cn("grid grid-cols-3 gap-4", phoneSwipeRow, "max-md:auto-cols-[38%]")}>
          {all.slice(0, 6).map((s) => (
            <SeriesCard key={s.id} series={s} badges="novel" meta="creator" sizes="(min-width: 768px) 200px, 38vw" />
          ))}
        </div>
      )}
    </div>
  )
}
