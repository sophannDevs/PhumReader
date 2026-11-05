import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

const tones = {
  // comic reader: always dark
  dark: {
    bar: "bg-surface text-surface-foreground border-surface-border",
    quiet: "text-surface-quiet",
    track: "bg-surface-border-strong",
    button: "text-surface-foreground hover:bg-surface-panel hover:text-surface-foreground focus-visible:ring-offset-surface",
  },
  // novel reader: follows the reader theme tokens (data-reader-theme on an ancestor)
  themed: {
    bar: "bg-reader-page text-reader-text border-reader-border",
    quiet: "text-reader-quiet",
    track: "bg-reader-border",
    button: "text-reader-text hover:bg-reader-border/60 hover:text-reader-text focus-visible:ring-offset-reader-page",
  },
} as const

type ReaderBarProps = {
  /** Link target of the back arrow (the series page). */
  backHref: string
  seriesTitle: string
  /** "Episode 1" or the chapter name. */
  itemTitle: string
  kind?: "episode" | "chapter"
  /** The Episodes / Chapters popover (see EpisodeListPopover). */
  listSlot?: React.ReactNode
  /** Extra controls before the arrows, e.g. the "Aa" settings popover (novel). */
  trailingSlot?: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** Show the previous / next arrows (the novel design has none; it uses ← / → and the end buttons). */
  showArrows?: boolean
  /** 0..1, drawn as a 2 px green line under the bar. */
  progress: number
  className?: string
}

function ReaderBar({ tone, ...p }: ReaderBarProps & { tone: keyof typeof tones }) {
  const t = useTranslations("reader")
  const s = tones[tone]
  const kind = p.kind ?? "episode"
  const pct = Math.round(Math.min(1, Math.max(0, p.progress)) * 100)

  return (
    <header className={cn("sticky top-0 z-40", s.bar, p.className)}>
      <div className="mx-auto flex h-14 max-w-[832px] items-center gap-2 border-b-0 px-4">
        <Button asChild variant="ghost" size="icon-sm" className={s.button}>
          <Link href={p.backHref} aria-label={t("backToSeries")}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={cn("truncate text-xs", s.quiet)}>{p.seriesTitle}</span>
          <h1 className="truncate text-sm font-semibold">{p.itemTitle}</h1>
        </div>
        {p.listSlot}
        {p.trailingSlot}
        {p.showArrows === false ? null : (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className={s.button}
            aria-label={t(kind === "chapter" ? "prevChapter" : "prevEpisode")}
            disabled={p.prevDisabled}
            onClick={p.onPrev}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className={s.button}
            aria-label={t(kind === "chapter" ? "nextChapter" : "nextEpisode")}
            disabled={p.nextDisabled}
            onClick={p.onNext}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn("h-0.5 w-full", s.track)}
      >
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </header>
  )
}

/** Dark bar of the comic reader. */
export function ComicReaderBar(props: ReaderBarProps) {
  return <ReaderBar tone="dark" {...props} />
}

/** Bar of the novel reader; colours follow the `data-reader-theme` of an ancestor. */
export function NovelReaderBar(props: ReaderBarProps) {
  return <ReaderBar tone="themed" kind="chapter" showArrows={false} {...props} />
}
