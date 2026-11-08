import { CreatorSeriesSkeleton } from "@/components/pr/creator-series-page"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="container flex flex-col gap-6 py-8" aria-busy="true" aria-hidden>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-72 rounded-control" />
        <Skeleton className="h-10 w-32 rounded-control" />
      </div>
      <CreatorSeriesSkeleton />
    </div>
  )
}
