"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { EpisodeListPopover } from "@/components/layout/episode-list-popover"
import { NovelReaderBar } from "@/components/layout/reader-bar"
import { ReadingSettingsPopover } from "@/components/layout/reading-settings"
import { NovelEndSection } from "@/components/pr/novel-end-section"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { NovelBlock } from "@/data"
import { Link } from "@/i18n/navigation"
import { useChapter } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { useAppStore } from "@/lib/store"
import { useLockedRedirect } from "@/lib/use-locked-redirect"
import { useReaderNav } from "@/lib/use-reader-nav"
import { cn } from "@/lib/utils"
import { useLocalize } from "@/lib/localize"

export function NovelSkeleton() {
  const theme = useAppStore((s) => s.novelSettings.theme)
  return (
    <div className="flex flex-1 flex-col bg-reader-page" data-reader-theme={theme} aria-hidden>
      <Skeleton className="h-14 rounded-none" />
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 py-12">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-2/3" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 4 === 3 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    </div>
  )
}

// The demo text is the same for every chapter; the design shows "6 min read".
const READ_MINUTES = 6

/** Chapter body: paragraphs, italic quotes with a green rule, centred "* * *" scene breaks. */
export function NovelBody({ blocks }: { blocks: NovelBlock[] }) {
  return (
    <div className="flex flex-col gap-[1.1em]">
      {blocks.map((b, i) =>
        b.type === "scene-break" ? (
          <p key={i} aria-hidden className="py-2 text-center tracking-[1em] text-reader-quiet">
            * * *
          </p>
        ) : b.type === "quote" ? (
          <blockquote key={i} className="border-l-[3px] border-primary pl-4 italic">
            {b.text}
          </blockquote>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
  )
}

/** Novel reader: themed page (settings from the store), 720 px column, chapter bar and navigation. */
export function NovelReader({ slug, n }: { slug: string; n: number }) {
  const query = useChapter(slug, n)
  const settings = useAppStore((s) => s.novelSettings)
  const t = useTranslations("reader")
  // Real API: a locked chapter (402) goes to the series page with the unlock dialog.
  const locked = useLockedRedirect(slug, n, query.error)

  if (query.isPending || locked) return <NovelSkeleton />
  if (query.isError)
    return (
      <div data-reader-theme={settings.theme} className="flex flex-1 flex-col bg-reader-page text-reader-text">
        <ErrorState
          className="flex-1 justify-center [&_p]:text-reader-quiet"
          onRetry={() => void query.refetch()}
          extra={
            <Button asChild variant="ghost">
              <Link href={`/series/${slug}`}>{t("backToSeries")}</Link>
            </Button>
          }
        />
      </div>
    )
  if (!query.data) notFound()

  const { series, chapter, total } = query.data
  return (
    <div
      data-reader-theme={settings.theme}
      style={
        {
          "--novel-size": `${settings.size}px`,
          "--novel-leading": settings.wide ? 1.85 : 1.6,
        } as React.CSSProperties
      }
      className="flex flex-1 flex-col bg-reader-page text-reader-text"
    >
      <NovelReaderBody series={series} chapter={chapter} total={total} font={settings.font} />
    </div>
  )
}

type Loaded = NonNullable<ReturnType<typeof useChapter>["data"]>

function NovelReaderBody({ series, chapter, total, font }: Loaded & { font: "sans" | "serif" }) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const n = chapter.n
  const { go, list, listEpisodes, isLocked, coins, dialog, gated } = useReaderNav(series, n, total)
  if (gated) return <NovelSkeleton />
  const nextEpisode = list.find((e) => e.n === n + 1)

  return (
    <>
      <NovelReaderBar
        backHref={seriesHref(series)}
        seriesTitle={series.title}
        itemTitle={chapter.name}
        progress={n / total}
        prevDisabled={n <= 1}
        nextDisabled={n >= total}
        onPrev={() => go(n - 1)}
        onNext={() => go(n + 1)}
        listSlot={<EpisodeListPopover tone="themed" kind="chapter" episodes={listEpisodes} current={n} coins={coins} onSelect={go} />}
        trailingSlot={<ReadingSettingsPopover />}
      />
      <article className="mx-auto w-full max-w-[720px] px-4 pt-12 pb-16">
        <header className="mb-8 flex flex-col gap-2">
          <p className="type-eyebrow">{t("chapterEyebrow", { n })}</p>
          <h1 className="type-h1">{chapter.name}</h1>
          <p className="type-small font-normal text-reader-quiet">
            {series.creator} · {loc.date(chapter.date)} · {t("minRead", { count: READ_MINUTES })}
          </p>
        </header>
        {chapter.blocks.length === 0 ? (
          <EmptyState title={t("noText")} description={t("noTextDesc")} />
        ) : (
          <div className={cn("type-novel", font === "serif" && "font-novel")}>
            <NovelBody blocks={chapter.blocks} />
          </div>
        )}
        <NovelEndSection
          series={series}
          chapter={chapter}
          total={total}
          nextLocked={!!nextEpisode && isLocked(nextEpisode)}
          onPrev={() => go(n - 1)}
          onNext={() => go(n + 1)}
        />
      </article>
      {dialog}
    </>
  )
}
