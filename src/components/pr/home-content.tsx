"use client"

import { ErrorState } from "@/components/pr/error-state"
import { ContinueReadingSection, ContinueReadingSkeleton } from "@/components/pr/continue-reading-section"
import { DailyUpdatesSection, DailyUpdatesSkeleton } from "@/components/pr/daily-updates-section"
import { CreatorCta } from "@/components/pr/creator-cta"
import { GenreSection, GenreSkeleton } from "@/components/pr/genre-section"
import { HeroCarousel } from "@/components/pr/hero-carousel"
import { NovelsSection, NovelsSkeleton } from "@/components/pr/novels-section"
import { TrendingSection, TrendingSkeleton } from "@/components/pr/trending-section"
import { Skeleton } from "@/components/ui/skeleton"
import { useHome } from "@/lib/queries"

/** Home page body. Sections are added one task at a time (T20-T23); T46 completes their states. */
export function HomeContent() {
  const home = useHome()

  return (
    <div className="container flex flex-col gap-14 pt-6">
      {home.isPending ? (
        <>
          <Skeleton className="h-[560px] rounded-[16px] md:h-[470px] md:rounded-hero" />
          <ContinueReadingSkeleton />
          <DailyUpdatesSkeleton />
          <div className="grid gap-14 lg:grid-cols-2 lg:items-start lg:gap-8">
            <TrendingSkeleton />
            <GenreSkeleton />
          </div>
          <NovelsSkeleton />
        </>
      ) : home.isError ? (
        <ErrorState onRetry={() => void home.refetch()} />
      ) : (
        <>
          {home.data.hero.length > 0 ? <HeroCarousel slides={home.data.hero} /> : null}
          <ContinueReadingSection entries={home.data.continueReading} />
          <DailyUpdatesSection daily={home.data.daily} />
          <div className="grid gap-14 lg:grid-cols-2 lg:items-start lg:gap-8">
            <TrendingSection comics={home.data.rankings.comics} novels={home.data.rankings.novels} />
            <GenreSection genres={home.data.genres} byGenre={home.data.byGenre} />
          </div>
          <NovelsSection novels={home.data.novels} />
          <CreatorCta covers={home.data.creatorCovers} />
        </>
      )}
    </div>
  )
}
