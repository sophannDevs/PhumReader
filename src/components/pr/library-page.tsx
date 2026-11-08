"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BookOpenIcon, HeartIcon, LockOpenIcon, LogInIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { toast } from "sonner"
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
import { DEMO_MODE } from "@/lib/api/config"
import * as real from "@/lib/api/me"
import { meKeys, useAccountEmail, useFailed, useSubscriptions } from "@/lib/me"
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

/** A card with a small Remove button in its corner (real API only: the demo keeps its fixed lists). */
function Removable({ title, onRemove, children }: { title: string; onRemove: (() => void) | undefined; children: ReactNode }) {
  const t = useTranslations("library")
  if (!onRemove) return <>{children}</>
  return (
    <div className="relative min-w-0">
      {children}
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={t("remove", { title })}
        className="absolute top-1 right-1 size-6 rounded-full opacity-90 shadow-xs hover:opacity-100"
        onClick={onRemove}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}

/** One series' unlocked episodes as rows (its own query for the episode list). */
function UnlockedGroup({ series, numbers }: { series: Series; numbers: number[] }) {
  const query = useEpisodes(series.slug)
  const episodes = (query.data ?? []).filter((e) => numbers.includes(e.n)).reverse()
  if (episodes.length === 0) return null
  return (
    <section aria-labelledby={`unlocked-${series.id}`} className="flex flex-col gap-3">
      <h2 id={`unlocked-${series.id}`} className="type-h4">
        <Link href={`/series/${series.slug}`} className="rounded-sm hover:text-brand-ink focus-visible:ring-2 focus-visible:ring-ring">
          {series.title}
        </Link>
      </h2>
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
  const demoQuery = useLibrary()
  const email = useAccountEmail()
  const qc = useQueryClient()
  const tt = useTranslations("toasts")
  const failed = useFailed()
  const enabled = !DEMO_MODE && !!email
  const history = useQuery({ queryKey: meKeys.history(email ?? ""), queryFn: real.fetchHistory, enabled })
  const subs = useSubscriptions()
  const unlockedQuery = useQuery({ queryKey: meKeys.unlocked(email ?? ""), queryFn: real.fetchUnlocked, enabled })
  // One status for the page: the demo's single query, or the three lists of the real API.
  const parts = DEMO_MODE ? [demoQuery] : [history, subs, unlockedQuery]
  const query = {
    isPending: parts.some((q) => q.isPending),
    isError: parts.some((q) => q.isError),
    refetch: () => Promise.all(parts.map((q) => q.refetch())),
  }
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

  const demoResult = demoQuery.data
  const byId = new Map((demoResult?.series ?? []).map((s) => [s.id, s]))

  // Demo entries with the episode raised to `lastRead`, plus series the reader has opened that are not in the demo list.
  const demoEntries: ContinueView[] = []
  if (demoResult) {
    const seen = new Set<string>()
    for (const c of demoResult.continueReading) {
      seen.add(c.seriesData.id)
      demoEntries.push({ ...c, episode: Math.max(c.episode, lastRead[c.seriesData.id] ?? 0) })
    }
    for (const [id, n] of Object.entries(lastRead)) {
      const s = byId.get(id)
      if (s && !seen.has(id) && n > 0) {
        demoEntries.push({ series: s.slug, seriesData: s, episode: n, progress: Math.min(1, n / s.totalEpisodes) })
      }
    }
  }
  const demoSubscribed = subscriptions.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []))
  const demoGroups = Object.entries(unlocked).flatMap(([id, nums]) =>
    byId.get(id) && nums.length ? [{ series: byId.get(id)!, numbers: nums }] : []
  )

  const entries = DEMO_MODE ? demoEntries : (history.data ?? [])
  const subscribed = DEMO_MODE ? demoSubscribed : (subs.data ?? [])
  const unlockedGroups = DEMO_MODE ? demoGroups : (unlockedQuery.data ?? [])

  /** Takes a series out of a list now; the toast's Undo puts it back. */
  async function removeFrom(
    list: "history" | "subscriptions",
    series: Series,
    remove: () => Promise<unknown>,
    restore: (removed: never) => Promise<unknown>
  ) {
    if (!email) return
    const key = list === "history" ? meKeys.history(email) : meKeys.subscriptions(email)
    await qc.cancelQueries({ queryKey: key })
    const before = qc.getQueryData<(Series | ContinueView)[]>(key)
    qc.setQueryData(
      key,
      before?.filter((x) => ("seriesData" in x ? x.seriesData.id : x.id) !== series.id)
    )
    try {
      const removed = await remove()
      toast(tt("removedFromLibrary", { title: series.title }), {
        action: {
          label: tt("undo"),
          onClick: () =>
            void restore(removed as never)
              .catch(failed)
              .finally(() => void qc.invalidateQueries({ queryKey: key })),
        },
      })
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    }
  }

  const removeContinue = DEMO_MODE
    ? undefined
    : (series: Series) => removeFrom("history", series, () => real.removeFromHistory(series.id), real.restoreHistory)
  const removeSubscribed = DEMO_MODE
    ? undefined
    : (series: Series) => removeFrom("subscriptions", series, () => real.removeSubscription(series.id), real.restoreSubscriptions)

  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <h1 className="type-h1">{t("title")}</h1>
      <Tabs defaultValue="continue" className="gap-6">
        <TabsList aria-label={t("tabs")} className="w-full max-w-md">
          <TabsTrigger value="continue" className="min-w-0 px-1.5 max-[359px]:text-[13px] sm:px-3">{t("tabContinue")}</TabsTrigger>
          <TabsTrigger value="subscribed" className="min-w-0 px-1.5 max-[359px]:text-[13px] sm:px-3">{t("tabSubscribed")}</TabsTrigger>
          <TabsTrigger value="unlocked" className="min-w-0 px-1.5 max-[359px]:text-[13px] sm:px-3">{t("tabUnlocked")}</TabsTrigger>
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
                    <Removable key={e.seriesData.id} title={e.seriesData.title} onRemove={removeContinue && (() => void removeContinue(e.seriesData))}>
                      <ContinueCard series={e.seriesData} episode={e.episode} progress={e.progress} />
                    </Removable>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscribed">
              {subscribed.length === 0 ? (
                <EmptyState icon={HeartIcon} title={t("emptySubscribed")} description={t("emptySubscribedDesc")} action={<BrowseButton />} />
              ) : (
                <div className={GRID}>
                  {subscribed.map((s) => (
                    <Removable key={s.id} title={s.title} onRemove={removeSubscribed && (() => void removeSubscribed(s))}>
                      <SeriesCard series={s} />
                    </Removable>
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

