"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { ErrorState } from "@/components/pr/error-state"
import { SeriesAbout } from "@/components/pr/series-about"
import { SeriesHero } from "@/components/pr/series-hero"
import { SeriesSidebar } from "@/components/pr/series-sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSeries } from "@/lib/queries"

function SeriesSkeleton() {
  return (
    <div aria-hidden>
      <div className="bg-surface">
        <div className="container flex gap-8 py-8">
          <Skeleton className="aspect-[3/4] w-[132px] shrink-0 rounded-card bg-surface-panel md:w-60" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-6 w-56 bg-surface-panel" />
            <Skeleton className="h-10 w-3/4 bg-surface-panel" />
            <Skeleton className="h-4 w-full bg-surface-panel" />
            <Skeleton className="h-4 w-2/3 bg-surface-panel" />
          </div>
        </div>
      </div>
      <div className="container grid gap-10 py-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-80" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  )
}

/** Series page: hero, underline tabs (Episodes / About / Comments) and the sidebar. */
export function SeriesPage({ slug }: { slug: string }) {
  const t = useTranslations("series")
  const query = useSeries(slug)

  if (query.isPending) return <SeriesSkeleton />
  if (query.isError) return <ErrorState className="container" onRetry={() => void query.refetch()} />
  if (!query.data) notFound()

  const { series, synopsis, stats, related, creatorSeriesCount } = query.data
  const novel = series.type === "novel"

  return (
    <>
      <SeriesHero series={series} synopsis={synopsis} stats={stats} />
      <div className="container grid grid-cols-[minmax(0,1fr)] gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <Tabs defaultValue="episodes" className="min-w-0 gap-5">
          <TabsList variant="line">
            <TabsTrigger value="episodes">
              {t("tabEpisodes")} <TabsCount>{series.totalEpisodes}</TabsCount>
            </TabsTrigger>
            <TabsTrigger value="about">{t("tabAbout")}</TabsTrigger>
            <TabsTrigger value="comments">
              {t("tabComments")} <TabsCount>{stats.comments}</TabsCount>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="episodes">
            <p className="type-body text-muted-foreground">
              {series.totalEpisodes} {t(novel ? "chapters" : "episodes")} · {series.schedule}
            </p>
          </TabsContent>
          <TabsContent value="about">
            <SeriesAbout series={series} synopsis={synopsis} />
          </TabsContent>
          <TabsContent value="comments" />
        </Tabs>
        <SeriesSidebar series={series} related={related} creatorSeriesCount={creatorSeriesCount} />
      </div>
    </>
  )
}
