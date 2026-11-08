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

/** Route-level fallback for list pages: title line, tab row and a series card grid. */
export function SkeletonPage({ cards = 12 }: { cards?: number }) {
  return (
    <div className="container flex flex-col gap-6 py-6" aria-busy="true" aria-hidden>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-9 w-72 max-w-full rounded-full" />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

/** Route-level fallback for form pages (series form, episode form). */
export function SkeletonForm() {
  return (
    <div className="container max-w-3xl flex flex-col gap-6 py-6" aria-busy="true" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-control" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-28 w-full rounded-control" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="aspect-[3/4] w-36 rounded-card" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="aspect-[16/9] w-full rounded-card" />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-28 rounded-control" />
          <Skeleton className="h-10 w-28 rounded-control" />
        </div>
      </div>
    </div>
  )
}
