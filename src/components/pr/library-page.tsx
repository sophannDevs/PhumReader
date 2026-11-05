"use client"

import { BookOpenIcon, LockOpenIcon, LogInIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { ContinueCard } from "@/components/pr/continue-card"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { EpisodeList, EpisodeRow } from "@/components/pr/episode-row"
import { SeriesCard } from "@/components/pr/series-card"
import { SkeletonRow } from "@/components/pr/skeletons"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ContinueView, Series } from "@/data"
import { Link, usePathname } from "@/i18n/navigation"
import { useDemoFlag, useEpisodes, useLibrary } from "@/lib/queries"
import { useAppStore, useUser } from "@/lib/store"

const GRID = "grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5"

const NONE_LIST: string[] = []
const NONE_MAP: Record<string, number[]> = {}
const NONE_READ: Record<string, number> = {}

function BrowseButton() {
  const t = useTranslations("library")
  return (
    <Button asChild variant="outline">
      <Link href="/">{t("browse")}</Link>
    </Button>
  )
}

/** One series' unlocked episodes as rows (its own query for the episode list). */
function UnlockedGroup({ series, numbers }: { series: Series; numbers: number[] }) {
  const query = useEpisodes(series.slug)
  const episodes = (query.data ?? []).filter((e) => numbers.includes(e.n)).reverse()
  if (episodes.length === 0) return null
  return (
    <section aria-labelledby={`unlocked-${series.id}`} className="flex flex-col gap-3">
      <h3 id={`unlocked-${series.id}`} className="type-h4">
        <Link href={`/series/${series.slug}`} className="rounded-sm hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring">
          {series.title}
        </Link>
      </h3>
      <EpisodeList>
        {episodes.map((e) => (
          <EpisodeRow key={e.n} series={series} episode={e} state="unlocked" />
        ))}
      </EpisodeList>
    </section>
  )
}

/** My library: Continue reading, Subscribed and Unlocked (logged in only). */
export function LibraryPage() {
  const t = useTranslations("library")
  const user = useUser()
  const pathname = usePathname()
  const query = useLibrary()
  // ?demo=empty shows the empty tabs even when this device has reading history.
  const forcedEmpty = useDemoFlag() === "empty"
  const subscriptions = useAppStore((s) => (forcedEmpty ? NONE_LIST : s.subscriptions))
  const unlocked = useAppStore((s) => (forcedEmpty ? NONE_MAP : s.unlocked))
  const lastRead = useAppStore((s) => (forcedEmpty ? NONE_READ : s.lastRead))

  if (!user) {
    return (
      <div className="container py-10">
        <h1 className="type-h1">{t("title")}</h1>
        <EmptyState
          icon={LogInIcon}
          title={t("loginTitle")}
          description={t("loginDesc")}
          className="py-16"
          action={
            <Button asChild variant="brand" size="lg">
              <Link href="/login" onClick={() => useAppStore.getState().setReturnTo(pathname)}>
                {t("login")}
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  const byId = new Map((query.data?.series ?? []).map((s) => [s.id, s]))

  // Demo entries with the episode raised to `lastRead`, plus series the reader has opened that are not in the demo list.
  const entries: ContinueView[] = []
  if (query.data) {
    const seen = new Set<string>()
    for (const c of query.data.continueReading) {
      seen.add(c.seriesData.id)
      entries.push({ ...c, episode: Math.max(c.episode, lastRead[c.seriesData.id] ?? 0) })
    }
    for (const [id, n] of Object.entries(lastRead)) {
      const s = byId.get(id)
      if (s && !seen.has(id) && n > 0) {
        entries.push({ series: s.slug, seriesData: s, episode: n, progress: Math.min(1, n / s.totalEpisodes) })
      }
    }
  }
  const subscribed = subscriptions.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
  const unlockedGroups = Object.entries(unlocked).flatMap(([id, nums]) =>
    byId.get(id) && nums.length ? [{ series: byId.get(id)!, numbers: nums }] : []
  )

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <h1 className="type-h1">{t("title")}</h1>
      <Tabs defaultValue="continue" className="gap-6">
        <TabsList aria-label={t("tabs")} className="w-full max-w-md">
          <TabsTrigger value="continue">{t("tabContinue")}</TabsTrigger>
          <TabsTrigger value="subscribed">{t("tabSubscribed")}</TabsTrigger>
          <TabsTrigger value="unlocked">{t("tabUnlocked")}</TabsTrigger>
        </TabsList>

        {query.isPending ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-card border p-3">
                <SkeletonRow thumb="h-16 w-12" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <>
            <TabsContent value="continue">
              {entries.length === 0 ? (
                <EmptyState icon={BookOpenIcon} title={t("emptyContinue")} description={t("emptyContinueDesc")} action={<BrowseButton />} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
                  {entries.map((e) => (
                    <ContinueCard key={e.seriesData.id} series={e.seriesData} episode={e.episode} progress={e.progress} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscribed">
              {subscribed.length === 0 ? (
                <EmptyState title={t("emptySubscribed")} description={t("emptySubscribedDesc")} action={<BrowseButton />} />
              ) : (
                <div className={GRID}>
                  {subscribed.map((s) => (
                    <SeriesCard key={s.id} series={s} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="unlocked">
              {unlockedGroups.length === 0 ? (
                <EmptyState icon={LockOpenIcon} title={t("emptyUnlocked")} description={t("emptyUnlockedDesc")} action={<BrowseButton />} />
              ) : (
                <div className="flex flex-col gap-6">
                  {unlockedGroups.map((g) => (
                    <UnlockedGroup key={g.series.id} series={g.series} numbers={g.numbers} />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

