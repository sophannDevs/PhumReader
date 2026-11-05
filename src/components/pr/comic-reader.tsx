"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { EpisodeListPopover } from "@/components/layout/episode-list-popover"
import { ComicReaderBar } from "@/components/layout/reader-bar"
import { ComicEndSection } from "@/components/pr/comic-end-section"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Episode, Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { useEpisode } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { useReaderNav } from "@/lib/use-reader-nav"
import { useLocalize } from "@/lib/localize"

export function ReaderSkeleton() {
  return (
    <div className="flex-1 bg-surface" aria-hidden>
      <Skeleton className="h-14 rounded-none bg-surface-panel" />
      <div className="mx-auto flex max-w-[800px] flex-col">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[420px] rounded-none bg-surface-panel" />
        ))}
      </div>
    </div>
  )
}

/** Comic reader: dark page, bar, 800 px image strip. Locked episodes open the UnlockDialog. */
export function ComicReader({ slug, n }: { slug: string; n: number }) {
  const query = useEpisode(slug, n)
  const t = useTranslations("reader")

  if (query.isPending) return <ReaderSkeleton />
  if (query.isError)
    return (
      <ErrorState
        className="flex-1 bg-surface text-surface-foreground [&_p]:text-surface-foreground/70"
        onRetry={() => void query.refetch()}
        extra={
          <Button asChild variant="ghost" className="hover:bg-surface-panel hover:text-surface-foreground">
            <Link href={`/series/${slug}`}>{t("backToSeries")}</Link>
          </Button>
        }
      />
    )
  if (!query.data) notFound()
  return <ComicReaderBody series={query.data.series} episode={query.data.episode} total={query.data.total} panels={query.data.panels} />
}

type Data = NonNullable<ReturnType<typeof useEpisode>["data"]>

function ComicReaderBody({ series, episode, total, panels }: { series: Series; episode: Episode; total: number; panels: Data["panels"] }) {
  const n = episode.n
  const t = useTranslations("reader")
  const loc = useLocalize()
  const { go, list, listEpisodes, isLocked, coins, dialog, gated } = useReaderNav(series, n, total)
  if (gated) return <ReaderSkeleton />

  return (
    <div className="flex flex-1 flex-col bg-surface text-surface-foreground">
      <ComicReaderBar
        backHref={seriesHref(series)}
        seriesTitle={series.title}
        itemTitle={loc.title(episode.title)}
        progress={n / total}
        prevDisabled={n <= 1}
        nextDisabled={n >= total}
        onPrev={() => go(n - 1)}
        onNext={() => go(n + 1)}
        listSlot={<EpisodeListPopover episodes={listEpisodes} current={n} coins={coins} onSelect={go} />}
      />
      <article className="mx-auto w-full max-w-[800px] bg-white">
        {panels.length === 0 ? (
          <EmptyState title={t("noPages")} description={t("noPagesDesc")} className="min-h-[50vh] justify-center bg-surface text-surface-foreground [&_p]:text-surface-foreground/70" />
        ) : null}
        {panels.map((p, i) => (
          <Image
            key={p.src}
            src={p.src}
            alt={p.alt}
            width={p.width}
            height={p.height}
            sizes="(min-width: 800px) 800px, 100vw"
            priority={i < 2}
            className="block h-auto w-full"
          />
        ))}
      </article>
      <ComicEndSection
        series={series}
        episode={episode}
        next={list.find((e) => e.n === n + 1)}
        nextLocked={(() => {
          const nx = list.find((e) => e.n === n + 1)
          return !!nx && isLocked(nx)
        })()}
        onUnlockNext={() => go(n + 1)}
      />
      {dialog}
    </div>
  )
}
