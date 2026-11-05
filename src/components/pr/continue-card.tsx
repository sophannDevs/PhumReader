import { ChevronRightIcon } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Progress } from "@/components/ui/progress"
import type { Series } from "@/data/types"
import { Link } from "@/i18n/navigation"
import { readerHref } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** 48x64 cover, title, "Episode N · 62%" (or Chapter), progress bar, chevron. Opens the reader. */
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
  const label = t(series.type === "novel" ? "chapterProgress" : "episodeProgress", {
    n: episode,
    percent,
  })

  return (
    <Link
      href={readerHref(series, episode)}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-card border bg-card p-3 shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-control bg-muted">
        <Image
          src={series.cover}
          alt={t("cover", { title: series.title })}
          width={96}
          height={128}
          sizes="48px"
          className="cover-zoom size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="type-card-title truncate">{series.title}</h3>
        <p className="type-caption font-normal text-muted-foreground tabular-nums">{label}</p>
        <Progress value={percent} aria-label={label} />
      </div>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-control border bg-background shadow-xs"
      >
        <ChevronRightIcon className="size-4" />
      </span>
    </Link>
  )
}
