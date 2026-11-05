import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** SeriesCard placeholder: 3:4 cover, title line, meta line. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      <Skeleton className="aspect-[3/4] w-full rounded-card" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  )
}

/** Row placeholder (EpisodeRow, ContinueCard, RankRow): thumbnail + two lines. */
export function SkeletonRow({
  thumb = "size-16",
  className,
}: {
  /** Tailwind size classes for the thumbnail, e.g. "h-16 w-12" for a continue card. */
  thumb?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden>
      <Skeleton className={cn("shrink-0 rounded-control", thumb)} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  )
}

/** Paragraph placeholder; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  )
}
