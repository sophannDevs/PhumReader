import { SkeletonRow } from "@/components/pr/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function CreatorLoading() {
  return (
    <div className="container flex flex-col gap-8 py-10" aria-busy="true" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-56" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-card border bg-card p-5 shadow-xs">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>

      {/* Action banner */}
      <div className="flex items-center justify-between rounded-card border bg-card p-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-control" />
      </div>

      {/* Series list */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonRow key={i} thumb="size-20" />
        ))}
      </div>
    </div>
  )
}

