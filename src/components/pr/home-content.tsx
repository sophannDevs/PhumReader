"use client"

import { useTranslations } from "@/i18n/translations"
import { ContinueReadingSection, ContinueReadingSkeleton } from "@/components/pr/continue-reading-section"
import { DailyUpdatesSection } from "@/components/pr/daily-updates-section"
import { ForYouSection } from "@/components/pr/home/for-you"
import { CreatorCta, NovelsSection } from "@/components/pr/home/novels-cta"
import { Spotlight, SpotlightSkeleton } from "@/components/pr/home/spotlight"
import { TrendingAndGenres } from "@/components/pr/home/trending-genres"
import { demoData, type Genre, type Series, type Weekday } from "@/data"
import { useHome } from "@/lib/queries"

const emptyDaily = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] } as Record<Weekday, Series[]>

/**
 * Home (spec §1, prototype Home): spotlight, Continue reading, genre picks / Recommended for you, Daily updates,
 * Trending now + Browse by genre, Web novels, creator CTA. While the feed loads (or fails) the data sections show
 * their own skeletons and Try again boxes, as in the prototype.
 */
export function HomeContent() {
  const home = useHome()
  const t = useTranslations("home")
  const data = home.data
  const state = home.isPending ? "loading" : home.isError ? "error" : data && isEmpty(data.daily) ? "empty" : "ready"
  const retry = () => void home.refetch()
  const genres: Genre[] = data?.genres ?? demoData.genres
  const byGenre = data?.byGenre ?? ({} as Record<Genre, Series[]>)
  const all = Object.values(byGenre).flat()

  return (
    <div className="container flex flex-col gap-12 pt-6 pb-[72px]">
      <h1 className="sr-only">{t("h1")}</h1>
      {home.isPending ? <SpotlightSkeleton /> : data && data.hero.length > 0 ? <Spotlight slides={data.hero} /> : null}
      {home.isPending ? <ContinueReadingSkeleton /> : <ContinueReadingSection entries={data?.continueReading ?? []} />}
      {data && all.length > 0 ? <ForYouSection genres={genres} all={all} /> : null}
      <DailyUpdatesSection daily={data?.daily ?? emptyDaily} state={state} onRetry={retry} />
      <TrendingAndGenres
        rankings={data?.rankings ?? { comics: [], novels: [] }}
        genres={genres}
        byGenre={byGenre}
        state={state}
        onRetry={retry}
      />
      {data ? <NovelsSection novels={data.novels} /> : null}
      <CreatorCta covers={data?.creatorCovers ?? []} />
    </div>
  )
}

const isEmpty = (daily: Record<Weekday, Series[]>) => Object.values(daily).every((l) => l.length === 0)
