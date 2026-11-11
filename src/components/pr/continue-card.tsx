import { ChevronRightIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "@/i18n/translations"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { readerHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** V2.1 `.cr-card`: 48x64 cover, title, "Episode 23 · 62% read" (or Chapter), progress, a 32 px go button. Opens the reader. */
export function ContinueCard({
  series,
  episode,
  progress,
  className,
}: {
  series: Series
  episode: number
  /** 0..1 */
  progress: number
  className?: string
}) {
  const t = useTranslations("cards")
  const percent = Math.round(progress * 100)
  const label = t(series.type === "novel" ? "chapterProgress" : "episodeProgress", { n: episode, percent })

  return (
    <Link
      href={readerHref(series, episode)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-card border bg-card p-2.5 shadow-xs transition-colors outline-none hover:border-[#d4d4d8] hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <Image
        src={series.cover}
        alt=""
        width={96}
        height={128}
        sizes="48px"
        className="h-16 w-12 shrink-0 rounded-md bg-muted object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="truncate text-[15px] leading-[22px] font-semibold">{series.title}</h3>
        <p className="text-xs leading-4 text-muted-foreground tabular-nums">{label}</p>
        <div
          role="progressbar"
          aria-label={t("progressOf", { title: series.title })}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control bg-secondary">
        <ChevronRightIcon className="size-3.5" />
      </span>
    </Link>
  )
}
