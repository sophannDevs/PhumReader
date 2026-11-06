"use client"

import { ArrowUpDownIcon, ZapIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { EpisodeList, EpisodeRow, type EpisodeState } from "@/components/pr/episode-row"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { fastPassPrice, type Episode, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useEpisodes } from "@/lib/queries"
import { useSeriesViewer } from "@/lib/me"
import { useCoins } from "@/lib/store"

const PAGE = 12

/** Episodes tab: Fast Pass notice, count + sort, 12 rows at a time. Locked rows call `onLockedClick`. */
export function EpisodesTab({
  series,
  onLockedClick,
}: {
  series: Series
  onLockedClick: (episode: Episode) => void
}) {
  const t = useTranslations("series")
  const th = useTranslations("home")
  const coins = useCoins()
  const { lastRead, unlocked } = useSeriesViewer(series)
  const query = useEpisodes(series.slug)
  const [newestFirst, setNewestFirst] = useState(true)
  const [visible, setVisible] = useState(PAGE)
  const novel = series.type === "novel"
  const price = fastPassPrice()

  const sorted = useMemo(() => {
    const list = query.data ?? []
    return newestFirst ? [...list].reverse() : list
  }, [query.data, newestFirst])

  function stateOf(e: Episode): EpisodeState {
    if (e.access === "fastpass") return unlocked?.includes(e.n) ? "unlocked" : "locked"
    return e.n <= lastRead ? "read" : "free"
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="h-20 animate-pulse rounded-card bg-muted" />
        <div className="flex flex-col gap-4 rounded-card border p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />
  if (sorted.length === 0) {
    return <EmptyState title={t(novel ? "noChapters" : "noEpisodes")} description={t("noEpisodesDesc")} />
  }

  return (
    <div className="flex flex-col gap-5">
      {series.fastPassEpisodes > 0 ? (
        <Alert variant="brand" role="status" className="items-center sm:grid-cols-[auto_1fr_auto]">
          <ZapIcon />
          <AlertTitle>{t(novel ? "fastPassTitleChapter" : "fastPassTitle", { count: series.fastPassEpisodes })}</AlertTitle>
          <AlertDescription className="tabular-nums">{t("fastPassBody", { price, coins })}</AlertDescription>
          <Button asChild variant="outline" size="sm" className="bg-background max-sm:col-start-2 max-sm:mt-2 max-sm:w-fit sm:col-start-3 sm:row-span-2 sm:row-start-1">
            <Link href="/coins">{t("getCoins")}</Link>
          </Button>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="type-body text-muted-foreground tabular-nums">
          {series.updateDay
            ? t(novel ? "chaptersLine" : "episodesLine", {
                count: series.totalEpisodes,
                day: th(`days.${series.updateDay}`),
              })
            : t(novel ? "chaptersCount" : "episodesCount", { count: series.totalEpisodes })}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setNewestFirst((v) => !v)}>
          <ArrowUpDownIcon />
          {t(newestFirst ? "sortNewest" : "sortOldest")}
        </Button>
      </div>

      <EpisodeList>
        {sorted.slice(0, visible).map((e) => (
          <EpisodeRow
            key={e.n}
            series={series}
            episode={e}
            state={stateOf(e)}
            price={price}
            onLockedClick={onLockedClick}
          />
        ))}
      </EpisodeList>

      {visible < sorted.length ? (
        <Button variant="outline" className="w-full" onClick={() => setVisible((v) => v + PAGE)}>
          {t("showMore", { count: Math.min(PAGE, sorted.length - visible) })}
        </Button>
      ) : null}
    </div>
  )
}
