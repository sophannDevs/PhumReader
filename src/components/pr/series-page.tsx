"use client"

import { notFound, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Tabs as TabsPrimitive } from "radix-ui"
import { useRef, useState } from "react"
import { CommentsSection } from "@/components/pr/comments-section"
import { EpisodesTab } from "@/components/pr/episodes-tab"
import { ErrorState } from "@/components/pr/error-state"
import { SeriesAbout } from "@/components/pr/series-about"
import { SeriesHero, SeriesStickyBar } from "@/components/pr/series-hero"
import { SeriesSidebar } from "@/components/pr/series-sidebar"
import { SeriesUnavailable } from "@/components/pr/series-unavailable"
import { useSeriesUnlock } from "@/components/pr/series-unlock"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Series } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import { useAccountEmail, useSubscriptions } from "@/lib/me"
import { useSeries } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"

export function SeriesSkeleton() {
  return (
    <div aria-hidden>
      <div className="bg-surface">
        <div className="container grid grid-cols-[minmax(0,1fr)] gap-4 pt-4 pb-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-end md:gap-x-10 md:pt-6 md:pb-10">
          <Skeleton className="h-4 w-48 bg-surface-panel md:col-span-2" />
          <Skeleton className="aspect-[3/4] w-[132px] rounded-[10px] bg-surface-panel md:w-60 md:rounded-[14px]" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-56 bg-surface-panel" />
            <Skeleton className="h-10 w-3/4 bg-surface-panel" />
            <Skeleton className="h-4 w-full bg-surface-panel" />
            <Skeleton className="h-4 w-2/3 bg-surface-panel" />
            <Skeleton className="h-11 w-72 bg-surface-panel" />
          </div>
        </div>
      </div>
      <div className="container grid grid-cols-[minmax(0,1fr)] gap-7 pt-3 pb-[72px] md:gap-10 md:pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-80" />
          <Skeleton className="h-[74px] rounded-card" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )
}

/**
 * Series page (spec §2, screens 02-*): hero, underline tabs (Episodes / About / Comments), the sidebar, the
 * phone sticky "Continue" bar and the Unlock dialog. A series that is gone shows the unavailable state (spec §9):
 * `?demo=unavailable` in the demo; with the real API, a 404 for a series that is still in the reader's library.
 */
export function SeriesPage({ slug }: { slug: string }) {
  const query = useSeries(slug)
  const params = useSearchParams()
  const email = useAccountEmail()
  const subs = useSubscriptions()
  const fromLibrary = !DEMO_MODE && query.data === null ? subs.data?.find((s) => s.slug === slug) : undefined
  // Keep showing the gone series after "Remove from library" takes it out of the list.
  const [gone, setGone] = useState<Series | null>(null)
  if (fromLibrary && fromLibrary.id !== gone?.id) setGone(fromLibrary)

  if (query.isPending) return <SeriesSkeleton />
  if (query.isError) return <ErrorState className="container" onRetry={() => void query.refetch()} />
  if (!query.data) {
    if (gone) return <SeriesUnavailable series={gone} />
    if (!DEMO_MODE && email && subs.isPending) return <SeriesSkeleton />
    notFound()
  }
  if (DEMO_MODE && params.get("demo") === "unavailable") return <SeriesUnavailable series={query.data.series} />

  return <SeriesBody {...query.data} />
}

type Detail = NonNullable<ReturnType<typeof useSeries>["data"]>

const tabClass =
  "-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[state=active]:border-foreground data-[state=active]:text-foreground"

function SeriesBody({ series, synopsis, stats, related, creatorSeriesCount, creatorId }: Detail) {
  const t = useTranslations("series")
  const { request, dialog } = useSeriesUnlock(series)
  const heroRef = useRef<HTMLDivElement>(null)
  const novel = series.type === "novel"

  return (
    <>
      <div ref={heroRef}>
        <SeriesHero series={series} synopsis={synopsis} stats={stats} />
      </div>
      <div className="container grid grid-cols-[minmax(0,1fr)] items-start gap-7 pt-3 pb-[72px] md:gap-10 md:pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <TabsPrimitive.Root defaultValue="episodes" className="flex min-w-0 flex-col gap-5">
          <TabsPrimitive.List aria-label={t("tabsLabel")} className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsPrimitive.Trigger value="episodes" className={tabClass}>
              {t(novel ? "tabChapters" : "tabEpisodes")}
              <Badge variant="secondary" className="tabular-nums">
                {series.totalEpisodes}
              </Badge>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="about" className={tabClass}>
              {t("tabAbout")}
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="comments" className={tabClass}>
              {t("tabComments")}
              <Badge variant="secondary" className="tabular-nums">
                {stats.comments}
              </Badge>
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>
          <TabsPrimitive.Content value="episodes" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <EpisodesTab series={series} onUnlock={request} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="about" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <SeriesAbout series={series} synopsis={synopsis} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="comments" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <CommentsSection kind="series" slug={series.slug} count={stats.comments} seeAllHref={`${seriesHref(series)}/comments`} />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
        <SeriesSidebar series={series} related={related} creatorSeriesCount={creatorSeriesCount} creatorId={creatorId} />
      </div>
      <SeriesStickyBar series={series} heroRef={heroRef} />
      {dialog}
    </>
  )
}
