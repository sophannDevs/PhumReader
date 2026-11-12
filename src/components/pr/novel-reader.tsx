"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "@/i18n/translations"
import { EpisodeListPopover } from "@/components/layout/episode-list-popover"
import { NovelReaderBar } from "@/components/layout/reader-bar"
import { ReadingSettingsPopover } from "@/components/layout/reading-settings"
import { EmptyState } from "@/components/pr/empty-state"
import { ErrorState } from "@/components/pr/error-state"
import { FastPassLockCard } from "@/components/pr/fast-pass-lock-card"
import { NovelEndSection } from "@/components/pr/novel-end-section"
import { novelVars, useNovelSettings } from "@/components/pr/reader-theme"
import { ResumeChip } from "@/components/pr/resume-chip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { episodePrice, episodesCost, fastPassPrice, type Episode, type NovelBlock, type NovelChapter, type Series } from "@/data"
import { Link } from "@/i18n/navigation"
import { inlineMarks } from "@/lib/inline-marks"
import { useLocalize } from "@/lib/localize"
import { useChapter } from "@/lib/queries"
import { seriesHref } from "@/lib/routes"
import { type NovelSettings, useUser } from "@/lib/store"
import { useLockedEpisode, useReloadWhenUnlocked } from "@/lib/use-locked-redirect"
import { useReaderNav } from "@/lib/use-reader-nav"
import { useReadingPosition } from "@/lib/use-reading-position"
import { cn } from "@/lib/utils"

/** The reader root: theme tokens (`data-reader-theme` + the prototype's `.nr.sepia` / `.nr.dark`), text size and spacing. */
function NovelRoot({ settings, children, ...props }: { settings: NovelSettings; children: React.ReactNode } & React.ComponentProps<"div">) {
  return (
    <div
      data-reader-theme={settings.theme}
      style={
        {
          ...novelVars(settings.theme),
          "--novel-size": `${settings.size}px`,
          "--novel-leading": settings.wide ? 1.85 : 1.6,
        } as React.CSSProperties
      }
      className="flex flex-1 flex-col bg-reader-page text-reader-text"
      {...props}
    >
      {children}
    </div>
  )
}

