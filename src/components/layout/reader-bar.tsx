import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type ReaderBarProps = {
  /** Link target of the back arrow and the series title (the series page). */
  backHref: string
  seriesTitle: string
  /** "Episode 1" or the chapter name. */
  itemTitle: string
  /** The Episodes / Chapters popover (see EpisodeListPopover). */
  listSlot?: React.ReactNode
  /** The settings popover: the comic's gear, the novel's "Aa". */
  settingsSlot?: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** 0..1, drawn as a 2 px green line under the bar. */
  progress: number
  className?: string
}

/** Ghost buttons of the bars: the reader's text colour, the reader's hover. */
export const barButton = "text-foreground hover:bg-accent hover:text-foreground focus-visible:ring-offset-background"
const novelButton = "text-reader-text hover:bg-accent hover:text-reader-text focus-visible:ring-offset-reader-page"

function ReaderBar({ kind, light, ...p }: ReaderBarProps & { kind: "episode" | "chapter"; light?: boolean }) {
  const t = useTranslations("reader")
  const novel = kind === "chapter"
  const pct = Math.round(Math.min(1, Math.max(0, p.progress)) * 100)
  const button = novel ? novelButton : barButton

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        novel ? "bg-reader-page/90 text-reader-text" : cn("text-foreground", light ? "bg-background/[.92]" : "bg-background/[.88]"),
        p.className
      )}
    >
      <div className="mx-auto flex h-14 max-w-[880px] items-center gap-2 px-4">
        <Button asChild variant="ghost" size="icon" className={button}>
          <Link href={p.backHref} aria-label={t("backTo", { title: p.seriesTitle })}>
            <ArrowLeftIcon className="size-[18px]" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={p.backHref}
            className={cn(
              "w-fit max-w-full truncate rounded-sm text-xs leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              novel ? "text-reader-quiet hover:text-reader-text" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.seriesTitle}
          </Link>
          <span className="truncate text-[13px] leading-[18px] font-semibold">{p.itemTitle}</span>
        </div>
        {p.listSlot}
        {p.settingsSlot}
        {novel ? null : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className={button}
              aria-label={t("prevEpisode")}
              disabled={p.prevDisabled}
              onClick={p.onPrev}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className={button}
              aria-label={t("nextEpisode")}
              disabled={p.nextDisabled}
              onClick={p.onNext}
            >
              <ChevronRightIcon />
            </Button>
          </>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn("h-0.5 w-full", novel || light ? "bg-border" : "bg-card")}
      >
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </header>
  )
}

/** Bar of the comic reader (prototype `.vw-bar`): back, titles, Episodes, gear, ‹ ›, progress in the episode. */
export function ComicReaderBar(props: ReaderBarProps & { light?: boolean }) {
  return <ReaderBar kind="episode" {...props} />
}

/** Bar of the novel reader (prototype `.nr-bar`): back, titles, Chapters, Aa, reading progress. Colours follow the reader theme. */
export function NovelReaderBar(props: ReaderBarProps) {
  return <ReaderBar kind="chapter" {...props} />
}
