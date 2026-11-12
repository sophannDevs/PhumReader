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
import { Effect } from "@animate-ui/react/primitives/effects/effect"

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
      {/* Each section below the hero fades up as it scrolls into view. The hero stays instant (it is the LCP). */}
      {home.isPending ? (
        <ContinueReadingSkeleton />
      ) : (
        <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
          <ContinueReadingSection entries={data?.continueReading ?? []} />
        </Effect>
      )}
      {data && all.length > 0 ? (
        <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
          <ForYouSection genres={genres} all={all} />
        </Effect>
      ) : null}
      <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
        <DailyUpdatesSection daily={data?.daily ?? emptyDaily} state={state} onRetry={retry} />
      </Effect>
      <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
        <TrendingAndGenres
          rankings={data?.rankings ?? { comics: [], novels: [] }}
          genres={genres}
          byGenre={byGenre}
          state={state}
          onRetry={retry}
        />
      </Effect>
      {data ? (
        <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
          <NovelsSection novels={data.novels} />
        </Effect>
      ) : null}
      <Effect fade slide={{ direction: "up", offset: 16 }} inView inViewMargin="0px 0px -60px 0px">
        <CreatorCta covers={data?.creatorCovers ?? []} />
      </Effect>
    </div>
  )
}

const isEmpty = (daily: Record<Weekday, Series[]>) => Object.values(daily).every((l) => l.length === 0)