export function NovelSkeleton() {
  const { settings } = useNovelSettings()
  return (
    <NovelRoot settings={settings} aria-hidden>
      <Skeleton className="h-14 rounded-none bg-accent" />
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-6 py-10 max-md:px-[18px] max-md:py-6">
        <Skeleton className="h-3 w-20 bg-accent" />
        <Skeleton className="h-9 w-2/3 bg-accent" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className={cn("h-4 bg-accent", i % 4 === 3 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    </NovelRoot>
  )
}

/**
 * Reading time from the chapter text: about 200 English words a minute. Khmer has no spaces between
 * words, so its letters are counted instead (about 1000 a minute). Never less than 1 minute.
 */
export function readMinutes(blocks: NovelBlock[]): number {
  const text = blocks.map((b) => ("text" in b ? b.text : "")).join(" ")
  const khmer = (text.match(/[ក-៿]/g) ?? []).length
  const words = text.replace(/[ក-៿]+/g, " ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200 + khmer / 1000))
}

/** Chapter body (prototype `.nr-text`): paragraphs, headings, italic quotes with a green rule, "* * *" scene breaks; **bold** and *italic* marks. */
export function NovelBody({ blocks }: { blocks: NovelBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "scene-break" ? (
          <div key={i} role="separator" className="my-[1.6em] text-center tracking-[0.6em] text-reader-quiet">
            * * *
          </div>
        ) : b.type === "heading" ? (
          <h2 key={i} className="mb-[0.6em] text-[1.25em] leading-snug font-semibold">
            {inlineMarks(b.text)}
          </h2>
        ) : b.type === "quote" ? (
          <blockquote key={i} className="mb-[1.15em] border-l-[3px] border-primary pl-4 italic">
            {inlineMarks(b.text)}
          </blockquote>
        ) : (
          <p key={i} className="mb-[1.15em]">
            {inlineMarks(b.text)}
          </p>
        )
      )}
    </>
  )
}

/**
 * Novel reader (spec §4, prototype Novel): themed page (light / sepia / dark, size, font, spacing; first visit from
 * Settings), bar with reading progress, resume chip, the chapter and its end, ← / → between chapters, and the Fast
 * Pass lock screen (two teaser paragraphs fading out, then the unlock card) for a locked chapter.
 */
export function NovelReader({ slug, n }: { slug: string; n: number }) {
  const query = useChapter(slug, n)
  const { settings } = useNovelSettings()
  const t = useTranslations("reader")
  const lock = useLockedEpisode(slug, n, query.error)

  if (query.isPending || (lock.locked && lock.pending)) return <NovelSkeleton />
  if (lock.locked && lock.series && lock.episode)
    return (
      <NovelRoot settings={settings}>
        <NovelReaderBody
          key={`${slug}:${n}`}
          series={lock.series}
          chapter={summaryChapter(lock.episode)}
          total={lock.total}
          font={settings.font}
          lockedByApi
          lockPrice={lock.episode.price}
          refetch={query.refetch}
        />
      </NovelRoot>
    )
  if (query.isError)
    return (
      <NovelRoot settings={settings}>
        <ErrorState
          className="flex-1 justify-center [&_p]:text-reader-quiet"
          onRetry={() => void query.refetch()}
          extra={
            <Button asChild variant="ghost" className="text-reader-text hover:bg-accent hover:text-reader-text">
              <Link href={`/series/${slug}`}>{t("backToSeries")}</Link>
            </Button>
          }
        />
      </NovelRoot>
    )
  if (!query.data) notFound()

  const { series, chapter, total } = query.data
  return (
    <NovelRoot settings={settings}>
      <NovelReaderBody key={`${slug}:${n}`} series={series} chapter={chapter} total={total} font={settings.font} refetch={query.refetch} />
    </NovelRoot>
  )
}

/** Real API, locked chapter (402): the chapter as the list knows it, without its text. */
const summaryChapter = (e: Episode): NovelChapter => ({
  n: e.n,
  title: e.title,
  name: e.title.replace(/^Chapter \d+:\s*/, ""),
  date: e.date,
  blocks: [],
  creatorNote: "",
  likes: e.likes,
})

type BodyProps = {
  series: Series
  chapter: NovelChapter
  total: number
  font: NovelSettings["font"]
  lockedByApi?: boolean
  /** Real API: the price the 402 named for this chapter */
  lockPrice?: number
  refetch: () => unknown
}

function NovelReaderBody(props: BodyProps) {
  const { series, chapter, total, lockedByApi = false, refetch } = props
  const nav = useReaderNav(series, chapter.n, total, { lockedByApi })
  useReloadWhenUnlocked(series, chapter.n, lockedByApi, refetch)
  if (nav.gated) return <NovelSkeleton />
  return <NovelReaderView {...props} nav={nav} />
}

type Nav = ReturnType<typeof useReaderNav>

const h1 = "mt-1.5 text-[30px] leading-[38px] font-bold tracking-[-0.02em] max-md:text-2xl max-md:leading-[30px]"

/** Mounted once the store and the chapter list are known (the saved place is read on mount). */
function NovelReaderView({ series, chapter, total, font, lockPrice, nav }: BodyProps & { nav: Nav }) {
  const t = useTranslations("reader")
  const loc = useLocalize()
  const user = useUser()
  const { settings } = useNovelSettings()
  const n = chapter.n
  const { go, list, listEpisodes, isLocked, coins, request, handOff, dialog, locked, finishRef } = nav
  const nextEpisode = list.find((e) => e.n === n + 1)
  const listed = list.find((e) => e.n === n)
  // This chapter at its own price (real API: the one its 402 named, else the list's); the demo's are all 5 coins.
  const here = listed && lockPrice != null ? { ...listed, price: lockPrice } : listed
  const price = episodePrice(here)
  const position = useReadingPosition({ seriesId: series.id, n, savePos: !locked })
  const lockedList = list.filter((e) => isLocked(e))
  const bundle = lockedList.length
  const textClass = cn("type-novel", font === "serif" && "font-novel")
  const btn = "text-reader-text hover:bg-accent hover:text-reader-text focus-visible:ring-offset-reader-page"

  return (
    <>
      <NovelReaderBar
        backHref={seriesHref(series)}
        seriesTitle={series.title}
        itemTitle={chapter.name}
        progress={locked ? 0 : position.pct}
        listSlot={
          <EpisodeListPopover
            readerTheme={settings.theme}
            episodes={listEpisodes}
            current={n}
            coins={coins}
            price={fastPassPrice()}
            onSelect={go}
            triggerClassName={btn}
          />
        }
        settingsSlot={<ReadingSettingsPopover triggerClassName={btn} />}
      />

      {!locked && position.resumeAt > 0 ? (
        <ResumeChip
          pct={position.resumeAt}
          onContinue={position.resume}
          onStartOver={position.startOver}
          className="border-border bg-background text-reader-text shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 pt-[51px] pb-20 max-md:px-[18px] max-md:pt-9 max-md:pb-16">
        {locked ? (
          <>
            <article aria-label={t("lockPreview", { title: chapter.name })} className={cn(textClass, "relative max-h-[420px] overflow-hidden")}>
              <p className="type-eyebrow">{t("chapterEyebrow", { n })}</p>
              <h1 className={h1}>{chapter.name}</h1>
              <NovelBody blocks={chapter.blocks.filter((b) => b.type === "paragraph").slice(0, 2)} />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-reader-page" />
            </article>
            <FastPassLockCard
              kind="chapter"
              className="-mt-5"
              title={chapter.name}
              n={n}
              freeDate={here?.date ?? chapter.date}
              price={price}
              coins={coins}
              loggedIn={!!user}
              bundle={bundle > 1 ? { count: bundle, cost: episodesCost(lockedList) } : null}
              onLogin={() => here && handOff("login", here)}
              onUnlock={() => here && request(here, "one")}
              onGetCoins={() => here && handOff("coins", here)}
              onUnlockAll={() => here && request(here, "all")}
              onBack={() => go(n - 1)}
              canGoBack={n > 1}
            />
          </>
        ) : (
          <>
            <article className={textClass}>
              <p className="type-eyebrow">{t("chapterEyebrow", { n })}</p>
              <h1 className={h1}>{chapter.name}</h1>
              <p className="mb-7 text-xs leading-4 text-reader-quiet">
                {series.creator} · {loc.date(chapter.date)} · {t("minRead", { count: readMinutes(chapter.blocks) })}
              </p>
              {chapter.blocks.length === 0 ? (
                <EmptyState title={t("noText")} description={t("noTextDesc")} className="[&_p]:text-reader-quiet" />
              ) : (
                <NovelBody blocks={chapter.blocks} />
              )}
            </article>
            <NovelEndSection
              finishRef={finishRef}
              series={series}
              chapter={chapter}
              total={total}
              price={episodePrice(nextEpisode)}
              nextLocked={!!nextEpisode && isLocked(nextEpisode)}
              onPrev={() => go(n - 1)}
              onNext={() => go(n + 1)}
            />
          </>
        )}
      </div>
      {dialog}
    </>
  )
}
